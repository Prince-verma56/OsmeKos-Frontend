'use client';

import { usePdfView } from '@/lib/pdfView';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import { OffMrpCell } from '@/components/OffMrp';
import { lineDiscountText, mrpPdfTotals } from '@/lib/mrp';
import { stateName } from '@/lib/states';
import { amountInWords } from '@/lib/amountInWords';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { PdfCustomize, type PdfTemplate } from '@/components/PdfCustomize';
import { ConfirmModal } from '@/components/Modal';
import { usePaymentTerms } from '@/components/PaymentTermSelect';
import {
  Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader,
  Spinner, Table, Td, Th,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { Thumb } from '@/components/SearchSelect';
import { CollectPayment } from '@/components/CollectPayment';
import { EmailTrail } from '@/components/EmailTrail';
import { upiLink, usePaymentOptions, useQrDataUrl } from '@/lib/payments';
import { PageCrumb } from '@/lib/crumbs';

type InvoiceLine = {
  id: string;
  itemName: string;
  imageUrl?: string | null;
  description: string | null;
  sku: string | null;
  hsnCode: string | null;
  unit: string;
  quantity: string;
  rate: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
  mrp?: string | null;
  discountPercent?: string | null;
  order?: { id: string; orderNumber: string; placedAt?: string } | null;
};

const lineDiscountLabel = (l: { discountPercent?: string | null; discountAmount: string }) => {
  if (l.discountPercent && Number(l.discountPercent) > 0) return `${Number(l.discountPercent)}%`;
  if (Number(l.discountAmount) > 0) return money(l.discountAmount);
  return '—';
};

type Address = {
  attention?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  phone?: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  referenceNumber: string | null;
  subject: string | null;
  status: string;
  paymentTerms: string;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  gstin: string | null;
  gstTreatment: string;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  taxTreatment: 'EXCLUSIVE' | 'INCLUSIVE';
  discountLevel?: 'TRANSACTION' | 'LINE_ITEM';
  discountPercent: string | null;
  subtotal: string;
  discountTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  taxTotal: string;
  taxWithholdingType: 'TDS' | 'TCS' | null;
  taxWithholdingName: string | null;
  taxWithholdingAmount: string;
  shippingCharge: string;
  codCharge?: string;
  adjustment: string;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  grandTotal: string;
  amountPaid: string;
  creditsApplied: string;
  balanceDue: string;
  customerNotes: string | null;
  terms: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  upiId: string | null;
  paymentLinkUrl: string | null;
  paymentLinkId: string | null;
  paymentLinkAmount: string | null;
  paymentLinkCreatedAt: string | null;
  previousBalance: string | null;
  previousCredits: string | null;
  previousBalanceAt: string | null;
  overdueByDays: number | null;
  customer: {
    id: string; displayName: string | null; email: string | null; phone: string | null;
    customerType?: string | null;
    b2bAccount?: { id: string } | null;
  } | null;
  order: { id: string; orderNumber: string } | null;
  mirrorOrder?: { id: string; orderNumber: string; orderStatus: string } | null;
  lines: InvoiceLine[];
};

const addressLines = (a: Address | null | undefined): string[] =>
  a
    ? ([
        a.attention,
        a.line1,
        a.line2,
        a.city,
        [a.state, a.pincode].filter(Boolean).join(' '),
        a.country ?? 'India',
        a.phone ? `Phone: ${a.phone}` : null,
      ].filter(Boolean) as string[])
    : [];

type EwayBill = {
  id: string;
  ewayBillNumber: string | null;
  status: string;
  generatedAt: string | null;
  validUntil: string | null;
  vehicleNumber: string | null;
  transporter: string | null;
  distanceKm: number;
};

const EWAY_THRESHOLD = 50000;

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { label: termName } = usePaymentTerms();
  const router = useRouter();

  const [inv, setInv] = useState<Invoice | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);

  const [showPdf, setShowPdf] = usePdfView('invoice');
  const [template, setTemplate] = useState<PdfTemplate>('standard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'' | 'void' | 'delete'>('');

  const [eway, setEway] = useState<EwayBill | null>(null);
  const [ewayForm, setEwayForm] = useState({
    ewayBillNumber: '', generatedAt: '', validUntil: '', vehicleNumber: '', distanceKm: '',
  });
  const [ewayOpen, setEwayOpen] = useState(false);
  const [ewaySaving, setEwaySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes, ewayRes] = await Promise.all([
          api.get<{ data: Invoice }>(`/invoices/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
          api
            .get<{ data: EwayBill[] }>('/eway-bills', { documentType: 'INVOICE', limit: 100 })
            .catch(() => ({ data: [] as EwayBill[] })),
        ]);
        if (cancelled) return;
        setInv(res.data);
        setOrg(orgRes?.data ?? null);
        setEway(
          (ewayRes.data ?? []).find(
            (b) => (b as EwayBill & { invoice?: { id: string } }).invoice?.id === id
          ) ?? null
        );
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

  const [advances, setAdvances] = useState<{ id: string; paymentNumber: string; paymentDate: string; unapplied: number }[]>([]);
  const advanceCustomer = inv && inv.status !== 'VOID' && inv.status !== 'DRAFT' && Number(inv.balanceDue) > 0
    ? inv.customer?.id ?? null
    : null;

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!advanceCustomer) {
        setAdvances([]);
        return;
      }
      const r = await api
        .get<{ data: { id: string; paymentNumber: string; paymentDate: string; unapplied: number }[] }>(
          '/payments-received',
          { customerId: advanceCustomer, view: 'unapplied', limit: 100 }
        )
        .catch(() => null);
      if (!cancelled) setAdvances((r?.data ?? []).filter((p) => Number(p.unapplied) > 0));
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [advanceCustomer, reloadKey]);

  async function applyAdvances() {
    if (!inv) return;
    setBusy('advance');
    let applied = 0;
    try {
      let left = Number(inv.balanceDue);
      const oldestFirst = [...advances].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
      for (const a of oldestFirst) {
        if (left <= 0.004) break;
        const amount = Math.round(Math.min(Number(a.unapplied), left) * 100) / 100;
        if (amount <= 0) continue;
        await api.post(`/payments-received/${a.id}/apply`, { allocations: [{ invoiceId: inv.id, amount }] });
        left -= amount;
        applied += amount;
      }
      toast.success(`${money(applied)} of the advance applied to ${inv.invoiceNumber}`);
    } catch (err) {
      toast.error(
        applied > 0 ? `${money(applied)} was applied, then it stopped: ${errorMessage(err)}` : errorMessage(err)
      );
    } finally {
      setBusy('');
      setReloadKey((k) => k + 1);
    }
  }

  const payOptions = usePaymentOptions();
  const invDue = inv && inv.status !== 'VOID' ? Number(inv.balanceDue) : 0;
  const invVpa = inv?.upiId || payOptions?.upiId || null;
  const pdfUpi =
    invVpa && invDue > 0
      ? upiLink({ vpa: invVpa, name: payOptions?.payeeName, amount: invDue, note: `invoice ${inv?.invoiceNumber}` })
      : null;
  const pdfQr = useQrDataUrl(pdfUpi);

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
  if (!inv) {
    return (
      <ErrorBox
        message={error || 'Invoice not found'}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const isVoid = inv.status === 'VOID';
  const isDraft = inv.status === 'DRAFT';
  const settled = Number(inv.balanceDue) <= 0 && !isDraft;
  const touched = Number(inv.amountPaid) > 0 || Number(inv.creditsApplied) > 0;
  const overdueDays = inv.overdueByDays ?? 0;

  const intraState =
    !!inv.sourceOfSupplyCode &&
    !!inv.placeOfSupplyCode &&
    inv.sourceOfSupplyCode === inv.placeOfSupplyCode;

  const rates = [...new Set(inv.lines.map((l) => Number(l.taxRate)))];
  const uniformRate = rates.length === 1 ? rates[0] : null;
  const hasMrp = inv.lines.some((l) => l.mrp != null && Number(l.mrp) > 0);
  const hasLineDiscount = inv.discountLevel === 'LINE_ITEM' && inv.lines.some((l) => Number(l.discountAmount) > 0);
  const lineCols = 5 + (hasMrp ? 2 : 0) + (hasLineDiscount ? 1 : 0);
  const mrpLines = inv.lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: Number(l.lineTotal), taxPercent: Number(l.taxRate) }));

  const totals = [
    ...mrpPdfTotals(mrpLines, money),
    { label: 'Sub Total', value: money(Number(inv.subtotal) + Number(inv.discountTotal)) },
    ...(Number(inv.discountTotal) > 0
      ? [{
          label: `Discount${inv.discountPercent && Number(inv.discountPercent) > 0 ? ` (${Number(inv.discountPercent)}%)` : ''}`,
          value: `(-) ${money(inv.discountTotal)}`,
          negative: true,
        }]
      : []),
    { label: 'Total Taxable Amount', value: money(inv.subtotal) },
    ...(intraState
      ? [
          { label: `CGST${uniformRate != null ? ` (${uniformRate / 2}%)` : ''}`, value: money(inv.cgstTotal) },
          { label: `SGST${uniformRate != null ? ` (${uniformRate / 2}%)` : ''}`, value: money(inv.sgstTotal) },
        ]
      : [{ label: `IGST${uniformRate != null ? ` (${uniformRate}%)` : ''}`, value: money(inv.igstTotal) }]),
    ...(Number(inv.shippingCharge) > 0
      ? [{ label: 'Shipping Charge', value: money(inv.shippingCharge) }]
      : []),
    ...(Number(inv.codCharge ?? 0) > 0
      ? [{ label: 'COD Charge', value: money(inv.codCharge ?? 0) }]
      : []),
    ...(Number(inv.adjustment) !== 0
      ? [{ label: inv.adjustmentLabel || 'Adjustment', value: money(inv.adjustment) }]
      : []),
    ...(inv.taxWithholdingType
      ? [{
          label: `${inv.taxWithholdingType}${inv.taxWithholdingName ? ` (${inv.taxWithholdingName})` : ''}`,
          value: `${inv.taxWithholdingType === 'TDS' ? '(-) ' : '(+) '}${money(inv.taxWithholdingAmount)}`,
          negative: inv.taxWithholdingType === 'TDS',
        }]
      : []),
    ...(Number(inv.roundOff ?? 0) !== 0
      ? [{ label: 'Round Off', value: money(inv.roundOff ?? 0) }]
      : []),
    { label: 'Total', value: money(inv.grandTotal), strong: true },
    ...(Number(inv.amountPaid) > 0
      ? [{ label: 'Payment Made', value: `(-) ${money(inv.amountPaid)}`, negative: true }]
      : []),
    ...(Number(inv.creditsApplied) > 0
      ? [{ label: 'Credits Applied', value: `(-) ${money(inv.creditsApplied)}`, negative: true }]
      : []),
    { label: 'Balance Due', value: money(inv.balanceDue), strong: true },
  ];

  const needsEway =
    Number(inv.grandTotal) > EWAY_THRESHOLD && !['DRAFT', 'VOID'].includes(inv.status);

  const bankDetails = inv.bankName
    ? [
        { label: 'Bank', value: [inv.bankName, inv.bankBranch].filter(Boolean).join(', ') },
        ...(inv.bankAccountNumber ? [{ label: 'A/C No.', value: inv.bankAccountNumber }] : []),
        ...(inv.bankIfscCode ? [{ label: 'IFSC', value: inv.bankIfscCode }] : []),
        ...(inv.upiId ? [{ label: 'UPI', value: inv.upiId }] : []),
      ]
    : null;

  const menuItem =
    'block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  const b2bCustomer = inv.customer?.customerType === 'B2B' || !!inv.customer?.b2bAccount;
  const billedOrders = [
    ...new Map(
      [inv.order, ...inv.lines.map((l) => l.order)]
        .filter((o): o is { id: string; orderNumber: string } => !!o)
        .map((o) => [o.id, o])
    ).values(),
  ];
  const manyOrders = billedOrders.length > 1;
  const groupOf = (l?: InvoiceLine) =>
    !manyOrders || !l
      ? null
      : l.order
        ? [`Order ${l.order.orderNumber}`, l.order.placedAt ? shortDate(l.order.placedAt) : null].filter(Boolean).join(' · ')
        : 'Other items';
  const previous = inv.previousBalance != null && !isVoid ? Number(inv.previousBalance) : null;
  const previousCredits = Number(inv.previousCredits ?? 0);
  const thisDue = Number(inv.balanceDue);
  const accountSummary =
    previous != null
      ? {
          title: 'Account summary',
          rows: [
            { label: 'Previous balance', value: money(previous) },
            ...(previousCredits > 0
              ? [{ label: 'Less unused credits', value: `(-) ${money(previousCredits)}` }]
              : []),
            { label: 'This invoice', value: money(thisDue) },
            { label: 'Total payable', value: money(previous - previousCredits + thisDue), strong: true },
          ],
          note:
            `As on ${shortDate(inv.previousBalanceAt)}. The previous balance is shown for your ` +
            'information and is not part of this tax invoice.',
        }
      : null;
  const setPrevious = (show: boolean) =>
    act(show ? 'Previous balance updated' : 'Previous balance taken off', () =>
      api.post(`/invoices/${inv.id}/previous-balance`, { show })
    );

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={inv.customer?.displayName ?? '—'} />

        <PageHeader
          title={inv.invoiceNumber}
          subtitle={inv.subject ?? undefined}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {!isVoid && !touched && (
            <Link href={`/admin/invoices/${inv.id}/edit`}>
              <Button size="sm">✎ Edit</Button>
            </Link>
          )}
          <Link href={`/admin/invoices/new?duplicate=${inv.id}`}>
            <Button size="sm" variant="ghost">⧉ Duplicate</Button>
          </Link>
          {!isVoid && inv.status !== 'DRAFT' && (
            <Link href={`/admin/credit-notes/new?invoiceId=${inv.id}`}>
              <Button size="sm" variant="ghost">↩ Credit note</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {!isDraft && !isVoid && (
            <Button
              size="sm"
              variant="ghost"
              disabled={!!busy}
              onClick={() => act('Invoice emailed', () => api.post(`/invoices/${inv.id}/email`))}
            >
              ✉ Email
            </Button>
          )}
          {isDraft && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                act('Marked as sent', () => api.post(`/invoices/${inv.id}/send`))
              }
            >
              Mark as Sent
            </Button>
          )}

          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>⋯</Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                  {b2bCustomer && !isVoid && (
                    <button className={menuItem} onClick={() => setPrevious(true)}>
                      {previous != null ? 'Update previous balance' : 'Show previous balance'}
                    </button>
                  )}
                  {previous != null && (
                    <button className={menuItem} onClick={() => setPrevious(false)}>
                      Take off previous balance
                    </button>
                  )}
                  {!isVoid && (
                    <button
                      className={menuItem}
                      onClick={() => { setMenuOpen(false); setDialog('void'); }}
                    >
                      Mark as Void
                    </button>
                  )}
                  <button
                    className={menuItem}
                    onClick={() => { setMenuOpen(false); setDialog('delete'); }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          {overdueDays > 0 ? (
            <span className="text-xs font-medium uppercase text-destructive">
              Overdue by {overdueDays.toLocaleString(numberLocale())} days
            </span>
          ) : (
            <Badge status={inv.status}>{inv.status.replaceAll('_', ' ')}</Badge>
          )}
          {billedOrders.length > 0 && (
            <span className="text-muted-foreground">
              Sales order{manyOrders ? 's' : ''}:{' '}
              {billedOrders.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ', '}
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-medium text-gold-ink hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                </span>
              ))}
            </span>
          )}
          {billedOrders.length === 0 && inv.mirrorOrder && (
            <span className="text-muted-foreground">
              Order made from this invoice:{' '}
              <Link href={`/admin/orders/${inv.mirrorOrder.id}`} className="font-medium text-gold-ink hover:underline">
                {inv.mirrorOrder.orderNumber}
              </Link>
              {inv.mirrorOrder.orderStatus === 'CANCELLED' && ' (cancelled)'}
            </span>
          )}
          {inv.sourceOfSupplyCode && inv.placeOfSupplyCode && (
            <Badge tone={intraState ? 'green' : 'blue'}>
              {stateName(inv.sourceOfSupplyCode)} → {stateName(inv.placeOfSupplyCode)}
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

      {advances.length > 0 && !isVoid && !isDraft && Number(inv.balanceDue) > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 print:hidden">
          <div className="min-w-0 text-sm">
            <div className="font-medium text-success">
              {money(advances.reduce((n, a) => n + Number(a.unapplied), 0))} of this customer&apos;s advance is unused
              {advances.length === 1 ? ` (${advances[0].paymentNumber})` : ` across ${advances.length} payments`}
            </div>
            <div className="text-xs text-success">
              Applying it settles{' '}
              {money(Math.min(advances.reduce((n, a) => n + Number(a.unapplied), 0), Number(inv.balanceDue)))} of this
              invoice, oldest payment first.
            </div>
          </div>
          <Button size="sm" variant="success" onClick={applyAdvances} disabled={!!busy}>
            {busy === 'advance' && <Spinner />}
            Apply {money(Math.min(advances.reduce((n, a) => n + Number(a.unapplied), 0), Number(inv.balanceDue)))}
          </Button>
        </div>
      )}

      {showPdf && (
        <div className="mx-auto mb-2 flex max-w-3xl justify-end print:hidden">
          <PdfCustomize
            template={template}
            onTemplateChange={setTemplate}
            org={org}
            onOrgSaved={setOrg}
            termsDocType="invoice"
          />
        </div>
      )}

      {invDue > 0 && (
        <div className="mb-5 print:hidden">
          <CollectPayment
            kind="invoices"
            wide
            upiId={inv.upiId}
            doc={{
              id: inv.id,
              number: inv.invoiceNumber,
              balanceDue: inv.balanceDue,
              paymentLinkUrl: inv.paymentLinkUrl,
              paymentLinkId: inv.paymentLinkId,
              paymentLinkAmount: inv.paymentLinkAmount,
              paymentLinkCreatedAt: inv.paymentLinkCreatedAt,
              customerName: inv.customer?.displayName ?? null,
              customerPhone: inv.customer?.phone ?? null,
            }}
            generateBlockedReason={
              isDraft ? 'Send the invoice first, then create a Razorpay link for it.' : null
            }
            onChange={() => setReloadKey((k) => k + 1)}
          />
        </div>
      )}

      {showPdf ? (
        <DocumentPdf
          template={template}
          title="TAX INVOICE"
          ribbon={
            isVoid
              ? { label: 'Void', tone: 'red' }
              : isDraft
                ? { label: 'Draft', tone: 'amber' }
                : settled
                  ? { label: 'Paid', tone: 'green' }
                  : overdueDays > 0
                    ? { label: 'Overdue', tone: 'red' }
                    : null
          }
          org={org}
          numberLabel="Invoice#"
          numberValue={inv.invoiceNumber}
          balanceLabel="Balance Due"
          balanceValue={money(inv.balanceDue)}
          party={{
            heading: 'Bill To',
            name: inv.customer?.displayName ?? '—',
            lines: addressLines(inv.billingAddress),
            gstin: inv.gstin,
          }}
          deliverTo={
            inv.shippingAddress
              ? {
                  heading: 'Ship To',
                  name: inv.customer?.displayName ?? '—',
                  lines: addressLines(inv.shippingAddress),
                }
              : null
          }
          meta={[
            { label: 'Invoice Date', value: shortDate(inv.invoiceDate) },
            { label: 'Terms', value: termName(inv.paymentTerms) },
            ...(inv.dueDate ? [{ label: 'Due Date', value: shortDate(inv.dueDate) }] : []),
            ...(inv.referenceNumber ? [{ label: 'Reference#', value: inv.referenceNumber }] : []),
            ...(manyOrders ? [{ label: 'Orders', value: billedOrders.map((o) => o.orderNumber).join(', ') }] : []),
            ...(inv.placeOfSupplyCode
              ? [{
                  label: 'Place Of Supply',
                  value: `${stateName(inv.placeOfSupplyCode)} (${inv.placeOfSupplyCode})`,
                }]
              : []),
          ]}
          lines={inv.lines.map((l) => ({
            name: l.itemName,
            description: l.description ?? l.sku,
            group: groupOf(l),
            mrp: l.mrp,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            unit: l.unit,
            rate: l.rate,
            discount: lineDiscountText(l, money),
            taxRate: l.taxRate,
            cgstAmount: l.cgstAmount,
            sgstAmount: l.sgstAmount,
            igstAmount: l.igstAmount,
            amount: l.lineTotal,
          }))}
          totals={totals}
          amountInWords={amountInWords(inv.grandTotal)}
          bankDetails={bankDetails}
          notes={inv.customerNotes}
          terms={inv.terms}
          accountSummary={accountSummary}
          payment={
            invDue > 0
              ? {
                  amount: money(invDue),
                  qr: pdfQr,
                  upiId: invVpa,
                  linkUrl: inv.paymentLinkUrl ?? payOptions?.defaultLinkUrl ?? null,
                }
              : null
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <Card title="Items" padded={false}>
              <Table dense minWidth={hasMrp || hasLineDiscount ? '960px' : '820px'}>
                <thead>
                  <tr>
                    <Th>ITEM</Th>
                    <Th className="text-right">QTY</Th>
                    {hasMrp && <Th className="text-right">MRP</Th>}
                    <Th className="text-right">SELLING PRICE</Th>
                    {hasMrp && <Th className="text-right">OFF MRP</Th>}
                    {hasLineDiscount && <Th className="text-right">DISCOUNT</Th>}
                    <Th className="text-right">TAX</Th>
                    <Th className="text-right">AMOUNT</Th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l, i) => (
                    <Fragment key={l.id}>
                      {groupOf(l) && groupOf(l) !== groupOf(inv.lines[i - 1]) && (
                        <tr className="bg-muted/60">
                          <td
                            colSpan={lineCols}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {l.order ? (
                              <Link href={`/admin/orders/${l.order.id}`} className="hover:text-gold-ink hover:underline">
                                {groupOf(l)}
                              </Link>
                            ) : (
                              groupOf(l)
                            )}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-muted/60">
                        <Td>
                          <div className="flex items-start gap-2.5">
                            <Thumb url={l.imageUrl} label={l.itemName} />
                            <div className="min-w-0">
                          <div className="font-medium">{l.itemName}</div>
                          {(l.description || l.sku) && (
                            <div className="text-xs text-muted-foreground">
                              {l.description ?? l.sku}
                            </div>
                          )}
                          {l.hsnCode && (
                            <div className="text-xs text-muted-foreground">
                              HSN {l.hsnCode}
                            </div>
                          )}
                            </div>
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          {Number(l.quantity).toLocaleString(numberLocale())} {l.unit}
                        </Td>
                        {hasMrp && (
                          <Td className="whitespace-nowrap text-right">{l.mrp != null && Number(l.mrp) > 0 ? money(l.mrp) : '—'}</Td>
                        )}
                        <Td className="whitespace-nowrap text-right">{money(l.rate)}</Td>
                        {hasMrp && (
                          <Td className="whitespace-nowrap text-right">
                            <OffMrpCell
                              mrp={l.mrp}
                              rate={(Number(l.lineTotal) / Math.max(1, Number(l.quantity))) * (1 + Number(l.taxRate) / 100)}
                              inclusive
                            />
                          </Td>
                        )}
                        {hasLineDiscount && <Td className="whitespace-nowrap text-right">{lineDiscountLabel(l)}</Td>}
                        <Td className="whitespace-nowrap text-right">
                          <div>{money(l.taxAmount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {Number(l.taxRate)}%
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-right font-medium">
                          {money(l.lineTotal)}
                        </Td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Totals">
              <dl className="space-y-1.5 text-sm">
                {totals.map((t) => (
                  <div
                    key={t.label}
                    className={`flex items-start justify-between ${t.strong ? 'font-semibold' : ''}`}
                  >
                    <dt className="text-muted-foreground">
                      {t.label}
                      {t.sub && (
                        <span className={`block text-xs ${t.negative ? 'text-destructive' : 'text-muted-foreground'}`}>{t.sub}</span>
                      )}
                    </dt>
                    <dd className={t.negative ? 'text-destructive' : ''}>
                      {t.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {accountSummary && (
              <Card title="Account summary">
                <dl className="space-y-1.5 text-sm">
                  {accountSummary.rows.map((r) => (
                    <div
                      key={r.label}
                      className={`flex justify-between ${r.strong ? 'border-t border-border pt-1.5 font-semibold' : ''}`}
                    >
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="tabular-nums">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">{accountSummary.note}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={!!busy} onClick={() => setPrevious(true)}>
                    Bring up to date
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setPrevious(false)}>
                    Take off
                  </Button>
                </div>
              </Card>
            )}

            {(needsEway || eway) && (
              <Card
                title="e-Way Bill"
                action={
                  <Link
                    href="/admin/eway-bills"
                    className="text-xs text-gold-ink hover:underline"
                  >
                    All bills
                  </Link>
                }
              >
                {eway ? (
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Number</dt>
                      <dd className="text-right font-mono">
                        {eway.ewayBillNumber ?? 'Not issued'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Generated</dt>
                      <dd className="text-right">
                        {eway.generatedAt ? shortDate(eway.generatedAt) : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Valid until</dt>
                      <dd
                        className={`text-right ${
                          eway.validUntil && new Date(eway.validUntil) < new Date()
                            ? 'font-medium text-destructive'
                            : ''
                        }`}
                      >
                        {eway.validUntil ? shortDate(eway.validUntil) : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Vehicle</dt>
                      <dd className="text-right font-mono">{eway.vehicleNumber ?? '—'}</dd>
                    </div>
                  </dl>
                ) : ewayOpen ? (
                  <div className="space-y-3">
                    <Field label="e-Way Bill number" hint="12 digits, from the portal">
                      <Input
                        value={ewayForm.ewayBillNumber}
                        onChange={(e) =>
                          setEwayForm({ ...ewayForm, ewayBillNumber: e.target.value })
                        }
                        maxLength={20}
                        className="font-mono"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Generated on">
                        <Input
                          type="date"
                          value={ewayForm.generatedAt}
                          onChange={(e) =>
                            setEwayForm({ ...ewayForm, generatedAt: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Valid until" hint="The portal sets this">
                        <Input
                          type="date"
                          value={ewayForm.validUntil}
                          onChange={(e) => setEwayForm({ ...ewayForm, validUntil: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Field label="Vehicle number">
                      <Input
                        value={ewayForm.vehicleNumber}
                        onChange={(e) =>
                          setEwayForm({ ...ewayForm, vehicleNumber: e.target.value.toUpperCase() })
                        }
                        placeholder="UP32AB1234"
                        className="font-mono"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={ewaySaving}
                        onClick={async () => {
                          setEwaySaving(true);
                          setError('');
                          try {
                            await api.post('/eway-bills', {
                              documentType: 'INVOICE',
                              invoiceId: inv.id,
                              ewayBillNumber: ewayForm.ewayBillNumber.trim() || undefined,
                              generatedAt: ewayForm.generatedAt || undefined,
                              validUntil: ewayForm.validUntil || undefined,
                              vehicleNumber: ewayForm.vehicleNumber.trim() || undefined,
                              transportMode: 'ROAD',
                            });
                            setEwayOpen(false);
                            setReloadKey((k) => k + 1);
                          } catch (err) {
                            setError(errorMessage(err));
                          } finally {
                            setEwaySaving(false);
                          }
                        }}
                      >
                        {ewaySaving && <Spinner className="border-card/40 border-t-card" />}
                        Save
                      </Button>
                      <Button size="sm" onClick={() => setEwayOpen(false)} disabled={ewaySaving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-warning">
                      This consignment is over {money(EWAY_THRESHOLD)} and has no e-way bill.
                      Goods cannot legally move without one.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="https://ewaybillgst.gov.in"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm">Open the portal ↗</Button>
                      </a>
                      <Button size="sm" variant="primary" onClick={() => setEwayOpen(true)}>
                        Record the number
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Generate it on the portal, then paste the number back here.
                    </p>
                  </>
                )}
              </Card>
            )}

            {bankDetails && (
              <Card title="Bank details">
                <dl className="space-y-1.5 text-sm">
                  {bankDetails.map((b) => (
                    <div key={b.label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{b.label}</dt>
                      <dd className="text-right">{b.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Frozen when the invoice was raised — changing the organisation&rsquo;s
                  account only affects new invoices.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 max-w-xl print:hidden">
        <EmailTrail ownerType="INVOICE" ownerId={inv.id} refreshKey={reloadKey} />
      </div>

      <ConfirmModal
        open={dialog === 'void'}
        title="Mark this invoice as void?"
        message={`${inv.invoiceNumber} will stop counting towards receivables. The number stays used, which is what the GST return expects.`}
        confirmLabel="Mark as void"
        busy={busy === 'Voided'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Voided', () => api.post(`/invoices/${inv.id}/void`))}
      />

      <ConfirmModal
        open={dialog === 'delete'}
        title="Delete this invoice?"
        message={`${inv.invoiceNumber} will be removed. Void it instead if it was ever sent to the customer.`}
        confirmLabel="Delete"
        busy={busy === 'Deleted'}
        onClose={() => setDialog('')}
        onConfirm={() =>
          act('Deleted', () => api.del(`/invoices/${inv.id}`), '/invoices')
        }
      />
    </>
  );
}
