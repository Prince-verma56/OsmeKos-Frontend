'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, money, shortDate, errorMessage, type Paged, todayIso } from '@/lib/api';
import { paymentReferenceField } from '@/lib/payments';
import { useSaveNav, SaveStalled } from '@/lib/useSaveNav';
import { INDIAN_STATES, stateLabel } from '@/lib/states';
import { AccountSelect } from '@/components/AccountSelect';
import { SearchSelect } from '@/components/SearchSelect';
import { CustomerSelect } from '@/components/CustomerSelect';
import {
  Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { SaveBar } from './form/SaveBar';
import { PageCrumb } from '@/lib/crumbs';

type Customer = {
  id: string;
  displayName: string | null;
  b2bAccount?: { companyName: string | null; gstin: string | null; placeOfSupplyCode: string | null } | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  grandTotal: string;
  balanceDue: string;
  status: string;
};

type TaxRate = { id: string; name: string; rate: string; type: string; section: string | null };
type Location = { id: string; name: string; isDefault: boolean; stateCode?: string | null };

type Tab = 'INVOICE_PAYMENT' | 'CUSTOMER_ADVANCE';

export type ExistingReceipt = {
  id: string;
  paymentNumber: string;
  type: Tab;
  customerId: string;
  amount: string;
  paymentDate: string;
  paymentMode: string;
  depositTo: string | null;
  referenceNumber: string | null;
  notes: string | null;
  bankCharges: string;
  tdsDeducted: string;
  tdsTaxName: string | null;
  tdsRate: string | null;
  descriptionOfSupply: string | null;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  locationId: string | null;
  allocations: { id: string; amount: string; invoice: { id: string; invoiceNumber: string } }[];
};

function oldestFirst(invoices: Invoice[], total: number) {
  const out: Record<string, string> = {};
  let left = Math.round(total * 100) / 100;
  for (const i of [...invoices].sort((a, z) => a.invoiceDate.localeCompare(z.invoiceDate))) {
    if (left <= 0.001) break;
    const take = Math.min(left, Number(i.balanceDue));
    if (take <= 0) continue;
    out[i.id] = String(Number(take.toFixed(2)));
    left = Math.round((left - take) * 100) / 100;
  }
  return out;
}

export function ReceiptForm({ existing }: { existing?: ExistingReceipt }) {
  const params = useSearchParams();
  const isEdit = !!existing;

  const [heldInvoiceIds] = useState<string[]>(() =>
    (existing?.allocations ?? []).map((a) => a.invoice.id)
  );
  const [heldAmounts] = useState<Record<string, number>>(() =>
    (existing?.allocations ?? []).reduce<Record<string, number>>((m, a) => {
      m[a.invoice.id] = (m[a.invoice.id] ?? 0) + Number(a.amount);
      return m;
    }, {})
  );

  const [tab, setTab] = useState<Tab>(
    existing?.type ?? (params.get('type') === 'advance' ? 'CUSTOMER_ADVANCE' : 'INVOICE_PAYMENT')
  );
  const [keepAsAdvance, setKeepAsAdvance] = useState(params.get('type') === 'advance');
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [gstRates, setGstRates] = useState<TaxRate[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [orgState, setOrgState] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ customerId: string; list: Invoice[] }>({
    customerId: '',
    list: [],
  });
  const [error, setError] = useState('');
  const { saving, stalledHref, begin: beginSave, done: doneSave, fail: failSave } =
    useSaveNav();

  const [form, setForm] = useState({
    customerId: existing?.customerId ?? params.get('customerId') ?? '',
    amount: existing ? String(Number(existing.amount)) : '',
    paymentDate: (existing?.paymentDate ?? todayIso()).slice(0, 10),
    paymentMode: existing?.paymentMode ?? 'BANK_TRANSFER',
    depositTo: existing?.depositTo ?? '',
    referenceNumber: existing?.referenceNumber ?? '',
    notes: existing?.notes ?? '',
    bankCharges: existing ? String(Number(existing.bankCharges)) : '',
    tdsDeducted: existing ? String(Number(existing.tdsDeducted)) : '0',
    tdsTaxRateId: '',
    descriptionOfSupply: existing?.descriptionOfSupply ?? '',
    sourceOfSupplyCode: existing?.sourceOfSupplyCode ?? '',
    placeOfSupplyCode: existing?.placeOfSupplyCode ?? '',
    locationId: existing?.locationId ?? '',
    advanceTaxRateId: '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const snapshotTaxId = useMemo(() => {
    if (!existing?.tdsTaxName) return '';
    return (
      taxRates.find(
        (t) =>
          t.name === existing.tdsTaxName &&
          (existing.tdsRate == null || Number(t.rate) === Number(existing.tdsRate))
      )?.id ?? ''
    );
  }, [existing, taxRates]);

  const tdsTaxRateId = form.tdsTaxRateId || snapshotTaxId;

  const [manualApplied, setManualApplied] = useState<Record<string, string> | null>(() =>
    existing
      ? Object.fromEntries(existing.allocations.map((a) => [a.invoice.id, String(Number(a.amount))]))
      : null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, tds, gst, loc, org] = await Promise.all([
          api.get<Paged<Customer>>('/customers', { limit: 100 }),
          api
            .get<{ data: TaxRate[] }>('/sales/tax-rates', { type: 'TDS' })
            .catch(() => ({ data: [] as TaxRate[] })),
          api.get<{ data: TaxRate[] }>('/sales/tax-rates').catch(() => ({ data: [] as TaxRate[] })),
          api.get<Paged<Location>>('/locations', { limit: 50 }).catch(() => null),
          api.get<{ data: { stateCode?: string | null } }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setCustomers(c.data);
        setTaxRates(tds.data);
        setGstRates(gst.data.filter((t) => t.type === 'GST' || t.type === 'IGST'));
        setLocations(loc?.data ?? []);
        setOrgState(org?.data?.stateCode ?? null);
        if (!existing) {
          const def = loc?.data.find((l) => l.isDefault) ?? loc?.data[0];
          if (def) setForm((f) => (f.locationId ? f : { ...f, locationId: def.id }));
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  useEffect(() => {
    if (!form.customerId) return;
    const customerId = form.customerId;
    let cancelled = false;
    api
      .get<{ data: Invoice[] }>(`/payments-received/open-invoices/${customerId}`)
      .then(async (r) => {
        if (cancelled) return;
        let list = r.data;
        const missing = heldInvoiceIds.filter((id) => !list.some((i) => i.id === id));
        if (missing.length) {
          const extra = await Promise.all(
            missing.map((id) =>
              api.get<{ data: Invoice }>(`/invoices/${id}`).then((x) => x.data).catch(() => null)
            )
          );
          list = [...list, ...(extra.filter(Boolean) as Invoice[])];
        }
        if (!cancelled) setFetched({ customerId, list });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.customerId, heldInvoiceIds]);

  const invoices = (fetched.customerId === form.customerId ? fetched.list : []).map((i) =>
    heldAmounts[i.id]
      ? { ...i, balanceDue: String(Math.round((Number(i.balanceDue) + heldAmounts[i.id]) * 100) / 100) }
      : i
  );
  const loaded = !!form.customerId && fetched.customerId === form.customerId;
  const mode: Tab = isEdit
    ? tab
    : loaded && (invoices.length === 0 || keepAsAdvance)
      ? 'CUSTOMER_ADVANCE'
      : !loaded && keepAsAdvance
        ? 'CUSTOMER_ADVANCE'
        : 'INVOICE_PAYMENT';
  const customer = customers.find((c) => c.id === form.customerId) ?? null;
  const location = locations.find((l) => l.id === form.locationId) ?? null;

  const source = form.sourceOfSupplyCode || location?.stateCode || orgState || '';
  const place =
    form.placeOfSupplyCode || customer?.b2bAccount?.placeOfSupplyCode || source || '';

  const paise = (n: number) => Math.round(n * 100) / 100;
  const outstanding = paise(invoices.reduce((n, i) => n + Number(i.balanceDue), 0));
  const receiving = Number(form.amount || 0);
  const tds = Number(form.tdsDeducted || 0);
  const settling = paise(receiving + tds);

  const applied = manualApplied ?? oldestFirst(invoices, settling);
  const setApplied = (
    next: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)
  ) => setManualApplied(typeof next === 'function' ? next(applied) : next);

  const allocatedTotal = paise(Object.values(applied).reduce((n, v) => n + Number(v || 0), 0));
  const excess = paise(settling - allocatedTotal);

  function setRow(invoiceId: string, value: string) {
    setApplied((a) => ({ ...a, [invoiceId]: value }));
  }

  function toggleRow(invoice: Invoice) {
    if (Number(applied[invoice.id] || 0) > 0) {
      setRow(invoice.id, '');
      setEditing((e) => ({ ...e, [invoice.id]: false }));
      return;
    }
    payInFull(invoice);
  }

  function payInFull(invoice: Invoice) {
    const alreadyElsewhere = Object.entries(applied)
      .filter(([id]) => id !== invoice.id)
      .reduce((n, [, v]) => n + Number(v || 0), 0);
    const room = Math.max(0, settling - alreadyElsewhere);
    setRow(invoice.id, String(Number(Math.min(Number(invoice.balanceDue), room).toFixed(2))));
  }

  function autoAllocate() {
    setManualApplied(null);
    setEditing({});
  }

  async function submit() {
    setError('');
    if (!form.customerId) return setError('Pick a customer');
    if (!receiving) return setError('Enter an amount');

    const allocations = Object.entries(applied)
      .filter(([, v]) => Number(v) > 0)
      .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));

    if (mode === 'INVOICE_PAYMENT') {
      if (!allocations.length) {
        return setError('Tick at least one invoice to deduct from, or tick "Keep it all as an advance instead"');
      }
      if (allocatedTotal > settling) {
        return setError(
          `You have allocated ${money(allocatedTotal)} but only ${money(settling)} is available`
        );
      }
    }

    beginSave();
    try {
      const blank = isEdit ? null : undefined;

      const body = {
        customerId: form.customerId,
        type: mode,
        paymentDate: form.paymentDate,
        amount: receiving,
        paymentMode: form.paymentMode,
        depositTo: form.depositTo.trim() || blank,
        referenceNumber: form.referenceNumber.trim() || blank,
        notes: form.notes.trim() || blank,
        bankCharges: Number(form.bankCharges || 0),
        tdsDeducted: tds,
        tdsTaxRateId: tdsTaxRateId || null,
        ...(mode === 'INVOICE_PAYMENT'
          ? { allocations }
          : {
              allocations: [],
              descriptionOfSupply: form.descriptionOfSupply.trim() || blank,
              sourceOfSupplyCode: source || undefined,
              placeOfSupplyCode: place || undefined,
              locationId: form.locationId || undefined,
              advanceTaxRateId: form.advanceTaxRateId || null,
            }),
      };

      if (isEdit) {
        await api.patch(`/payments-received/${existing.id}`, body);
        doneSave(`/payments-received/${existing.id}`);
      } else {
        const res = await api.post<{ data: { id: string } }>('/payments-received', body);
        doneSave(`/payments-received/${res.data.id}`);
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
      <PageCrumb label={isEdit ? 'Edit' : mode === 'CUSTOMER_ADVANCE' ? 'Customer advance' : 'Invoice payment'} />

      <PageHeader title={isEdit ? `Edit ${existing.paymentNumber}` : 'Record Payment'} />

      {isEdit ? (
        <>
          <div className="mb-5 flex gap-1 border-b border-border">
            <button
              type="button"
              className={tabClass('INVOICE_PAYMENT')}
              onClick={() => setTab('INVOICE_PAYMENT')}
            >
              Invoice Payment
            </button>
            <button
              type="button"
              className={tabClass('CUSTOMER_ADVANCE')}
              onClick={() => setTab('CUSTOMER_ADVANCE')}
            >
              Customer Advance
            </button>
          </div>
        </>
      ) : (
        <div
          className={`mb-5 max-w-3xl rounded-md border px-3 py-2.5 text-sm ${
            mode === 'CUSTOMER_ADVANCE'
              ? 'border-gold/30 bg-gold-soft/60 text-foreground'
              : 'border-border bg-muted/60 text-foreground'
          }`}
        >
          {!form.customerId ? (
            'Pick the customer who paid. If they have unpaid invoices you choose which ones this money clears; if not, it is saved as an advance.'
          ) : !loaded ? (
            'Looking up their unpaid invoices...'
          ) : invoices.length === 0 ? (
            <>
              <strong>{customer?.displayName ?? 'This customer'}</strong> has no unpaid invoices, so this is saved as
              an <strong>advance</strong>. Apply it from the payment when you raise their next invoice.
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{customer?.displayName ?? 'This customer'}</strong> has {invoices.length} unpaid invoice
                {invoices.length === 1 ? '' : 's'}.{' '}
                {keepAsAdvance
                  ? 'This payment is kept as an advance and not deducted from any of them.'
                  : 'Tick the invoices this payment should be deducted from.'}
              </span>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={keepAsAdvance}
                  onChange={(e) => {
                    setKeepAsAdvance(e.target.checked);
                    setManualApplied(null);
                    setEditing({});
                  }}
                />
                Keep it all as an advance instead
              </label>
            </div>
          )}
        </div>
      )}

      <SaveStalled href={stalledHref} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Payment details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" required>
                <CustomerSelect
                  value={form.customerId}
                  customers={customers}
                  onChange={(customerId, picked) => {
                if (picked && !customers.some((c) => c.id === picked.id)) setCustomers((cs) => [...cs, picked]);
                    set({ customerId });
                    setManualApplied(null);
                    setEditing({});
                    setKeepAsAdvance(false);
                  }}
                />
              </Field>

              <Field
                label="Amount received"
                required
                hint={
                  mode === 'INVOICE_PAYMENT' && outstanding > 0
                    ? `${money(outstanding)} outstanding`
                    : undefined
                }
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
                  Deposit to <span className="text-destructive">*</span>
                </span>
                <AccountSelect
                  value={form.depositTo}
                  onChange={(name) => set({ depositTo: name })}
                  usage="payment"
                  placeholder="Select an account"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Where the money landed. Add a bank with + New Account.
                </p>
              </div>

              <Field label="Bank charges (if any)" hint="What the bank or gateway kept">
                <Input
                  type="number" step="0.01" min="0"
                  value={form.bankCharges}
                  onChange={(e) => set({ bankCharges: e.target.value })}
                />
              </Field>

              {mode === 'INVOICE_PAYMENT' && outstanding > 0 && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={receiving === outstanding}
                    onChange={(e) => {
                      set({ amount: e.target.checked ? String(outstanding) : '' });
                      setManualApplied(null);
                      setEditing({});
                    }}
                  />
                  <span className="text-foreground">
                    Received full amount ({money(outstanding)})
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

          {mode === 'CUSTOMER_ADVANCE' ? (
            <Card title="Advance details">
              <div className="space-y-4">
                {customer?.b2bAccount?.gstin && (
                  <p className="text-xs text-muted-foreground">
                    GSTIN <span className="font-mono">{customer.b2bAccount.gstin}</span>
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Location" hint="Sets the source of supply">
                    <Select
                      value={form.locationId}
                      onChange={(e) => set({ locationId: e.target.value })}
                      className="w-full"
                    >
                      <option value="">Select a location…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Source of supply" hint="Our state">
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

                  <Field label="Place of supply" required hint="The customer's state">
                    <Select
                      value={place}
                      onChange={(e) => set({ placeOfSupplyCode: e.target.value })}
                      className="w-full"
                    >
                      <option value="">Select</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{stateLabel(s.code)}</option>
                      ))}
                    </Select>
                  </Field>

                  <div>
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Tax
                    </span>
                    <SearchSelect
                      value={form.advanceTaxRateId}
                      options={gstRates.map((t) => ({
                        value: t.id,
                        label: t.name,
                        hint: `${Number(t.rate)}%`,
                      }))}
                      onChange={(id) => set({ advanceTaxRateId: id })}
                      placeholder="Select a Tax"
                      emptyMessage="NO RESULTS FOUND"
                      clearable
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Leave empty for goods — GST on advances for goods was withdrawn in 2017 and
                      falls due when you raise the invoice. Only set it for a service.
                    </p>
                  </div>
                </div>

                <Field
                  label="Description of supply"
                  hint="Printed on the payment receipt"
                >
                  <Textarea
                    rows={2}
                    value={form.descriptionOfSupply}
                    onChange={(e) => set({ descriptionOfSupply: e.target.value })}
                    placeholder="Advance against the Glow Studio order"
                  />
                </Field>
              </div>
            </Card>
          ) : (
            <Card
              title="Unpaid Invoices"
              action={
                form.customerId ? (
                  <span className="flex items-center gap-3">
                    {allocatedTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => setApplied({})}
                        className="text-xs text-gold-ink hover:underline"
                      >
                        Clear applied amount
                      </button>
                    )}
                    {settling > 0 && (
                      <Button size="sm" onClick={autoAllocate}>Deduct from oldest first</Button>
                    )}
                  </span>
                ) : undefined
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">Deduct</Th>
                    <Th>Invoice#</Th>
                    <Th className="text-right">Amount due</Th>
                    <Th className="text-right">Payment</Th>
                  </tr>
                </thead>
                <tbody>
                  {!form.customerId && (
                    <EmptyRow colSpan={4} message="Pick a customer to list their unpaid invoices" />
                  )}
                  {form.customerId && invoices.length === 0 && (
                    <EmptyRow colSpan={4} message="Nothing outstanding for this customer" />
                  )}
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={Number(applied[i.id] || 0) > 0 || !!editing[i.id]}
                          onChange={() => toggleRow(i)}
                          aria-label={`Deduct from ${i.invoiceNumber}`}
                        />
                      </Td>
                      <Td>
                        <div className="whitespace-nowrap font-medium">{i.invoiceNumber}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          {shortDate(i.invoiceDate)}
                        </div>
                        {i.dueDate && (
                          <div className="whitespace-nowrap text-xs text-muted-foreground">
                            Due {shortDate(i.dueDate)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="whitespace-nowrap">{money(i.balanceDue)}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          of {money(i.grandTotal)}
                        </div>
                      </Td>
                      <Td>
                        {editing[i.id] ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Input
                              type="number" step="0.01" min="0"
                              value={applied[i.id] ?? ''}
                              onChange={(e) => setRow(i.id, e.target.value)}
                              className="w-28 text-right"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setEditing((e) => ({ ...e, [i.id]: false }))}
                              className="text-xs font-medium text-gold-ink hover:underline"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="tabular-nums">
                              {Number(applied[i.id] || 0) > 0 ? money(Number(applied[i.id])) : '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditing((e) => ({ ...e, [i.id]: true }))}
                              className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-gold hover:text-gold-ink"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                Only sent invoices are listed — a draft is not owed yet.
              </p>
            </Card>
          )}

          <Card title="Notes">
            <Field label="Internal use. Not visible to the customer.">
              <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="text-right">{customer?.displayName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount received</dt>
                <dd>{money(receiving)}</dd>
              </div>
              {tds > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">TDS withheld</dt>
                  <dd>{money(tds)}</dd>
                </div>
              )}
              {mode === 'INVOICE_PAYMENT' ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Deducted from invoices</dt>
                    <dd>{money(allocatedTotal)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-medium">
                    <dt className="text-muted-foreground">Kept as advance</dt>
                    <dd className={excess < 0 ? 'font-semibold text-destructive' : ''}>
                      {money(Math.max(0, excess))}
                    </dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <dt className="text-muted-foreground">Saved as advance</dt>
                  <dd>{money(settling)}</dd>
                </div>
              )}
            </dl>

            {mode === 'INVOICE_PAYMENT' && excess < 0 && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                You have allocated more than is available. Reduce a row, or raise the amount.
              </p>
            )}
            {mode === 'INVOICE_PAYMENT' && excess > 0 && tds > 0 && excess <= tds + 0.01 && (
              <p className="mt-3 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-xs text-foreground">
                The {money(tds)} of TDS is not on an invoice yet. The customer has settled{' '}
                {money(settling)} in total — {money(receiving)} to you and {money(tds)} to the
                Income Tax Department — so put the full amount against the invoice or they will
                still show as owing it.{' '}
                <button type="button" onClick={autoAllocate} className="font-medium underline">
                  Allocate the full {money(settling)}
                </button>
              </p>
            )}
            {mode === 'INVOICE_PAYMENT' && settling > 0 && allocatedTotal === 0 && invoices.length > 0 && (
              <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {money(settling)} is not deducted from any invoice yet. Tick an invoice below, press{' '}
                <button type="button" onClick={autoAllocate} className="font-medium underline">
                  Deduct from oldest first
                </button>
                , or tick &ldquo;Keep it all as an advance instead&rdquo;.
              </p>
            )}
            {mode === 'INVOICE_PAYMENT' && excess > 0 && allocatedTotal > 0 && !(tds > 0 && excess <= tds + 0.01) && (
              <p className="mt-3 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-xs text-foreground">
                {money(excess)} is more than the ticked invoices need. It is kept on this payment as an advance
                for {customer?.displayName ?? 'the customer'} and can be applied to a later invoice.
              </p>
            )}
          </Card>

          <Card title="Tax deducted?">
            <div className="space-y-4">
              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  TDS (Income Tax)
                </span>
                <SearchSelect
                  value={tdsTaxRateId}
                  options={taxRates.map((t) => ({
                    value: t.id,
                    label: t.name,
                    hint: `${Number(t.rate)}%${t.section ? ` · ${t.section}` : ''}`,
                  }))}
                  onChange={(id) => {
                    const t = taxRates.find((x) => x.id === id);
                    set({
                      tdsTaxRateId: id,
                      tdsDeducted: t ? String(((receiving * Number(t.rate)) / 100).toFixed(2)) : '0',
                    });
                  }}
                  placeholder="No tax deducted"
                  emptyMessage="NO RESULTS FOUND"
                  clearable
                />
              </div>
              <Field
                label="TDS deducted"
                hint="What the customer withheld. The invoice is settled by the gross."
              >
                <Input
                  type="number" step="0.01" min="0"
                  value={form.tdsDeducted}
                  onChange={(e) => set({ tdsDeducted: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <SaveBar>
        <Button type="button" variant="success" disabled={saving} onClick={submit}>
          {saving && <Spinner className="border-card/40 border-t-card" />}
          {isEdit ? 'Save changes' : mode === 'CUSTOMER_ADVANCE' ? 'Save advance' : 'Save payment'}
        </Button>
        <Link href="/admin/payments-received">
          <Button type="button" variant="ghost">Cancel</Button>
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">
          Total <strong className="text-foreground">{money(receiving)}</strong>
        </span>
      </SaveBar>
    </>
  );
}
