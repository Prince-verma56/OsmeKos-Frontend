'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage, type Paged } from '@/lib/api';
import { amountInWords } from '@/lib/amountInWords';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { ConfirmModal, Modal } from '@/components/Modal';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Spinner, Table, Td, Th,
} from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';

type AllocatedBill = {
  id: string; billNumber: string; billDate: string; dueDate: string | null;
  grandTotal: string; amountPaid: string; balanceDue: string; status: string;
};

type Payment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  amountApplied: string;
  tdsDeducted: string;
  tdsTaxName: string | null;
  paymentMode: string;
  referenceNumber: string | null;
  paidThrough: string | null;
  notes: string | null;
  type: 'BILL_PAYMENT' | 'VENDOR_ADVANCE';
  status?: string;
  unapplied: number;
  descriptionOfSupply: string | null;
  depositToAccount: string | null;
  isReverseCharge: boolean;
  sourceOfSupplyCode: string | null;
  destinationOfSupplyCode: string | null;
  vendor: {
    id: string; displayName: string; email: string | null;
    gstin: string | null; payablesBalance: string; unusedCredits: string;
    addresses?: {
      id: string; type: string; attention: string | null;
      line1: string; line2: string | null; city: string; state: string;
      stateCode: string | null; pincode: string; country: string;
    }[];
  } | null;
  allocations: { id: string; amount: string; bill: AllocatedBill }[];
};

type OpenBill = {
  id: string; billNumber: string; billDate: string; dueDate: string | null;
  grandTotal: string; balanceDue: string; status: string;
};

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Paid',
  APPLIED: 'Applied',
  PARTIALLY_APPLIED: 'Part applied',
  UNAPPLIED: 'Unapplied',
};

function statusOf(p: { type: string; status?: string; amount: string; unapplied: number }): string {
  if (p.status) return p.status;
  if (p.type === 'BILL_PAYMENT') return 'PAID';
  if (p.unapplied <= 0) return 'APPLIED';
  return p.unapplied >= Number(p.amount) ? 'UNAPPLIED' : 'PARTIALLY_APPLIED';
}

const modeLabel = (m: string) =>
  ({
    BANK_TRANSFER: 'Bank Transfer',
    CHEQUE: 'Cheque',
    UPI: 'UPI',
    CASH: 'Cash',
    CARD: 'Card',
    OTHER: 'Other',
  })[m] ?? m;

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPdf, setShowPdf] = usePdfView('payment_made');
  const [confirming, setConfirming] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [applying, setApplying] = useState(false);
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: Payment }>(`/bills/payments/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setPayment(res.data);
        setOrg(orgRes?.data ?? null);
        setError('');
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

  async function openApply() {
    if (!payment?.vendor) return;
    setApplying(true);
    setApplyError('');
    setDraft({});
    try {
      const res = await api.get<Paged<OpenBill>>('/bills', {
        vendorId: payment.vendor.id,
        view: 'unpaid',
        limit: 100,
      });
      setOpenBills(res.data);
    } catch (err) {
      setApplyError(errorMessage(err));
    }
  }

  async function submitApply() {
    const allocations = Object.entries(draft)
      .map(([billId, amount]) => ({ billId, amount: Number(amount) }))
      .filter((a) => a.amount > 0);
    if (!allocations.length) {
      setApplyError('Enter an amount against at least one bill');
      return;
    }
    setBusy(true);
    setApplyError('');
    try {
      await api.post(`/bills/payments/${id}/apply`, { allocations });
      setApplying(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setApplyError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api.del(`/bills/payments/${id}`);
      router.push('/admin/payments-made');
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!payment) return <ErrorBox message={error || 'Payment not found'} />;

  const isAdvance = payment.type === 'VENDOR_ADVANCE';

  const billing =
    payment.vendor?.addresses?.find((a) => a.type === 'BILLING') ??
    payment.vendor?.addresses?.[0] ??
    null;
  const vendorAddressLines = billing
    ? ([
        billing.attention,
        billing.line1,
        billing.line2,
        billing.city,
        [billing.pincode, billing.state].filter(Boolean).join(' '),
        billing.country,
      ].filter(Boolean) as string[])
    : [];

  const placeOfSupplyCode =
    payment.destinationOfSupplyCode ?? billing?.stateCode ?? null;
  const placeOfSupply = placeOfSupplyCode
    ? `${stateName(placeOfSupplyCode)} (${placeOfSupplyCode})`
    : '';
  const draftTotal = Object.values(draft).reduce((n, v) => n + (Number(v) || 0), 0);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Payment date', value: shortDate(payment.paymentDate) },
    { label: 'Payment mode', value: modeLabel(payment.paymentMode) },
    { label: 'Paid through', value: payment.paidThrough ?? '—' },
    { label: 'Reference#', value: payment.referenceNumber ?? '—' },
    ...(Number(payment.tdsDeducted) > 0
      ? [{
          label: payment.tdsTaxName ? `TDS deducted (${payment.tdsTaxName})` : 'TDS deducted',
          value: money(payment.tdsDeducted),
        }]
      : []),
    ...(isAdvance
      ? [
          { label: 'Deposited to', value: payment.depositToAccount ?? '—' },
          ...(payment.isReverseCharge
            ? [{ label: 'Reverse charge', value: 'Applicable' }]
            : []),
        ]
      : []),
  ];

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={payment.vendor?.displayName ?? '—'} />

        <PageHeader
          title={payment.paymentNumber}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={isAdvance ? 'purple' : 'gray'}>
                {isAdvance ? 'Vendor advance' : 'Bill payment'}
              </Badge>
              <Badge status={statusOf(payment)}>
                {STATUS_LABEL[statusOf(payment)] ?? statusOf(payment).replaceAll('_', ' ')}
              </Badge>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          <Link href={`/admin/payments-made/${payment.id}/edit`}>
            <Button size="sm" variant="ghost">✎ Edit</Button>
          </Link>
          {isAdvance && payment.unapplied > 0 && (
            <Button size="sm" variant="primary" onClick={openApply}>
              Apply to bill
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
            {busy && <Spinner />}
            Delete
          </Button>

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

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      </div>

      {showPdf ? (
        <DocumentPdf
          title={isAdvance ? 'VENDOR ADVANCE' : 'PAYMENTS MADE'}
          org={org}
          ribbon={{
            label: STATUS_LABEL[statusOf(payment)] ?? statusOf(payment),
            tone: statusOf(payment) === 'UNAPPLIED' ? 'amber' : 'green',
          }}
          fields={[
            { label: 'Payment#', value: payment.paymentNumber },
            { label: 'Payment Date', value: shortDate(payment.paymentDate) },
            ...(payment.referenceNumber
              ? [{ label: 'Reference Number', value: payment.referenceNumber }]
              : []),
            { label: 'Paid To', value: payment.vendor?.displayName ?? '—' },
            ...(placeOfSupply ? [{ label: 'Place Of Supply', value: placeOfSupply }] : []),
            { label: 'Payment Mode', value: modeLabel(payment.paymentMode) },
            ...(payment.paidThrough
              ? [{ label: 'Paid Through', value: payment.paidThrough }]
              : []),
            ...(Number(payment.tdsDeducted) > 0
              ? [{
                  label: 'TDS Deducted',
                  value: payment.tdsTaxName
                    ? `${money(payment.tdsDeducted)} (${payment.tdsTaxName})`
                    : money(payment.tdsDeducted),
                }]
              : []),
            ...(isAdvance && payment.descriptionOfSupply
              ? [{ label: 'Description Of Supply', value: payment.descriptionOfSupply }]
              : []),
            ...(isAdvance && payment.unapplied > 0
              ? [{ label: 'Unapplied Balance', value: money(payment.unapplied) }]
              : []),
            { label: 'Amount Paid In Words', value: amountInWords(payment.amount) },
          ]}
          amountBox={{ label: 'Amount Paid', value: money(payment.amount) }}
          party={
            payment.vendor
              ? {
                  heading: 'Paid To',
                  name: payment.vendor.displayName,
                  lines: vendorAddressLines,
                  gstin: payment.vendor.gstin,
                }
              : null
          }
          table={{
            title: 'Payment for',
            columns: [
              { label: 'Bill Number' },
              { label: 'Bill Date' },
              { label: 'Bill Amount', align: 'right' },
              { label: 'Payment Amount', align: 'right' },
            ],
            rows: payment.allocations.map((a) => ({
              cells: [
                a.bill.billNumber,
                shortDate(a.bill.billDate),
                money(a.bill.grandTotal),
                money(a.amount),
              ],
            })),
          }}
          notes={payment.notes}
          showSignature={false}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2 min-w-0">
            <Card title="Payment">
              <dl className="space-y-2 text-sm">
                {rows.map((r) => (
                  <div key={r.label} className="flex justify-between">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="text-foreground">{r.value}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Amount paid</dt>
                  <dd>{money(payment.amount)}</dd>
                </div>
              </dl>
              {payment.descriptionOfSupply && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    DESCRIPTION OF SUPPLY
                  </div>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {payment.descriptionOfSupply}
                  </p>
                </div>
              )}
              {payment.notes && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    NOTES
                  </div>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {payment.notes}
                  </p>
                </div>
              )}
            </Card>

            <Card
              title={isAdvance ? 'Where this advance has gone' : `Bills settled (${payment.allocations.length})`}
              padded={false}
            >
              <Table minWidth="620px">
                <thead>
                  <tr>
                    <Th>BILL#</Th>
                    <Th>STATUS</Th>
                    <Th className="text-right">BILL TOTAL</Th>
                    <Th className="text-right">STILL DUE</Th>
                    <Th className="text-right">THIS PAYMENT</Th>
                  </tr>
                </thead>
                <tbody>
                  {payment.allocations.length === 0 && (
                    <EmptyRow
                      colSpan={5}
                      message={
                        isAdvance
                          ? 'Not applied to any bill yet — the whole amount is still credit'
                          : 'Not applied to any bill'
                      }
                    />
                  )}
                  {payment.allocations.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/60">
                      <Td>
                        <Link
                          href={`/admin/bills/${a.bill.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {a.bill.billNumber}
                        </Link>
                      </Td>
                      <Td>
                        <Badge status={a.bill.status}>
                          {a.bill.status.replaceAll('_', ' ')}
                        </Badge>
                      </Td>
                      <Td className="text-right">{money(a.bill.grandTotal)}</Td>
                      <Td className="text-right">{money(a.bill.balanceDue)}</Td>
                      <Td className="text-right font-medium">{money(a.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {isAdvance && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Still unapplied</span>
                  <span className="font-semibold">{money(payment.unapplied)}</span>
                </div>
              )}
            </Card>
          </div>

          <Card title="Vendor">
            {payment.vendor ? (
              <>
                <Link
                  href={`/admin/vendors/${payment.vendor.id}`}
                  className="font-medium text-gold-ink hover:underline"
                >
                  {payment.vendor.displayName}
                </Link>
                {vendorAddressLines.length > 0 && (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                    {vendorAddressLines.join('\n')}
                  </p>
                )}
                <dl className="mt-3 space-y-1.5 text-sm">
                  {payment.vendor.gstin && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">GSTIN</dt>
                      <dd className="font-mono text-xs">{payment.vendor.gstin}</dd>
                    </div>
                  )}
                  {payment.vendor.email && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="text-xs">{payment.vendor.email}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <dt className="text-muted-foreground">Still payable</dt>
                    <dd className="font-semibold">{money(payment.vendor.payablesBalance)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Unused credits</dt>
                    <dd className="font-semibold">{money(payment.vendor.unusedCredits)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No vendor on this payment.</p>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={applying}
        onClose={() => setApplying(false)}
        title={`Apply ${money(payment.unapplied)} to bills`}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplying(false)}>Cancel</Button>
            <Button variant="primary" onClick={submitApply} disabled={busy}>
              {busy && <Spinner />}
              Apply {money(draftTotal)}
            </Button>
          </>
        }
      >
        {applyError && <div className="mb-3"><ErrorBox message={applyError} /></div>}
        <p className="mb-3 text-sm text-muted-foreground">
          This draws down the advance. Anything you leave blank stays as credit against the
          vendor.
        </p>
        <Table minWidth="480px">
          <thead>
            <tr>
              <Th>BILL#</Th>
              <Th>DATE</Th>
              <Th className="text-right">STILL DUE</Th>
              <Th className="text-right">APPLY</Th>
            </tr>
          </thead>
          <tbody>
            {openBills.length === 0 && (
              <EmptyRow colSpan={4} message="This vendor has no unpaid bills" />
            )}
            {openBills.map((b) => (
              <tr key={b.id}>
                <Td className="font-medium">{b.billNumber}</Td>
                <Td className="text-xs text-muted-foreground">
                  {shortDate(b.billDate)}
                </Td>
                <Td className="text-right">{money(b.balanceDue)}</Td>
                <Td className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={b.balanceDue}
                    className="w-28 text-right"
                    value={draft[b.id] ?? ''}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [b.id]: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {draftTotal > payment.unapplied && (
          <p className="mt-3 text-sm text-destructive">
            That is {money(draftTotal - payment.unapplied)} more than this advance has left.
          </p>
        )}
      </Modal>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        title="Delete payment"
        confirmLabel="Delete"
        busy={busy}
        message={
          payment.allocations.length
            ? `${payment.paymentNumber} will be reversed, and the ${payment.allocations.length} bill(s) it settled go back to owing that money.`
            : `${payment.paymentNumber} will be reversed and the vendor's credit balance recalculated.`
        }
      />
    </>
  );
}
