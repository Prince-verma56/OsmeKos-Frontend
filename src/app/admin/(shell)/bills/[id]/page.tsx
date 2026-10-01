'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage, numberLocale, todayIso } from '@/lib/api';
import { paymentReferenceField } from '@/lib/payments';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { PdfCustomize, type PdfTemplate } from '@/components/PdfCustomize';
import { Modal, ConfirmModal } from '@/components/Modal';
import { AccountSelect } from '@/components/AccountSelect';
import { usePaymentTerms } from '@/components/PaymentTermSelect';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

type BillLine = {
  id: string;
  itemId?: string | null;
  itemName: string;
  imageUrl?: string | null;
  description: string | null;
  account: string | null;
  hsnCode: string | null;
  quantity: string;
  rate: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
};

type PaymentAllocation = {
  id: string;
  amount: string;
  payment: {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: string;
    paymentMode: string;
    type: 'BILL_PAYMENT' | 'VENDOR_ADVANCE';
    referenceNumber: string | null;
  };
};

type Bill = {
  creditApplications?: { id: string; amount: string; credit: { id: string; creditNumber: string } }[];
  id: string;
  billNumber: string;
  billDate: string;
  dueDate: string | null;
  referenceNumber: string | null;
  orderNumber: string | null;
  status: string;
  paymentTerms: string;
  isReverseCharge: boolean;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  taxTreatment: 'EXCLUSIVE' | 'INCLUSIVE';
  discountLevel: 'TRANSACTION' | 'LINE_ITEM';
  discountPercent: string | null;
  subtotal: string;
  discountTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  tdsAmount: string;
  taxWithholdingType: 'TDS' | 'TCS' | null;
  taxWithholdingName: string | null;
  shippingCharge?: string;
  adjustment: string;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  notes: string | null;
  vendor: { id: string; displayName: string; gstin: string | null; sourceOfSupplyCode: string | null } | null;
  purchaseOrder: { id: string; poNumber: string } | null;
  receives?: { id: string; receiveNumber: string; receiveDate: string; status: string }[];
  lines: BillLine[];
  paymentAllocations: PaymentAllocation[];
};

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { label: termName } = usePaymentTerms();
  const router = useRouter();

  const [bill, setBill] = useState<Bill | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [vendorAddress, setVendorAddress] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const { can } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  const [now] = useState(() => Date.now());
  const [showPdf, setShowPdf] = usePdfView('bill');
  const [template, setTemplate] = useState<PdfTemplate>('standard');
  const [paymentsOpen, setPaymentsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'' | 'payment' | 'void' | 'delete' | 'credit'>('');
  const [advances, setAdvances] = useState<{ id: string; paymentNumber: string; paymentDate: string; unapplied: number }[]>([]);
  const [moreAdvances, setMoreAdvances] = useState(false);

  const [payForm, setPayForm] = useState({
    amount: '',
    paymentDate: todayIso(),
    paymentMode: 'BANK_TRANSFER',
    paidThrough: '',
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: Bill }>(`/bills/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setBill(res.data);
        setOrg(orgRes?.data ?? null);
        setError('');
        setPayForm((f) => ({ ...f, amount: String(Number(res.data.balanceDue)) }));

        if (res.data.vendor?.id && res.data.status !== 'VOID' && Number(res.data.balanceDue) > 0) {
          api
            .get<{ data: { id: string; paymentNumber: string; paymentDate: string; unapplied: number }[] }>('/bills/payments', {
              vendorId: res.data.vendor.id,
              type: 'VENDOR_ADVANCE',
              limit: 100,
            })
            .then((r) => {
              if (cancelled) return;
              setAdvances(r.data.filter((p) => Number(p.unapplied) > 0));
              setMoreAdvances(r.data.length >= 100);
            })
            .catch(() => {});
        } else {
          setAdvances([]);
        }

        if (res.data.vendor?.id) {
          const v = await api
            .get<{ data: { addresses: { type: string; line1: string; line2?: string | null; city: string; state: string; pincode: string; country: string }[] } }>(
              `/vendors/${res.data.vendor.id}`
            )
            .catch(() => null);
          if (cancelled) return;
          const a = v?.data.addresses?.find((x) => x.type === 'BILLING') ?? v?.data.addresses?.[0];
          setVendorAddress(
            a
              ? ([a.line1, a.line2, `${a.city}`, `${a.pincode} ${a.state}`, a.country].filter(
                  Boolean
                ) as string[])
              : []
          );
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function act(label: string, fn: () => Promise<unknown>, redirect?: string) {
    setBusy(label);
    setError('');
    setMenuOpen(false);
    try {
      await fn();
      if (redirect) {
        router.push(redirect);
        return;
      }
      toast.success(label);
      setDialog('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
      setDialog('');
    } finally {
      setBusy('');
    }
  }

  if (loading) return <Loading />;
  if (!bill) {
    return <ErrorBox message={error || 'Bill not found'} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const paid = Number(bill.amountPaid) > 0;
  const creditsApplied = (bill.creditApplications ?? []).reduce((n, a) => n + Number(a.amount), 0);
  const settled = Number(bill.balanceDue) <= 0;
  const isVoid = bill.status === 'VOID';
  const advanceAvailable = advances.reduce((n, a) => n + Number(a.unapplied), 0);
  const canReceive =
    !isVoid &&
    bill.status !== 'DRAFT' &&
    !bill.purchaseOrder &&
    bill.lines.some((l) => l.itemId) &&
    can('purchase-receives:write');

  async function applyAdvances() {
    setBusy('advance');
    let applied = 0;
    try {
      let left = Number(bill!.balanceDue);
      const oldestFirst = [...advances].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
      for (const a of oldestFirst) {
        if (left <= 0) break;
        const amount = Math.min(Number(a.unapplied), left);
        await api.post(`/bills/payments/${a.id}/apply`, { allocations: [{ billId: bill!.id, amount }] });
        left -= amount;
        applied += amount;
      }
      toast.success(`${money(applied)} of the vendor advance applied to ${bill!.billNumber}`);
    } catch (err) {
      toast.error(
        applied > 0
          ? `${money(applied)} was applied, then it stopped: ${errorMessage(err)}`
          : errorMessage(err)
      );
    } finally {
      setBusy('');
      setReloadKey((k) => k + 1);
    }
  }
  const dueAt = bill.dueDate ? new Date(bill.dueDate).getTime() : null;
  const overdueDays =
    dueAt != null && Number(bill.balanceDue) > 0 && dueAt < now
      ? Math.floor((now - dueAt) / 86400000)
      : 0;

  const intraState =
    !!bill.sourceOfSupplyCode &&
    !!bill.destinationOfSupplyCode &&
    bill.sourceOfSupplyCode === bill.destinationOfSupplyCode;

  const rates = [...new Set(bill.lines.map((l) => Number(l.taxRate)))];
  const uniformRate = rates.length === 1 ? rates[0] : null;

  const totals = [
    { label: 'Sub Total', value: money(Number(bill.subtotal) + Number(bill.discountTotal)) },
    ...(Number(bill.discountTotal) > 0
      ? [{
          label: `Discount${bill.discountPercent && Number(bill.discountPercent) > 0 ? ` (${Number(bill.discountPercent)}%)` : ''}`,
          value: `(-) ${money(bill.discountTotal)}`,
          negative: true,
        }]
      : []),
    ...(intraState
      ? [
          { label: `CGST${uniformRate != null ? `${uniformRate / 2} (${uniformRate / 2}%)` : ''}`, value: money(bill.cgstTotal) },
          { label: `SGST${uniformRate != null ? `${uniformRate / 2} (${uniformRate / 2}%)` : ''}`, value: money(bill.sgstTotal) },
        ]
      : [{ label: `IGST${uniformRate != null ? `${uniformRate} (${uniformRate}%)` : ''}`, value: money(bill.igstTotal) }]),
    ...(Number(bill.shippingCharge ?? 0) > 0
      ? [{ label: 'Shipping', value: money(bill.shippingCharge ?? 0) }]
      : []),
    ...(Number(bill.adjustment) !== 0
      ? [{ label: bill.adjustmentLabel || 'Adjustment', value: money(bill.adjustment) }]
      : []),
    ...(bill.taxWithholdingType
      ? [{
          label: `${bill.taxWithholdingType}${bill.taxWithholdingName ? ` (${bill.taxWithholdingName})` : ''}`,
          value: `${bill.taxWithholdingType === 'TDS' ? '(-) ' : '(+) '}${money(bill.tdsAmount)}`,
          negative: bill.taxWithholdingType === 'TDS',
        }]
      : []),
    ...(Number(bill.roundOff ?? 0) !== 0
      ? [{ label: 'Round Off', value: money(bill.roundOff ?? 0) }]
      : []),
    { label: 'Total', value: money(bill.grandTotal), strong: true },
    ...(paid && creditsApplied < Number(bill.amountPaid)
      ? [{ label: 'Payments Made', value: `(-) ${money(Number(bill.amountPaid) - creditsApplied)}`, negative: true }]
      : []),
    ...(creditsApplied > 0
      ? [{ label: 'Credits Applied', value: `(-) ${money(creditsApplied)}`, negative: true }]
      : []),
    { label: 'Balance Due', value: money(bill.balanceDue), strong: true },
  ];

  const menuItem =
    'block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={bill.vendor?.displayName ?? '—'} />

        <PageHeader
          title={bill.billNumber}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {!isVoid && !paid && (
            <Link href={`/admin/bills/${bill.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {!isVoid && !settled && (
            <Button size="sm" variant="success" onClick={() => setDialog('payment')}>
              Record Payment
            </Button>
          )}
          {canReceive && (
            <Link
              href={`/admin/purchase-receives/new?vendorId=${bill.vendor?.id ?? ''}&billId=${bill.id}`}
            >
              <Button size="sm" variant="ghost">📦 Receive goods</Button>
            </Link>
          )}

          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>⋯</Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                  <button
                    className={menuItem}
                    onClick={() =>
                      act('Cloned', async () => {
                        const res = await api.post<{ data: { id: string } }>(`/bills/${id}/clone`);
                        router.push(`/admin/bills/${res.data.id}`);
                      })
                    }
                  >
                    Clone
                  </button>
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('credit'); }}>
                    Create Vendor Credits
                  </button>
                  <div className="my-1 border-t border-border" />
                  {!isVoid && (
                    <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('void'); }}>
                      Mark as Void
                    </button>
                  )}
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('delete'); }}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        {!isVoid && !settled && advanceAvailable > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
            <div className="min-w-0 text-sm">
              <div className="font-medium text-success">
                {money(advanceAvailable)} of vendor advance is unused
                {advances.length === 1 ? ` (${advances[0].paymentNumber})` : ` across ${advances.length} advances`}
              </div>
              <div className="text-xs text-success">
                Applying it settles {money(Math.min(advanceAvailable, Number(bill.balanceDue)))} of this bill
                {bill.status === 'DRAFT' ? ' and opens the draft' : ''}.
                {moreAdvances ? ' This vendor has many payments - older advances may not be listed here.' : ''}
              </div>
            </div>
            {can('payments-made:write') && (
              <Button size="sm" variant="success" onClick={applyAdvances} disabled={!!busy}>
                {busy === 'advance' && <Spinner />}
                Apply {money(Math.min(advanceAvailable, Number(bill.balanceDue)))}
              </Button>
            )}
          </div>
        )}

        <Card padded={false} className="mb-4">
          <button
            type="button"
            onClick={() => setPaymentsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="text-sm font-medium">
              Payments Made{' '}
              <span className="text-muted-foreground">
                {bill.paymentAllocations.length}
              </span>
            </span>
            <span className="text-muted-foreground">{paymentsOpen ? '▾' : '▸'}</span>
          </button>
          {paymentsOpen && (
            <Table>
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>PAYMENT #</Th>
                  <Th>REFERENCE#</Th>
                  <Th>PAYMENT MODE</Th>
                  <Th className="text-right">AMOUNT</Th>
                </tr>
              </thead>
              <tbody>
                {bill.paymentAllocations.length === 0 && (
                  <EmptyRow colSpan={5} message="No payments yet" />
                )}
                {bill.paymentAllocations.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/60">
                    <Td className="text-xs text-muted-foreground">
                      {shortDate(a.payment.paymentDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/payments-made/${a.payment.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {a.payment.paymentNumber}
                      </Link>
                      {a.payment.type === 'VENDOR_ADVANCE' && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          from advance
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">{a.payment.referenceNumber ?? '—'}</Td>
                    <Td className="text-xs">
                      {a.payment.paymentMode.replaceAll('_', ' ').toLowerCase()}
                    </Td>
                    <Td className="text-right font-medium">{money(a.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          {overdueDays > 0 ? (
            <span className="text-xs font-medium uppercase text-destructive">
              Overdue by {overdueDays.toLocaleString(numberLocale())} days
            </span>
          ) : (
            <Badge status={bill.status}>{bill.status.replaceAll('_', ' ')}</Badge>
          )}
          {bill.purchaseOrder && (
            <span className="text-muted-foreground">
              Purchase order:{' '}
              <Link
                href={`/admin/purchase-orders/${bill.purchaseOrder.id}`}
                className="font-medium text-gold-ink hover:underline"
              >
                {bill.purchaseOrder.poNumber}
              </Link>
            </span>
          )}
          {bill.isReverseCharge && <Badge tone="amber">Reverse charge</Badge>}
          {bill.sourceOfSupplyCode && bill.destinationOfSupplyCode && (
            <Badge tone={intraState ? 'green' : 'blue'}>
              {stateName(bill.sourceOfSupplyCode)} → {stateName(bill.destinationOfSupplyCode)}
            </Badge>
          )}

          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm italic text-muted-foreground">
            Show PDF View
            <span
              onClick={() => setShowPdf((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${showPdf ? 'bg-primary' : 'bg-border'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all ${showPdf ? 'left-[18px]' : 'left-0.5'}`}
              />
            </span>
          </label>
        </div>
      </div>

      {showPdf && (
        <div className="mx-auto mb-2 flex max-w-3xl justify-end print:hidden">
          <PdfCustomize
            template={template}
            onTemplateChange={setTemplate}
            org={org}
            onOrgSaved={setOrg}
          />
        </div>
      )}

      {showPdf ? (
        <DocumentPdf
          rateLabel="Purchase Price"
          template={template}
          title="BILL"
          ribbon={
            isVoid
              ? { label: 'Void', tone: 'red' }
              : settled
                ? { label: 'Paid', tone: 'green' }
                : overdueDays > 0
                  ? { label: 'Overdue', tone: 'red' }
                  : null
          }
          org={org}
          numberLabel="Bill#"
          numberValue={bill.billNumber}
          balanceLabel="Balance Due"
          balanceValue={money(bill.balanceDue)}
          party={{
            heading: 'Bill From',
            name: bill.vendor?.displayName ?? '—',
            lines: vendorAddress,
            gstin: bill.vendor?.gstin,
          }}
          meta={[
            { label: 'Bill Date', value: shortDate(bill.billDate) },
            ...(bill.dueDate ? [{ label: 'Due Date', value: shortDate(bill.dueDate) }] : []),
            { label: 'Terms', value: termName(bill.paymentTerms) },
            ...(bill.orderNumber ? [{ label: 'Order Number', value: bill.orderNumber }] : []),
          ]}
          lines={bill.lines.map((l) => ({
            name: l.itemName,
            description: l.description,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            rate: l.rate,
            amount: l.lineTotal,
          }))}
          totals={totals}
          notes={null}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <Card title="Items" padded={false}>
              <Table minWidth="760px">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Account</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Purchase price</Th>
                    <Th className="text-right">Tax</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <div className="flex items-start gap-2.5">
                          <Thumb url={l.imageUrl} label={l.itemName} />
                          <div className="min-w-0">
                            <div className="font-medium">{l.itemName}</div>
                        {l.description && (
                          <div className="text-xs text-muted-foreground">{l.description}</div>
                        )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-xs">{l.account ?? '—'}</Td>
                      <Td className="text-right">{Number(l.quantity)}</Td>
                      <Td className="text-right">{money(l.rate)}</Td>
                      <Td className="text-right">{Number(l.taxRate)}%</Td>
                      <Td className="text-right font-medium">{money(l.lineTotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
          <Card title="Summary">
            <dl className="space-y-1.5 text-sm">
              {totals.map((t) => (
                <div
                  key={t.label}
                  className={`flex justify-between ${t.strong ? 'border-t border-border pt-1.5 font-semibold' : ''}`}
                >
                  <dt className="text-muted-foreground">{t.label}</dt>
                  <dd className={t.negative ? 'text-destructive' : ''}>{t.value}</dd>
                </div>
              ))}
            </dl>
            {bill.notes && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">NOTES</div>
                <p className="whitespace-pre-line text-sm text-foreground">
                  {bill.notes}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={dialog === 'payment'}
        onClose={() => setDialog('')}
        title={`Payment for ${bill.billNumber}`}
        footer={
          <>
            <Button onClick={() => setDialog('')} disabled={!!busy}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!!busy || !Number(payForm.amount) || !payForm.paidThrough}
              onClick={() =>
                act('Payment recorded', () =>
                  api.post('/bills/payments', {
                    vendorId: bill.vendor!.id,
                    type: 'BILL_PAYMENT',
                    paymentDate: payForm.paymentDate,
                    amount: Number(payForm.amount),
                    paymentMode: payForm.paymentMode,
                    paidThrough: payForm.paidThrough.trim() || undefined,
                    referenceNumber: payForm.referenceNumber.trim() || undefined,
                    notes: payForm.notes.trim() || undefined,
                    allocations: [{ billId: bill.id, amount: Number(payForm.amount) }],
                  })
                )
              }
            >
              {busy === 'Payment recorded' && <Spinner className="border-card/40 border-t-card" />}
              Save as Paid
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Payment Made (INR)" required hint={`Balance due ${money(bill.balanceDue)}`}>
            <div className="flex items-center gap-2">
              <Input
                type="number" step="0.01" min="0" max={bill.balanceDue}
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() =>
                  setPayForm({ ...payForm, amount: String(Number(bill.balanceDue)) })
                }
              >
                Pay in Full
              </Button>
            </div>
          </Field>

          <Field label="Payment Mode">
            <Select
              value={payForm.paymentMode}
              onChange={(e) => setPayForm({ ...payForm, paymentMode: e.target.value })}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment Date" required>
              <Input
                type="date"
                value={payForm.paymentDate}
                onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
              />
            </Field>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Paid Through <span className="text-destructive">*</span>
              </span>
              <AccountSelect
                value={payForm.paidThrough}
                onChange={(paidThrough) => setPayForm({ ...payForm, paidThrough })}
                usage="payment"
                placeholder="Select an account"
              />
            </div>
          </div>

          <Field label={paymentReferenceField(payForm.paymentMode).label} hint={paymentReferenceField(payForm.paymentMode).hint}>
            <Input
              value={payForm.referenceNumber}
              onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
              placeholder={paymentReferenceField(payForm.paymentMode).placeholder}
              className={paymentReferenceField(payForm.paymentMode).mono ? 'font-mono' : ''}
            />
          </Field>
          <Field label="Notes" hint="Internal use. Not visible to the vendor.">
            <Textarea
              rows={2}
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={dialog === 'credit'}
        onClose={() => setDialog('')}
        danger={false}
        confirmLabel="Create credit"
        busy={!!busy}
        title="Create Vendor Credits"
        message={`A credit note will be raised against ${bill.vendor?.displayName ?? 'this vendor'} for the lines on ${bill.billNumber}. It offsets future bills rather than changing this one.`}
        onConfirm={() =>
          act('Vendor credit created', async () => {
            await api.post('/bills/credits', {
              vendorId: bill.vendor!.id,
              creditDate: todayIso(),
              reason: `Credit against ${bill.billNumber}`,
              status: 'OPEN',
              lines: bill.lines.map((l) => ({
                itemName: l.itemName,
                quantity: Number(l.quantity),
                rate: Number(l.rate),
                taxRate: Number(l.taxRate),
              })),
            });
          })
        }
      />

      <ConfirmModal
        open={dialog === 'void'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Bill voided', () => api.post(`/bills/${id}/void`))}
        title="Mark as Void"
        confirmLabel="Void bill"
        busy={!!busy}
        message={`${bill.billNumber} will be voided and the balance cleared from the vendor's payables. Refused if payments have been recorded.`}
      />

      <ConfirmModal
        open={dialog === 'delete'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Deleted', () => api.del(`/bills/${id}`), '/bills')}
        title="Delete bill"
        confirmLabel="Delete"
        busy={!!busy}
        message={`${bill.billNumber} will be removed and the purchase order's billed status recalculated. Refused once payments exist — void it instead.`}
      />
    </>
  );
}
