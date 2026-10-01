'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, money, shortDate, errorMessage, type Paged, todayIso } from '@/lib/api';
import { paymentReferenceField } from '@/lib/payments';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { INDIAN_STATES, stateLabel } from '@/lib/states';
import { AccountSelect } from '@/components/AccountSelect';
import { SearchSelect } from '@/components/SearchSelect';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { VendorSelect } from './VendorSelect';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type Vendor = {
  id: string;
  displayName: string;
  payablesBalance: string;
  sourceOfSupplyCode?: string | null;
  gstin?: string | null;
};

type Bill = {
  id: string;
  billNumber: string;
  billDate: string;
  dueDate: string | null;
  grandTotal: string;
  balanceDue: string;
  status: string;
};

type TaxRate = { id: string; name: string; rate: string; type: string; section: string | null };

type Tab = 'BILL_PAYMENT' | 'VENDOR_ADVANCE';

export type ExistingPayment = {
  id: string;
  paymentNumber: string;
  type: Tab;
  vendorId: string;
  amount: string;
  paymentDate: string;
  paymentMode: string;
  paidThrough: string | null;
  referenceNumber: string | null;
  notes: string | null;
  tdsDeducted: string;
  descriptionOfSupply: string | null;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  isReverseCharge: boolean;
  depositToAccount: string | null;
  allocations: { id: string; amount: string; bill: { id: string; billNumber: string } }[];
};

export function PaymentForm({ existing }: { existing?: ExistingPayment }) {
  const params = useSearchParams();
  const isEdit = !!existing;
  const [heldBillIds] = useState<string[]>(() =>
    (existing?.allocations ?? []).map((a) => a.bill.id)
  );
  const [heldAmounts] = useState<Record<string, number>>(() =>
    (existing?.allocations ?? []).reduce<Record<string, number>>((m, a) => {
      m[a.bill.id] = (m[a.bill.id] ?? 0) + Number(a.amount);
      return m;
    }, {})
  );

  const [tab, setTab] = useState<Tab>(
    existing?.type ?? (params.get('type') === 'advance' ? 'VENDOR_ADVANCE' : 'BILL_PAYMENT')
  );

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [orgState, setOrgState] = useState<string | null>(null);
  const [fetchedBills, setFetchedBills] = useState<{ vendorId: string; list: Bill[] }>({
    vendorId: '',
    list: [],
  });
  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const orderParam = params.get('purchaseOrderId') ?? '';
  const [againstOrder, setAgainstOrder] = useState<{ id: string; poNumber: string } | null>(null);

  const [form, setForm] = useState({
    vendorId: existing?.vendorId ?? params.get('vendorId') ?? '',
    amount: existing ? String(Number(existing.amount)) : '',
    paymentDate: (existing?.paymentDate ?? todayIso()).slice(0, 10),
    paymentMode: existing?.paymentMode ?? 'BANK_TRANSFER',
    paidThrough: existing?.paidThrough ?? '',
    referenceNumber: existing?.referenceNumber ?? '',
    notes: existing?.notes ?? '',
    tdsOverride: existing && Number(existing.tdsDeducted) ? String(Number(existing.tdsDeducted)) : '',
    tdsTaxRateId: '',
    descriptionOfSupply: existing?.descriptionOfSupply ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    destinationOfSupplyCode: existing?.destinationOfSupplyCode ?? '',
    isReverseCharge: existing?.isReverseCharge ?? false,
    depositToAccount: existing?.depositToAccount ?? 'Prepaid Expenses',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const [applied, setApplied] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (existing?.allocations ?? []).map((a) => [a.bill.id, String(Number(a.amount))])
    )
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, tr, org] = await Promise.all([
          api.get<Paged<Vendor>>('/vendors', { limit: 100 }),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates', { type: 'TDS' }).catch(() => ({ data: [] })),
          api.get<{ data: { stateCode?: string | null } }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setVendors(v.data);
        setTaxRates(tr.data);
        setOrgState(org?.data?.stateCode ?? null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orderParam) return;
    let cancelled = false;
    api
      .get<{ data: { id: string; poNumber: string; vendor?: { id: string } | null } }>(`/purchase-orders/${orderParam}`)
      .then((r) => {
        if (cancelled) return;
        setAgainstOrder({ id: r.data.id, poNumber: r.data.poNumber });
        if (r.data.vendor?.id) setForm((prev) => ({ ...prev, vendorId: prev.vendorId || r.data.vendor!.id }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderParam]);

  useEffect(() => {
    if (!form.vendorId) return;
    const vendorId = form.vendorId;
    let cancelled = false;
    api
      .get<Paged<Bill>>('/bills', { vendorId, view: 'unpaid', limit: 100 })
      .then(async (r) => {
        if (cancelled) return;
        let list = r.data;
        const missing = heldBillIds.filter((id) => !list.some((b) => b.id === id));
        if (missing.length) {
          const extra = await Promise.all(
            missing.map((id) =>
              api.get<{ data: Bill }>(`/bills/${id}`).then((x) => x.data).catch(() => null)
            )
          );
          list = [...list, ...(extra.filter(Boolean) as Bill[])];
        }
        if (!cancelled) setFetchedBills({ vendorId, list });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.vendorId, heldBillIds]);

  const bills = (fetchedBills.vendorId === form.vendorId ? fetchedBills.list : []).map((b) =>
    heldAmounts[b.id]
      ? { ...b, balanceDue: String(Math.round((Number(b.balanceDue) + heldAmounts[b.id]) * 100) / 100) }
      : b
  );
  const vendor = vendors.find((v) => v.id === form.vendorId) ?? null;

  const source = form.sourceOfSupplyCode || vendor?.sourceOfSupplyCode || '';
  const destination = form.destinationOfSupplyCode || orgState || '';

  const outstanding = bills.reduce((n, b) => n + Number(b.balanceDue), 0);
  const allocatedTotal = Math.round(Object.values(applied).reduce((n, v) => n + Number(v || 0), 0) * 100) / 100;
  const paying = Number(form.amount || 0);
  const excess = Math.round((paying - allocatedTotal) * 100) / 100;

  const tdsTax = taxRates.find((t) => t.id === form.tdsTaxRateId) ?? null;
  const tdsCalculated = tdsTax ? Number(((paying * Number(tdsTax.rate)) / 100).toFixed(2)) : 0;
  const tdsOverridden = form.tdsOverride !== '';
  const tdsDeducted = tdsOverridden ? Number(form.tdsOverride || 0) : tdsCalculated;
  const netToVendor = paying - tdsDeducted;

  function setRow(billId: string, value: string) {
    setApplied((a) => ({ ...a, [billId]: value }));
  }

  function payInFull(bill: Bill) {
    setRow(bill.id, String(Number(bill.balanceDue)));
  }

  function autoAllocate() {
    let left = Number(form.amount || 0);
    const next: Record<string, string> = {};
    for (const b of [...bills].sort((a, z) => a.billDate.localeCompare(z.billDate))) {
      if (left <= 0) break;
      const take = Math.min(left, Number(b.balanceDue));
      next[b.id] = String(take);
      left -= take;
    }
    setApplied(next);
  }

  async function submit() {
    setError('');
    if (!form.vendorId) return setError('Pick a vendor');
    if (!paying) return setError('Enter an amount');

    const allocations = Object.entries(applied)
      .filter(([, v]) => Number(v) > 0)
      .map(([billId, v]) => ({ billId, amount: Number(v) }));

    if (tab === 'BILL_PAYMENT') {
      if (!allocations.length) {
        return setError('Put an amount against at least one bill, or record this as an advance');
      }
      if (allocatedTotal > paying) {
        return setError(`You have allocated ${money(allocatedTotal)} but are only paying ${money(paying)}`);
      }
    }

    beginSave();
    try {
      const blank = isEdit ? null : undefined;

      const body = {
        vendorId: form.vendorId,
        type: tab,
        paymentDate: form.paymentDate,
        amount: paying,
        paymentMode: form.paymentMode,
        paidThrough: form.paidThrough.trim() || blank,
        referenceNumber: form.referenceNumber.trim() || blank,
        notes: form.notes.trim() || blank,
        tdsDeducted,
        tdsTaxRateId: form.tdsTaxRateId || null,
        ...(tab === 'BILL_PAYMENT'
          ? { allocations }
          : {
              purchaseOrderId: againstOrder?.id ?? blank,
              descriptionOfSupply: form.descriptionOfSupply.trim() || blank,
              sourceOfSupplyCode: source || undefined,
              destinationOfSupplyCode: destination || undefined,
              isReverseCharge: form.isReverseCharge,
              depositToAccount: form.depositToAccount || undefined,
            }),
      };

      if (isEdit) {
        await api.patch(`/bills/payments/${existing.id}`, body);
        doneSave(`/payments-made/${existing.id}`);
      } else {
        const res = await api.post<{ data: { id: string } }>('/bills/payments', body);
        doneSave(`/payments-made/${res.data.id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
      failSave();
    }
  }

  const tabClass = (t: Tab) =>
    `-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
      tab === t
        ? 'border-border font-medium text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <>
      <PageCrumb label={isEdit ? 'Edit' : tab === 'VENDOR_ADVANCE' ? 'Vendor advance' : 'Bill payment'} />

      <PageHeader title={isEdit ? `Edit ${existing.paymentNumber}` : 'Record Payment'} />

      <div className="mb-5 flex gap-1 border-b border-border">
        <button type="button" className={tabClass('BILL_PAYMENT')} onClick={() => setTab('BILL_PAYMENT')}>
          Bill Payment
        </button>
        <button type="button" className={tabClass('VENDOR_ADVANCE')} onClick={() => setTab('VENDOR_ADVANCE')}>
          Vendor Advance
        </button>
      </div>

      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        {tab === 'BILL_PAYMENT'
          ? 'Settles bills that already exist. Put an amount against each bill this money clears — one payment can close several.'
          : 'Money paid before any bill exists. It sits as a credit against the vendor until you apply it to a bill, which you can do from the payment afterwards.'}
      </p>

      <SaveStalled href={stalledHref} />

      {againstOrder && tab === 'VENDOR_ADVANCE' && (
        <p className="mb-4 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-sm text-foreground">
          This advance is being paid against {againstOrder.poNumber}. It stays with that order until you put it on
          a bill.
        </p>
      )}

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Payment details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor" required>
                <VendorSelect
                  value={form.vendorId}
                  vendors={vendors}
                  onChange={(vendorId, picked) => {
                    if (picked && !vendors.some((v) => v.id === picked.id)) setVendors((vs) => [...vs, picked]);
                    set({ vendorId });
                    setApplied({});
                  }}
                />
              </Field>

              <Field
                label="Payment made"
                required
                hint={tab === 'BILL_PAYMENT' && outstanding > 0 ? `${money(outstanding)} outstanding` : undefined}
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                />
              </Field>

              <Field label="Payment date" required>
                <Input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => set({ paymentDate: e.target.value })}
                />
              </Field>
              <Field label="Payment mode">
                <Select
                  value={form.paymentMode}
                  onChange={(e) => set({ paymentMode: e.target.value })}
                  className="w-full"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>

              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Paid through <span className="text-destructive">*</span>
                </span>
                <AccountSelect
                  value={form.paidThrough}
                  onChange={(name) => set({ paidThrough: name })}
                  usage="payment"
                  placeholder="Select an account"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Where the money left from. Add a bank with + New Account.
                </p>
              </div>

              {tab === 'BILL_PAYMENT' && outstanding > 0 && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={paying === outstanding}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        set({ amount: '' });
                        setApplied({});
                        return;
                      }
                      set({ amount: String(outstanding) });
                      setApplied(
                        Object.fromEntries(
                          bills.map((b) => [b.id, String(Number(b.balanceDue))])
                        )
                      );
                    }}
                  />
                  <span className="text-foreground">
                    Pay full amount ({money(outstanding)})
                  </span>
                </label>
              )}

              <Field
                label={paymentReferenceField(form.paymentMode).label}
                hint={paymentReferenceField(form.paymentMode).hint}
              >
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => set({ referenceNumber: e.target.value })}
                  placeholder={paymentReferenceField(form.paymentMode).placeholder}
                  className={paymentReferenceField(form.paymentMode).mono ? 'font-mono' : ''}
                />
              </Field>
            </div>
          </Card>

          {tab === 'VENDOR_ADVANCE' ? (
            <Card title="Advance details">
              <div className="space-y-4">
                {vendor?.gstin && (
                  <p className="text-xs text-muted-foreground">
                    GSTIN <span className="font-mono">{vendor.gstin}</span>
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Source of supply" required>
                    <Select
                      value={source}
                      onChange={(e) => set({ sourceOfSupplyCode: e.target.value })}
                      className="w-full"
                    >
                      <option value="">Select</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Destination of supply" required>
                    <Select
                      value={destination}
                      onChange={(e) => set({ destinationOfSupplyCode: e.target.value })}
                      className="w-full"
                    >
                      <option value="">Select</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field
                  label="Description of supply"
                  hint="Printed on the payment voucher"
                >
                  <Textarea
                    rows={2}
                    value={form.descriptionOfSupply}
                    onChange={(e) => set({ descriptionOfSupply: e.target.value })}
                  />
                </Field>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.isReverseCharge}
                    onChange={(e) => set({ isReverseCharge: e.target.checked })}
                  />
                  <span className="text-foreground">
                    This transaction is applicable for reverse charge
                    <span className="block text-xs text-muted-foreground">
                      An advance to an unregistered supplier puts the GST on us.
                    </span>
                  </span>
                </label>

                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Deposit to
                  </span>
                  <AccountSelect
                    value={form.depositToAccount}
                    onChange={(name) => set({ depositToAccount: name })}
                    usage="deposit"
                    placeholder="Prepaid Expenses"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    The asset account the advance is parked in until it is applied.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card
              title={`Unpaid bills (${bills.length})`}
              padded={false}
              action={
                bills.length > 0 ? (
                  <span className="flex items-center gap-2">
                    {allocatedTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => setApplied({})}
                        className="text-xs text-gold-ink hover:underline"
                      >
                        Clear applied amount
                      </button>
                    )}
                    {paying > 0 && (
                      <Button size="sm" onClick={autoAllocate}>Auto-allocate</Button>
                    )}
                  </span>
                ) : undefined
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Bill#</Th>
                    <Th className="text-right">Amount due</Th>
                    <Th className="text-right">Payment</Th>
                  </tr>
                </thead>
                <tbody>
                  {!form.vendorId && (
                    <EmptyRow colSpan={3} message="Pick a vendor to list their unpaid bills. Draft bills open themselves when paid." />
                  )}
                  {form.vendorId && bills.length === 0 && (
                    <EmptyRow colSpan={3} message="Nothing outstanding for this vendor" />
                  )}
                  {bills.map((b) => (
                    <tr key={b.id}>
                      <Td>
                        <div className="whitespace-nowrap font-medium">{b.billNumber}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          {shortDate(b.billDate)}
                        </div>
                        {b.dueDate && (
                          <div className="whitespace-nowrap text-xs text-muted-foreground">
                            Due {shortDate(b.dueDate)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="whitespace-nowrap">{money(b.balanceDue)}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          of {money(b.grandTotal)}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col items-end gap-0.5">
                          <Input
                            type="number" step="0.01" min="0"
                            value={applied[b.id] ?? ''}
                            onChange={(e) => setRow(b.id, e.target.value)}
                            className="w-28 text-right"
                          />
                          <button
                            type="button"
                            onClick={() => payInFull(b)}
                            className="text-[11px] text-gold-ink hover:underline"
                          >
                            Pay in Full
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <Card title="Notes">
            <Field label="Internal use. Not visible to the vendor.">
              <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd className="text-right">{vendor?.displayName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount paid</dt>
                <dd>{money(paying)}</dd>
              </div>
              {tab === 'BILL_PAYMENT' && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Used for payments</dt>
                    <dd>{money(allocatedTotal)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <dt className="text-muted-foreground">Amount in excess</dt>
                    <dd className={excess < 0 ? 'font-semibold text-destructive' : ''}>
                      {money(Math.max(0, excess))}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {tab === 'BILL_PAYMENT' && excess < 0 && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                You have allocated more than you are paying. Reduce a row, or raise the amount.
              </p>
            )}
            {tab === 'BILL_PAYMENT' && excess > 0 && (
              <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {money(excess)} is not allocated to any bill and will simply not be recorded. Record
                it as a <button type="button" onClick={() => setTab('VENDOR_ADVANCE')} className="underline">vendor advance</button> instead if you are paying ahead.
              </p>
            )}
          </Card>

          <Card title="TDS withheld">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {tab === 'VENDOR_ADVANCE'
                  ? 'TDS falls due at payment or at credit, whichever is earlier — so it comes out of the advance now, not when the bill arrives.'
                  : 'What you hold back from the vendor and deposit with the Income Tax Department yourself.'}
              </p>

              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Section
                </span>
                <SearchSelect
                  value={form.tdsTaxRateId}
                  options={taxRates.map((t) => ({
                    value: t.id,
                    label: t.name,
                    hint: `${Number(t.rate)}%${t.section ? ` · ${t.section}` : ''}`,
                  }))}
                  onChange={(id) => set({ tdsTaxRateId: id })}
                  placeholder="No TDS on this payment"
                  emptyMessage="NO RESULTS FOUND"
                  clearable
                />
              </div>

              <Field
                label="TDS deducted"
                hint={
                  tdsTax
                    ? `${Number(tdsTax.rate)}% of ${money(paying)}${tdsTax.section ? ` · section ${tdsTax.section}` : ''}`
                    : 'Pick a section above, or type the amount yourself'
                }
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={tdsOverridden ? form.tdsOverride : tdsTax ? tdsCalculated.toFixed(2) : ''}
                  placeholder="0.00"
                  onChange={(e) => set({ tdsOverride: e.target.value })}
                />
              </Field>

              {tdsOverridden && tdsTax && tdsDeducted !== tdsCalculated && (
                <p className="text-xs text-warning">
                  Overridden — {Number(tdsTax.rate)}% works out to {money(tdsCalculated)}.{' '}
                  <button
                    type="button"
                    onClick={() => set({ tdsOverride: '' })}
                    className="underline"
                  >
                    Use the calculated amount
                  </button>
                </p>
              )}

              {tdsDeducted > 0 && (
                <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {tab === 'VENDOR_ADVANCE' ? 'Advance' : 'Payment'}
                    </dt>
                    <dd>{money(paying)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Less TDS</dt>
                    <dd className="text-destructive">−{money(tdsDeducted)}</dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>Vendor receives</dt>
                    <dd className={netToVendor < 0 ? 'text-destructive' : ''}>
                      {money(netToVendor)}
                    </dd>
                  </div>
                </dl>
              )}

              {netToVendor < 0 && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  The TDS is larger than the payment itself.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <SaveBar>
        <Button type="button" variant="success" disabled={saving} onClick={submit}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          {isEdit ? 'Save changes' : tab === 'VENDOR_ADVANCE' ? 'Save advance' : 'Save as Paid'}
        </Button>
        <Link href="/admin/payments-made">
          <Button type="button" variant="ghost">Cancel</Button>
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          Total <strong className="text-foreground">{money(paying)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
