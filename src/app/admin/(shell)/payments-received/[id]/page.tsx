'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { amountInWords } from '@/lib/amountInWords';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { ConfirmModal, Modal } from '@/components/Modal';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Spinner, Table, Td, Th,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { PageCrumb } from '@/lib/crumbs';

type AllocatedInvoice = {
  id: string; invoiceNumber: string; invoiceDate: string; dueDate: string | null;
  grandTotal: string; amountPaid: string; balanceDue: string; status: string;
};

type Address = {
  id: string; type: string; attention: string | null;
  line1: string; line2: string | null; city: string; state: string;
  stateCode: string | null; pincode: string; country: string; phone?: string | null;
};

type Payment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  amountApplied: string;
  bankCharges: string;
  tdsDeducted: string;
  tdsTaxName: string | null;
  paymentMode: string;
  referenceNumber: string | null;
  sourceOrderId?: string | null;
  depositTo: string | null;
  notes: string | null;
  type: 'INVOICE_PAYMENT' | 'CUSTOMER_ADVANCE';
  status?: string;
  unapplied: number;
  descriptionOfSupply: string | null;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  advanceTaxName: string | null;
  advanceTaxAmount: string;
  customer: {
    id: string; displayName: string | null; email: string | null; phone: string | null;
    b2bAccount?: { companyName: string | null; gstin: string | null } | null;
    addresses?: Address[];
  } | null;
  allocations: { id: string; amount: string; invoice: AllocatedInvoice }[];
};

type OpenInvoice = {
  id: string; invoiceNumber: string; invoiceDate: string; dueDate: string | null;
  grandTotal: string; balanceDue: string; status: string;
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Received',
  APPLIED: 'Applied',
  PARTIALLY_APPLIED: 'Part applied',
  UNAPPLIED: 'Unapplied',
};

const MODE_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CASH: 'Cash',
  CARD: 'Card',
  OTHER: 'Other',
};

const modeLabel = (m: string) => MODE_LABEL[m] ?? m.replaceAll('_', ' ').toLowerCase();

function statusOf(p: Payment): string {
  if (p.status) return p.status;
  if (p.type === 'INVOICE_PAYMENT') return 'RECEIVED';
  if (p.unapplied <= 0) return 'APPLIED';
  return p.unapplied >= Number(p.amount) ? 'UNAPPLIED' : 'PARTIALLY_APPLIED';
}

export default function PaymentReceivedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [showPdf, setShowPdf] = usePdfView('payment_received');
  const [dialog, setDialog] = useState<'' | 'apply' | 'delete'>('');

  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [applyRows, setApplyRows] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: Payment }>(`/payments-received/${id}`),
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

  useEffect(() => {
    if (dialog !== 'apply' || !payment?.customer?.id) return;
    let cancelled = false;
    api
      .get<{ data: OpenInvoice[] }>(`/payments-received/open-invoices/${payment.customer.id}`)
      .then((r) => {
        if (!cancelled) setOpenInvoices(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dialog, payment?.customer?.id]);

  async function act(label: string, fn: () => Promise<unknown>, redirect?: string) {
    setBusy(label);
    setError('');
    try {
      await fn();
      if (redirect) {
        router.push(redirect);
        return;
      }
      toast.success(label);
      setDialog('');
      setApplyRows({});
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  if (loading) return <Loading />;
  if (!payment) {
    return (
      <ErrorBox
        message={error || 'Payment not found'}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const isAdvance = payment.type === 'CUSTOMER_ADVANCE';
  const status = statusOf(payment);

  const billing =
    payment.customer?.addresses?.find((a) => a.type === 'BILLING') ??
    payment.customer?.addresses?.[0] ??
    null;

  const customerAddressLines = billing
    ? ([
        billing.line1,
        billing.line2,
        billing.city,
        [billing.state, billing.pincode].filter(Boolean).join(' '),
        billing.country,
      ].filter(Boolean) as string[])
    : [];

  const placeOfSupply = payment.placeOfSupplyCode
    ? `${stateName(payment.placeOfSupplyCode)} (${payment.placeOfSupplyCode})`
    : '';

  const applyTotal = Math.round(Object.values(applyRows).reduce((n, v) => n + Number(v || 0), 0) * 100) / 100;

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={payment.customer?.displayName ?? '—'} />

        <PageHeader
          title={payment.paymentNumber}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {payment.sourceOrderId ? (
            <Button size="sm" variant="ghost" disabled title="Recorded from the payment taken on the order - change it there">
              ✎ Edit
            </Button>
          ) : (
            <Link href={`/admin/payments-received/${payment.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {payment.unapplied > 0 && (
            <Button size="sm" variant="primary" onClick={() => setDialog('apply')}>
              Apply to Invoices
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDialog('delete')}>
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

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Badge tone={isAdvance ? 'purple' : 'gray'}>
            {isAdvance ? 'Customer advance' : 'Invoice payment'}
          </Badge>
          <Badge status={status}>{STATUS_LABEL[status] ?? status.replaceAll('_', ' ')}</Badge>
          {payment.unapplied > 0 && (
            <span className="text-muted-foreground">
              {money(payment.unapplied)} still unapplied
            </span>
          )}
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      </div>

      {showPdf ? (
        <DocumentPdf
          title={isAdvance ? 'CUSTOMER ADVANCE' : 'PAYMENT RECEIPT'}
          org={org}
          ribbon={{
            label: STATUS_LABEL[status] ?? status,
            tone: status === 'UNAPPLIED' ? 'amber' : 'green',
          }}
          fields={[
            { label: 'Payment#', value: payment.paymentNumber },
            { label: 'Payment Date', value: shortDate(payment.paymentDate) },
            ...(payment.referenceNumber
              ? [{ label: 'Reference Number', value: payment.referenceNumber }]
              : []),
            { label: 'Received From', value: payment.customer?.displayName ?? '—' },
            ...(placeOfSupply ? [{ label: 'Place Of Supply', value: placeOfSupply }] : []),
            { label: 'Payment Mode', value: modeLabel(payment.paymentMode) },
            ...(payment.depositTo ? [{ label: 'Deposited To', value: payment.depositTo }] : []),
            ...(Number(payment.bankCharges) > 0
              ? [{ label: 'Bank Charges', value: money(payment.bankCharges) }]
              : []),
            ...(Number(payment.tdsDeducted) > 0
              ? [{
                  label: 'TDS Withheld',
                  value: payment.tdsTaxName
                    ? `${money(payment.tdsDeducted)} (${payment.tdsTaxName})`
                    : money(payment.tdsDeducted),
                }]
              : []),
            ...(isAdvance && payment.descriptionOfSupply
              ? [{ label: 'Description Of Supply', value: payment.descriptionOfSupply }]
              : []),
            ...(isAdvance && Number(payment.advanceTaxAmount) > 0
              ? [{
                  label: 'Tax On Advance',
                  value: `${money(payment.advanceTaxAmount)}${payment.advanceTaxName ? ` (${payment.advanceTaxName})` : ''}`,
                }]
              : []),
            ...(payment.unapplied > 0
              ? [{ label: 'Unapplied Balance', value: money(payment.unapplied) }]
              : []),
            { label: 'Amount Received In Words', value: amountInWords(payment.amount) },
          ]}
          amountBox={{ label: 'Amount Received', value: money(payment.amount) }}
          party={
            payment.customer
              ? {
                  heading: 'Received From',
                  name: payment.customer.displayName ?? 'Customer',
                  lines: customerAddressLines,
                  gstin: payment.customer.b2bAccount?.gstin,
                }
              : null
          }
          table={{
            title: 'Payment for',
            columns: [
              { label: 'Invoice Number' },
              { label: 'Invoice Date' },
              { label: 'Invoice Amount', align: 'right' },
              { label: 'Payment Amount', align: 'right' },
            ],
            rows: payment.allocations.map((a) => ({
              cells: [
                a.invoice.invoiceNumber,
                shortDate(a.invoice.invoiceDate),
                money(a.invoice.grandTotal),
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
            <Card title="Settled invoices" padded={false}>
              <Table minWidth="700px">
                <thead>
                  <tr>
                    <Th>INVOICE#</Th>
                    <Th>DATE</Th>
                    <Th className="text-right">INVOICE AMOUNT</Th>
                    <Th className="text-right">APPLIED</Th>
                    <Th className="text-right">BALANCE</Th>
                  </tr>
                </thead>
                <tbody>
                  {payment.allocations.length === 0 && (
                    <EmptyRow
                      colSpan={5}
                      message={
                        isAdvance
                          ? 'Not applied to anything yet — use Apply to Invoices'
                          : 'Nothing allocated'
                      }
                    />
                  )}
                  {payment.allocations.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/60">
                      <Td>
                        <Link
                          href={`/admin/invoices/${a.invoice.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {a.invoice.invoiceNumber}
                        </Link>
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {shortDate(a.invoice.invoiceDate)}
                      </Td>
                      <Td className="text-right">{money(a.invoice.grandTotal)}</Td>
                      <Td className="text-right font-medium">{money(a.amount)}</Td>
                      <Td className="text-right">{money(a.invoice.balanceDue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            {payment.notes && (
              <Card title="Notes">
                <p className="whitespace-pre-line text-sm text-foreground">
                  {payment.notes}
                </p>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card title="Payment">
              <dl className="space-y-2 text-sm">
                {[
                  ['Customer', payment.customer?.displayName ?? '—'],
                  ['Date', shortDate(payment.paymentDate)],
                  ['Mode', modeLabel(payment.paymentMode)],
                  ['Deposited to', payment.depositTo ?? '—'],
                  ['Reference#', payment.referenceNumber ?? '—'],
                  ['Amount received', money(payment.amount)],
                  ...(Number(payment.bankCharges) > 0
                    ? [['Bank charges', money(payment.bankCharges)]]
                    : []),
                  ...(Number(payment.tdsDeducted) > 0
                    ? [['TDS withheld', money(payment.tdsDeducted)]]
                    : []),
                  ['Applied', money(payment.amountApplied)],
                  ...(isAdvance || payment.unapplied > 0 ? [['Unapplied', money(payment.unapplied)]] : []),
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={dialog === 'apply'}
        onClose={() => setDialog('')}
        title={`Apply ${payment.paymentNumber} to invoices`}
        width="max-w-3xl"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {money(payment.unapplied)} of this payment is still unapplied.
        </p>
        <Table minWidth="640px">
          <thead>
            <tr>
              <Th>INVOICE#</Th>
              <Th>DATE</Th>
              <Th className="text-right">AMOUNT DUE</Th>
              <Th className="text-right">APPLY</Th>
            </tr>
          </thead>
          <tbody>
            {openInvoices.length === 0 && (
              <EmptyRow colSpan={4} message="Nothing outstanding for this customer" />
            )}
            {openInvoices.map((i) => (
              <tr key={i.id}>
                <Td className="font-medium">{i.invoiceNumber}</Td>
                <Td className="text-xs text-muted-foreground">
                  {shortDate(i.invoiceDate)}
                </Td>
                <Td className="text-right">{money(i.balanceDue)}</Td>
                <Td>
                  <div className="flex flex-col items-end gap-0.5">
                    <Input
                      type="number" step="0.01" min="0"
                      value={applyRows[i.id] ?? ''}
                      onChange={(e) =>
                        setApplyRows((r) => ({ ...r, [i.id]: e.target.value }))
                      }
                      className="w-28 text-right"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setApplyRows((r) => ({
                          ...r,
                          [i.id]: String(Math.min(Number(i.balanceDue), payment.unapplied)),
                        }))
                      }
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

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!applyTotal || applyTotal > payment.unapplied || !!busy}
            onClick={() =>
              act('Applied', () =>
                api.post(`/payments-received/${payment.id}/apply`, {
                  allocations: Object.entries(applyRows)
                    .filter(([, v]) => Number(v) > 0)
                    .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) })),
                })
              )
            }
          >
            {busy === 'Applied' && <Spinner className="border-card/40 border-t-card" />}
            Apply {applyTotal > 0 ? money(applyTotal) : ''}
          </Button>
          <Button variant="ghost" onClick={() => setDialog('')}>Cancel</Button>
          {applyTotal > payment.unapplied && (
            <span className="text-xs text-destructive">
              That is more than the {money(payment.unapplied)} still unapplied.
            </span>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={dialog === 'delete'}
        title="Delete this payment?"
        message={`${payment.paymentNumber} will be removed and every invoice it settled will reopen.`}
        confirmLabel="Delete"
        busy={busy === 'Deleted'}
        onClose={() => setDialog('')}
        onConfirm={() =>
          act('Deleted', () => api.del(`/payments-received/${payment.id}`), '/payments-received')
        }
      />
    </>
  );
}
