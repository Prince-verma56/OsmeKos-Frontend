'use client';

import { usePdfView } from '@/lib/pdfView';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, dateTime, shortDate, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MrpTotalRows, OffMrpCell } from '@/components/OffMrp';
import { ShiprocketPanel } from '@/components/ShiprocketPanel';
import { lineDiscountText, mrpPdfTotals, pctSuffix } from '@/lib/mrp';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { reasonLabel, whyNotReplaceable } from '@/lib/replacements';
import { CollectPayment } from '@/components/CollectPayment';
import { EmailTrail } from '@/components/EmailTrail';
import { RecordReturn, returnableLines } from '@/components/RecordReturn';
import { CreateInvoiceChoice } from '@/components/CreateInvoiceChoice';
import { upiLink, usePaymentOptions, useQrDataUrl } from '@/lib/payments';
import { stateName } from '@/lib/states';
import { useToast } from '@/lib/toast';
import { ComboSelect } from '@/components/ComboSelect';
import { TransporterSelect } from '@/components/TransporterSelect';
import { PageCrumb } from '@/lib/crumbs';

type Address = {
  firstName?: string; lastName?: string; company?: string; phone?: string; email?: string;
  line1?: string; line2?: string; landmark?: string; city?: string; state?: string;
  stateCode?: string; pincode?: string; country?: string;
};

type Line = {
  id: string;
  name: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  quantityFulfilled: number;
  quantityRefunded: number;
  quantityReturned: number;
  packSize?: number;
  unitPrice: string;
  mrp?: string | null;
  discountPercent?: string | null;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
  hsnCode: string | null;
  isCustomItem: boolean;
};

type Payment = {
  id: string; kind: string; gateway: string; amount: string; status: string;
  gatewayPaymentId: string | null; methodDetail: string | null; createdAt: string;
};

type Fulfillment = {
  id: string; fulfillmentNumber: string; status: string;
  trackingCompany: string | null; trackingNumber: string | null; trackingUrl: string | null;
  awbNumber: string | null; labelUrl?: string | null; manifestUrl?: string | null;
  shippingCost?: string | null; weight?: string | null;
  providerRef?: string | null;
  providerData?: { provider?: string; courierName?: string; pickup?: { scheduledFor?: string | null } | null } | null;
  shippedAt: string | null; deliveredAt: string | null;
  trackingEvents?: { id: string; status: string; description: string | null; location: string | null; occurredAt: string }[];
  lines: { id: string; orderLineId: string; quantity: number }[];
};

type Order = {
  id: string; orderNumber: string; isDraft: boolean; orderType: string;
  referenceNumber: string | null; terms: string | null;
  expectedShipmentDate: string | null; paymentTerms: string | null;
  transporter: string | null;
  adjustment: string; adjustmentLabel: string;
  customer: {
    id: string; firstName: string | null; lastName: string | null;
    email: string | null; phone: string | null; customerType: string | null;
    totalOrders: number | null; totalSpent: string | null;
  } | null;
  customerSnapshot: Address | null;
  subtotal: string; discountTotal: string; shippingTotal: string; codCharge?: string; taxTotal: string;
  cgstTotal: string; sgstTotal: string; igstTotal: string; roundOff: string;
  grandTotal: string; amountPaid: string; amountRefunded: string; balanceDue: string;
  paidThroughInvoices?: number;
  orderStatus: string; paymentStatus: string; fulfillmentStatus: string; deliveryStatus: string;
  confirmationStatus: string; confirmationExpiresAt: string | null; confirmedAt: string | null;
  confirmationMethod: string | null;
  paymentMethod: string; deliveryMethod: string; shipmentType: string | null;
  shippingAddress: Address | null; billingAddress: Address | null;
  gstin: string | null; placeOfSupplyStateCode: string | null;
  discountCode: string | null; tags: string[]; notes: string | null; internalNotes: string | null;
  placedAt: string | null; createdAt: string;
  paymentLinkUrl: string | null; paymentLinkId: string | null;
  paymentLinkAmount: string | null; paymentLinkCreatedAt: string | null;
  replacementForId: string | null;
  replacementReason: string | null;
  isFreeReplacement: boolean;
  replacementFor: { id: string; orderNumber: string } | null;
  sourceInvoiceId?: string | null;
  sourceInvoice?: { id: string; invoiceNumber: string; status: string } | null;
  replacements: {
    id: string; orderNumber: string; isFreeReplacement: boolean; replacementReason: string | null;
    orderStatus: string; fulfillmentStatus: string; deliveryStatus: string;
    grandTotal: string; placedAt: string;
  }[];
  lines: Line[];
  payments: Payment[];
  fulfillments: Fulfillment[];
  returns: {
    id: string; returnNumber?: string; status: string; refundAmount: string | null;
    lines?: { orderLineId: string; quantity: number }[];
  }[];
  invoices: {
    id: string; invoiceNumber: string; invoiceDate: string; dueDate: string | null;
    status: string; grandTotal: string; balanceDue: string;
  }[];
  timeline: { id: string; type?: string; message?: string; occurredAt: string; body?: string }[];
};

function AddressBlock({ a }: { a: Address | null }) {
  if (!a) return <p className="text-sm text-muted-foreground">Not provided</p>;
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
  return (
    <div className="text-sm text-foreground">
      {name && <div className="font-medium text-foreground">{name}</div>}
      {a.company && <div>{a.company}</div>}
      <div>{a.line1}</div>
      {a.line2 && <div>{a.line2}</div>}
      {a.landmark && <div className="text-muted-foreground">{a.landmark}</div>}
      <div>
        {[a.city, a.state, a.pincode].filter(Boolean).join(', ')}
      </div>
      <div>{a.country}</div>
      {a.phone && <div className="mt-1 text-muted-foreground">{a.phone}</div>}
      {a.email && <div className="text-muted-foreground">{a.email}</div>}
    </div>
  );
}

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

const prettySize = (b: number | null) => {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const customerName = (o: { customer?: { firstName: string | null; lastName: string | null } | null; customerSnapshot?: { firstName?: string; lastName?: string } | null; shippingAddress?: { firstName?: string | null; lastName?: string | null } | null }) => {
  const c = o.customer ?? o.customerSnapshot ?? o.shippingAddress ?? null;
  return (
    [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || 'Customer'
  );
};

const addressLines = (a: Record<string, unknown> | null | undefined): string[] =>
  a
    ? ([
        a.line1,
        a.line2,
        a.city,
        [a.state, a.pincode].filter(Boolean).join(' '),
        a.country ?? 'India',
        a.phone ? `Phone: ${a.phone}` : null,
      ].filter(Boolean) as string[])
    : [];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [showPdf, setShowPdf] = usePdfView('order');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: PdfOrg }>('/organization')
      .then((r) => {
        if (!cancelled) setOrg(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [busy, setBusy] = useState('');
  const [trailKey, setTrailKey] = useState(0);
  const [returning, setReturning] = useState(false);
  const toast = useToast();

  const [pay, setPay] = useState({ amount: '', gateway: 'RAZORPAY', kind: 'SALE', reference: '' });
  const [ship, setShip] = useState({ trackingCompany: '', trackingNumber: '', awbNumber: '' });
  const [comment, setComment] = useState('');


  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileLimit, setFileLimit] = useState({ maxFiles: 10, maxBytes: 10 * 1024 * 1024 });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, att] = await Promise.all([
        api.get<{ data: Order }>(`/orders/${id}`),
        api
          .get<{ data: Attachment[]; meta: { maxFiles: number; maxBytes: number } }>(
            '/shared/attachments',
            { ownerType: 'ORDER', ownerId: id }
          )
          .catch(() => null),
      ]);
      setOrder(res.data);
      setPay((p) => ({ ...p, amount: String(res.data.balanceDue ?? '') }));
      if (att) {
        setFiles(att.data);
        setFileLimit({ maxFiles: att.meta.maxFiles, maxBytes: att.meta.maxBytes });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function flash(m: string) {
    toast.success(m);
  }

  async function act(label: string, fn: () => Promise<unknown>, key?: string) {
    setBusy(key ?? label);
    setError('');
    try {
      await fn();
      flash(label);
      await load();
      setTrailKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  const [showPayForm, setShowPayForm] = useState(false);
  const payOptions = usePaymentOptions();
  const collectable = !!order && !order.sourceInvoiceId && order.orderStatus !== 'CANCELLED' && !order.isFreeReplacement;
  const dueNow = collectable ? Number(order.balanceDue) : 0;
  const pdfUpi =
    payOptions?.upiId && dueNow > 0
      ? upiLink({
          vpa: payOptions.upiId,
          name: payOptions.payeeName,
          amount: dueNow,
          note: `order ${order?.orderNumber}`,
        })
      : null;
  const pdfQr = useQrDataUrl(pdfUpi);

  const byShiprocket = (order?.shipmentType ?? 'MANUAL') !== 'MANUAL';
  const shipLabel =
    order?.shipmentType === 'D2C_SHIPROCKET'
      ? 'Shiprocket D2C'
      : order?.shipmentType === 'B2B_SHIPROCKET'
        ? 'Shiprocket B2B'
        : 'our own transport';

  if (loading) return <Loading />;
  if (!order) return <ErrorBox message={error || 'Order not found'} onRetry={load} />;

  const o = order;
  const hasMrp = o.lines.some((l) => l.mrp != null && Number(l.mrp) > 0);
  const hasLineDiscount = o.lines.some((l) => Number(l.discountPercent ?? 0) > 0 || Number(l.discountAmount) > 0);
  const lineNetTaxable = (l: Line) => Number(l.lineTotal) / (1 + Number(l.taxRate) / 100);
  const codPending = o.confirmationStatus === 'PENDING';
  const mirror = !!o.sourceInvoiceId;
  const cancellable = !mirror && o.orderStatus !== 'CANCELLED' && o.fulfillmentStatus !== 'FULFILLED';
  const fulfillable = !mirror && !o.isDraft && o.orderStatus !== 'CANCELLED' && o.fulfillmentStatus !== 'FULFILLED';
  const replaceable = !mirror && !whyNotReplaceable(o);
  const replacements = o.replacements ?? [];

  return (
    <>
      <PageCrumb label={o.orderNumber} />

      <PageHeader
        title={o.orderNumber}
        subtitle={`${o.orderType} · placed ${o.placedAt ? dateTime(o.placedAt) : dateTime(o.createdAt)}`}
        actions={
          <>
            {!mirror && o.orderStatus !== 'CANCELLED' && (
              <Link href={`/admin/orders/${id}/edit`}>
                <Button type="button">&#9998; Edit</Button>
              </Link>
            )}
            {replaceable && (
              <Link href={`/admin/orders/new?replacementFor=${o.id}`}>
                <Button type="button">Send replacement</Button>
              </Link>
            )}
            {!mirror && !o.isDraft && o.orderStatus !== 'CANCELLED' && returnableLines(o).length > 0 && (
              <Button type="button" onClick={() => setReturning(true)}>
                ↩ Record return
              </Button>
            )}
            {!o.isDraft && o.orderStatus !== 'CANCELLED' && (
              <Button
                type="button"
                disabled={!!busy}
                onClick={() => act('Confirmation emailed', () => api.post(`/orders/${id}/email`))}
              >
                ✉ Email confirmation
              </Button>
            )}
            {o.isDraft && (
              <Button
                variant="primary"
                disabled={!!busy}
                onClick={() => act('Draft converted', () => api.post(`/orders/${id}/convert`))}
              >
                Convert to order
              </Button>
            )}
            {!mirror && !o.replacementForId && can('orders:write') && (
              <Button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  setBusy('duplicate');
                  setError('');
                  try {
                    const res = await api.post<{ data: { id: string; orderNumber: string } }>(`/orders/${id}/duplicate`, {});
                    toast.success(`Draft ${res.data.orderNumber} made from ${o.orderNumber}`);
                    router.push(`/admin/orders/${res.data.id}`);
                  } catch (err) {
                    setError(errorMessage(err));
                  } finally {
                    setBusy('');
                  }
                }}
              >
                {busy === 'duplicate' && <Spinner />}⧉ Duplicate
              </Button>
            )}
            {cancellable && (
              <Button
                variant="danger"
                disabled={!!busy}
                onClick={() => {
                  const reason = prompt('Cancel this order — reason?') ?? undefined;
                  if (reason === undefined) return;
                  act('Order cancelled', () =>
                    api.post(`/orders/${id}/cancel`, { reason, restock: true })
                  );
                }}
              >
                Cancel order
              </Button>
            )}
          </>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {mirror && (
        <p className="mb-4 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-sm text-foreground print:hidden">
          Made automatically from invoice{' '}
          {o.sourceInvoice ? (
            <Link href={`/admin/invoices/${o.sourceInvoice.id}`} className="font-medium underline">
              {o.sourceInvoice.invoiceNumber}
            </Link>
          ) : (
            'that was deleted'
          )}
          {o.orderStatus === 'CANCELLED'
            ? '. It was cancelled because that invoice was voided or deleted.'
            : '. It follows that invoice - make changes, payments and returns on the invoice.'}
        </p>
      )}

      {o.replacementForId && (
        <p className="mb-4 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-sm text-foreground print:hidden">
          Replacement for{' '}
          <Link href={`/admin/orders/${o.replacementForId}`} className="font-medium underline">
            {o.replacementFor?.orderNumber ?? 'the original order'}
          </Link>
          {' - '}
          {reasonLabel(o.replacementReason).toLowerCase()},{' '}
          {o.isFreeReplacement ? 'sent free.' : 'charged to the customer.'}
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-start gap-6 print:hidden">
        <dl className="border-l-2 border-border pl-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">STATUS</div>
          {[
            ['Order', <Badge key="o" status={o.orderStatus}>{o.orderStatus}</Badge>],
            [
              'Invoice',
              mirror && o.sourceInvoice ? (
                <Link key="i" href={`/admin/invoices/${o.sourceInvoice.id}`} className="font-medium text-gold-ink hover:underline">
                  {o.sourceInvoice.invoiceNumber}
                </Link>
              ) : o.invoices?.length ? (
                <Link
                  key="i"
                  href={`/admin/invoices/${o.invoices[0].id}`}
                  className="font-medium text-gold-ink hover:underline"
                >
                  {o.invoices[0].invoiceNumber}
                  {o.invoices.length > 1 && ` +${o.invoices.length - 1}`}
                </Link>
              ) : (
                <CreateInvoiceChoice
                  key="i"
                  order={{ id: o.id, orderNumber: o.orderNumber, grandTotal: o.grandTotal, customerId: o.customer?.id ?? null }}
                  customerName={
                    [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || 'This customer'
                  }
                  className="text-gold-ink hover:underline disabled:opacity-60"
                />
              ),
            ],
            ['Payment', <Badge key="p" status={o.paymentStatus}>{o.paymentStatus.replaceAll('_', ' ')}</Badge>],
            ['Shipment', <Badge key="s" status={o.deliveryStatus}>{o.deliveryStatus.replaceAll('_', ' ')}</Badge>],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center gap-4 py-0.5">
              <dt className="w-20 text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2 pt-6">
          <Badge status={o.fulfillmentStatus}>{o.fulfillmentStatus.replaceAll('_', ' ')}</Badge>
          {o.isDraft && <Badge tone="amber">Draft</Badge>}
          {o.replacementForId && (
            <Badge tone="blue">{o.isFreeReplacement ? 'Free replacement' : 'Replacement'}</Badge>
          )}
          {replacements.length > 0 && <Badge tone="blue">Replaced</Badge>}
          {o.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>

        <label className="ml-auto flex cursor-pointer items-center gap-2 pt-6 text-sm italic text-muted-foreground">
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

      {showPdf && (
        <DocumentPdf
          title="SALES ORDER"
          org={org}
          ribbon={
            o.orderStatus === 'CANCELLED'
              ? { label: 'Cancelled', tone: 'red' }
              : o.isDraft
                ? { label: 'Draft', tone: 'amber' }
                : { label: 'Confirmed', tone: 'blue' }
          }
          numberLabel="Sales Order#"
          numberValue={o.orderNumber}
          balanceLabel="Balance Due"
          balanceValue={money(o.balanceDue)}
          party={{
            heading: 'Bill To',
            name: customerName(o),
            lines: addressLines(o.billingAddress ?? o.shippingAddress),
            gstin: o.gstin,
          }}
          deliverTo={
            o.shippingAddress
              ? {
                  heading: 'Ship To',
                  name: customerName(o),
                  lines: addressLines(o.shippingAddress),
                }
              : null
          }
          meta={[
            { label: 'Order Date', value: shortDate(o.placedAt ?? o.createdAt) },
            ...(o.referenceNumber ? [{ label: 'Ref#', value: o.referenceNumber }] : []),
            ...(o.placeOfSupplyStateCode
              ? [{
                  label: 'Place Of Supply',
                  value: `${stateName(o.placeOfSupplyStateCode)} (${o.placeOfSupplyStateCode})`,
                }]
              : []),
          ]}
          lines={o.lines.map((l) => ({
            name: [l.name, l.variantTitle].filter(Boolean).join(' - '),
            description: l.sku,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            mrp: l.mrp,
            rate: l.unitPrice,
            discount: lineDiscountText(l, money),
            amount: l.lineTotal,
          }))}
          totals={[
            ...mrpPdfTotals(o.lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: lineNetTaxable(l), taxPercent: Number(l.taxRate) })), money),
            { label: 'Sub Total', value: money(Number(o.subtotal) + Number(o.discountTotal)) },
            ...(Number(o.discountTotal) > 0
              ? [
                  { label: `Discount${pctSuffix(Number(o.discountTotal), Number(o.subtotal) + Number(o.discountTotal))}`, value: `(-) ${money(o.discountTotal)}`, negative: true },
                  { label: 'Total Taxable Amount', value: money(o.subtotal) },
                ]
              : []),
            ...(Number(o.cgstTotal) > 0
              ? [
                  { label: 'CGST', value: money(o.cgstTotal) },
                  { label: 'SGST', value: money(o.sgstTotal) },
                ]
              : [{ label: 'IGST', value: money(o.igstTotal) }]),
            ...(Number(o.shippingTotal) > 0
              ? [{ label: 'Shipping charge', value: money(o.shippingTotal) }]
              : []),
            ...(Number(o.codCharge ?? 0) > 0
              ? [{ label: 'COD charge', value: money(o.codCharge ?? 0) }]
              : []),
            ...(Number(o.adjustment) !== 0
              ? [{ label: o.adjustmentLabel || 'Adjustment', value: money(o.adjustment) }]
              : []),
            ...(Number(o.roundOff) !== 0
              ? [{ label: 'Round Off', value: money(o.roundOff) }]
              : []),
            { label: 'Total', value: money(o.grandTotal), strong: true },
          ]}
          notes={o.notes}
          terms={o.terms}
          payment={
            dueNow > 0
              ? {
                  amount: money(dueNow),
                  qr: pdfQr,
                  upiId: payOptions?.upiId ?? null,
                  linkUrl: o.paymentLinkUrl ?? payOptions?.defaultLinkUrl ?? null,
                }
              : null
          }
        />
      )}

      {codPending && (
        <Card title="COD confirmation pending">
          <p className="text-sm text-muted-foreground">
            Expires {o.confirmationExpiresAt ? dateTime(o.confirmationExpiresAt) : 'unknown'}. Stock
            stays committed until this is settled.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="success"
              disabled={!!busy}
              onClick={() =>
                act('Order confirmed', () =>
                  api.post(`/orders/${id}/confirm`, { action: 'CONFIRM', method: 'admin' })
                )
              }
            >
              {busy === 'Order confirmed' && <Spinner className="border-card/40 border-t-card" />}
              Confirm order
            </Button>
            <Button
              variant="danger"
              disabled={!!busy}
              onClick={() =>
                act('Confirmation rejected', () =>
                  api.post(`/orders/${id}/confirm`, {
                    action: 'CANCEL', method: 'admin', reason: 'Customer declined',
                  })
                )
              }
            >
              Customer declined
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title={`Items (${o.lines.length})`} padded={false}>
            <Table dense minWidth={hasMrp || hasLineDiscount ? '760px' : undefined}>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Qty</Th>
                  {hasMrp && <Th className="text-right">MRP</Th>}
                  <Th className="text-right">Unit</Th>
                  {hasMrp && <Th className="text-right">Off MRP</Th>}
                  {hasLineDiscount && <Th className="text-right">Discount</Th>}
                  <Th className="text-right">Tax</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {o.lines.length === 0 && <EmptyRow colSpan={5 + (hasMrp ? 2 : 0) + (hasLineDiscount ? 1 : 0)} />}
                {o.lines.map((l) => (
                  <tr key={l.id}>
                    <Td>
                      <div className="font-medium text-foreground">{l.name}</div>
                      {l.variantTitle && (
                        <div className="text-xs text-muted-foreground">
                          {l.variantTitle}
                        </div>
                      )}
                      <div className="font-mono text-xs text-muted-foreground">
                        {l.sku ?? '—'}{l.hsnCode ? ` · HSN ${l.hsnCode}` : ''}
                      </div>
                      {l.quantityFulfilled > 0 && (
                        <div className="text-xs text-success">
                          {l.quantityFulfilled} fulfilled
                        </div>
                      )}
                      {l.quantityReturned > 0 && (
                        <div className="text-xs text-warning">
                          {l.quantityReturned} returned
                        </div>
                      )}
                    </Td>
                    <Td className="text-right">{l.quantity}</Td>
                    {hasMrp && (
                      <Td className="whitespace-nowrap text-right">{l.mrp != null && Number(l.mrp) > 0 ? money(l.mrp) : '—'}</Td>
                    )}
                    <Td className="whitespace-nowrap text-right">{money(l.unitPrice)}</Td>
                    {hasMrp && (
                      <Td className="whitespace-nowrap text-right text-xs">
                        <OffMrpCell
                          mrp={l.mrp}
                          rate={Number(l.lineTotal) / Math.max(1, l.quantity)}
                          inclusive
                        />
                      </Td>
                    )}
                    {hasLineDiscount && (
                      <Td className="whitespace-nowrap text-right text-xs">
                        {l.discountPercent && Number(l.discountPercent) > 0
                          ? `${Number(l.discountPercent)}%`
                          : Number(l.discountAmount) > 0
                            ? money(l.discountAmount)
                            : '—'}
                      </Td>
                    )}
                    <Td className="whitespace-nowrap text-right text-xs">
                      {money(l.taxAmount)}
                      <div className="text-muted-foreground">
                        {Number(l.igstAmount) > 0 ? 'IGST' : 'CGST+SGST'} {Number(l.taxRate)}%
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(l.lineTotal)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <dl className="space-y-1.5 border-t border-border p-4 text-sm">
              <MrpTotalRows
                lines={o.lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: lineNetTaxable(l), taxPercent: Number(l.taxRate) }))}
                valueClass=""
              />
              {([
                ['Subtotal', Number(o.subtotal) + Number(o.discountTotal), false],
                ...(Number(o.discountTotal) > 0
                  ? ([[`Discount${pctSuffix(Number(o.discountTotal), Number(o.subtotal) + Number(o.discountTotal))}`, o.discountTotal, true], ['Taxable amount', o.subtotal, false]] as const)
                  : []),
                ['Shipping', o.shippingTotal, false],
                ...(Number(o.codCharge ?? 0) > 0 ? ([['COD charge', o.codCharge ?? 0, false]] as const) : []),
                ...(Number(o.cgstTotal) > 0
                  ? ([['CGST', o.cgstTotal, false], ['SGST', o.sgstTotal, false]] as const)
                  : ([['IGST', o.igstTotal, false]] as const)),
                ...(Number(o.adjustment) !== 0
                  ? ([[o.adjustmentLabel || 'Adjustment', o.adjustment, false]] as const)
                  : []),
                ...(Number(o.roundOff) !== 0 ? ([['Round off', o.roundOff, false]] as const) : []),
              ] as [string, string | number, boolean][]).map(([label, val, negative]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{negative ? `-${money(val)}` : money(val)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <dt>Grand total</dt>
                <dd>{money(o.grandTotal)}</dd>
              </div>
              <div className="flex justify-between text-success">
                <dt>Paid{Number(o.paidThroughInvoices ?? 0) > 0 ? ' (incl. on invoices)' : ''}</dt>
                <dd>{money(Number(o.amountPaid) + Number(o.paidThroughInvoices ?? 0))}</dd>
              </div>
              {Number(o.balanceDue) > 0 && (
                <div className="flex justify-between font-medium text-warning">
                  <dt>Balance due</dt>
                  <dd>{money(o.balanceDue)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {byShiprocket && o.fulfillmentStatus !== 'FULFILLED' && o.orderStatus !== 'CANCELLED' && !o.isDraft && (
            <ShiprocketPanel orderId={o.id} onShipped={load} />
          )}

          {fulfillable && (
            <Card title={byShiprocket ? 'Record a shipment by hand' : 'Fulfil this order'}>
              {byShiprocket ? (
                <p className="mb-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  This order ships on <strong>{shipLabel}</strong>. Book it in the card above to buy the AWB through Shiprocket - use
                  this card only when the parcel was booked somewhere else and you are copying the numbers in.
                </p>
              ) : (
                <p className="mb-3 text-xs text-muted-foreground">
                  Going out on our own transport
                  {o.transporter ? ` with ${o.transporter}` : ''} — there is no courier AWB, so
                  record the LR or docket number as the tracking number.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={byShiprocket ? 'Courier' : 'Transporter'}>
                  {byShiprocket ? (
                    <ComboSelect
                      value={ship.trackingCompany}
                      options={['Delhivery', 'Blue Dart', 'DTDC', 'Ecom Express', 'Xpressbees', 'Shadowfax', 'Ekart', 'India Post']}
                      onChange={(trackingCompany) => setShip({ ...ship, trackingCompany })}
                      placeholder="Select a courier"
                      addLabel="+ Another courier"
                      newPlaceholder="Courier name"
                    />
                  ) : (
                    <TransporterSelect
                      value={ship.trackingCompany || o.transporter || ''}
                      onChange={(trackingCompany) => setShip({ ...ship, trackingCompany })}
                    />
                  )}
                </Field>
                <Field label={byShiprocket ? 'Tracking number' : 'LR / docket number'}>
                  <Input
                    value={ship.trackingNumber}
                    onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })}
                  />
                </Field>
                {byShiprocket ? (
                  <Field label="AWB number">
                    <Input
                      value={ship.awbNumber}
                      onChange={(e) => setShip({ ...ship, awbNumber: e.target.value })}
                    />
                  </Field>
                ) : (
                  <Field label="E-way bill number" hint="Required above Rs.50,000 of goods">
                    <Input
                      value={ship.awbNumber}
                      onChange={(e) => setShip({ ...ship, awbNumber: e.target.value })}
                      className="font-mono"
                    />
                  </Field>
                )}
              </div>
              <div className="mt-3">
                <Button
                  variant="primary"
                  disabled={!!busy}
                  onClick={() =>
                    act('Order fulfilled', () =>
                      api.post(`/orders/${id}/fulfill`, {
                        trackingCompany: ship.trackingCompany || (byShiprocket ? '' : o.transporter ?? '') || undefined,
                        trackingNumber: ship.trackingNumber || undefined,
                        awbNumber: ship.awbNumber || undefined,
                      })
                    )
                  }
                >
                  {busy === 'Order fulfilled' && (
                    <Spinner className="border-card/40 border-t-card" />
                  )}
                  Fulfil all outstanding lines
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Fulfilling moves stock out of committed and reduces on hand.
              </p>
            </Card>
          )}

          <Card title={`Fulfilments (${o.fulfillments.length})`} padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Status</Th>
                  <Th>Courier</Th>
                  <Th>Tracking</Th>
                  <Th>Shipped</Th>
                </tr>
              </thead>
              <tbody>
                {o.fulfillments.length === 0 && (
                  <EmptyRow colSpan={5} message="Nothing shipped yet" />
                )}
                {o.fulfillments.map((f) => (
                  <Fragment key={f.id}>
                    <tr>
                      <Td className="font-mono text-xs">{f.fulfillmentNumber}</Td>
                      <Td><Badge status={f.status}>{f.status}</Badge></Td>
                      <Td>{f.trackingCompany ?? '—'}</Td>
                      <Td className="font-mono text-xs">
                        {f.trackingUrl && (f.trackingNumber || f.awbNumber) ? (
                          <a href={f.trackingUrl} target="_blank" rel="noreferrer" className="text-gold-ink hover:underline">
                            {f.trackingNumber ?? f.awbNumber}
                          </a>
                        ) : (
                          f.trackingNumber ?? f.awbNumber ?? '—'
                        )}
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {f.shippedAt ? dateTime(f.shippedAt) : '—'}
                      </Td>
                    </tr>
                    {f.providerData?.provider === 'SHIPROCKET' && (
                      <tr>
                        <td colSpan={5} className="border-b border-border/70 px-3 pb-3 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {f.shippingCost != null && <span>Freight {money(f.shippingCost)}</span>}
                            {f.weight != null && <span>{Number(f.weight)} kg</span>}
                            {f.providerData?.pickup?.scheduledFor && <span>Pickup {f.providerData.pickup.scheduledFor}</span>}
                            {f.labelUrl && (
                              <a href={f.labelUrl} target="_blank" rel="noreferrer" className="text-gold-ink hover:underline">
                                Label
                              </a>
                            )}
                            {f.manifestUrl && (
                              <a href={f.manifestUrl} target="_blank" rel="noreferrer" className="text-gold-ink hover:underline">
                                Manifest
                              </a>
                            )}
                            <Button
                              size="xs"
                              disabled={!!busy}
                              onClick={() =>
                                act(
                                  'Tracking updated',
                                  () => api.post(`/shipping/shipments/${f.id}/track`, {}),
                                  `track:${f.id}`
                                )
                              }
                            >
                              {busy === `track:${f.id}` && <Spinner className="size-3" />}
                              {busy === `track:${f.id}` ? 'Checking the courier…' : 'Refresh tracking'}
                            </Button>
                            {f.status !== 'CANCELLED' && !f.deliveredAt && can('orders:fulfil') && (
                              <Button
                                size="xs"
                                variant="danger"
                                disabled={!!busy}
                                onClick={() =>
                                  act(
                                    'Shipment cancelled',
                                    () => api.post(`/shipping/shipments/${f.id}/cancel`, {}),
                                    `cancel:${f.id}`
                                  )
                                }
                              >
                                {busy === `cancel:${f.id}` && <Spinner className="size-3 border-destructive/30 border-t-destructive" />}
                                {busy === `cancel:${f.id}` ? 'Cancelling…' : 'Cancel with courier'}
                              </Button>
                            )}
                          </div>
                          {(f.trackingEvents ?? []).length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {(f.trackingEvents ?? []).slice(0, 4).map((e) => (
                                <div key={e.id}>
                                  <span className="text-foreground">{e.status}</span>
                                  {e.location ? ` · ${e.location}` : ''} · {dateTime(e.occurredAt)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title={`Payments (${o.payments.length})`} padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Kind</Th>
                  <Th>Gateway</Th>
                  <Th>Reference</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {o.payments.length === 0 && <EmptyRow colSpan={5} message="No payments recorded" />}
                {o.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(p.createdAt)}
                    </Td>
                    <Td>
                      <Badge tone={p.kind === 'REFUND' ? 'red' : 'green'}>{p.kind}</Badge>
                    </Td>
                    <Td className="text-xs">{p.gateway}</Td>
                    <Td className="font-mono text-xs">{p.gatewayPaymentId ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{money(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {!mirror && dueNow <= 0 && o.payments.length > 0 && !showPayForm && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Paid in full. Nothing left to collect on this order.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowPayForm(true)}>
                  Record a refund or adjustment
                </Button>
              </div>
            )}

            {!mirror && (dueNow > 0 || showPayForm || o.payments.length === 0) && (
            <div className="border-t border-border p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Amount">
                  <Input
                    type="number" step="0.01" min="0"
                    value={pay.amount}
                    onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                  />
                </Field>
                <Field label="Kind">
                  <Select
                    value={pay.kind}
                    onChange={(e) => setPay({ ...pay, kind: e.target.value })}
                    className="w-full"
                  >
                    <option value="SALE">Sale</option>
                    <option value="CAPTURE">Capture</option>
                    <option value="REFUND">Refund</option>
                    <option value="VOID">Void</option>
                  </Select>
                </Field>
                <Field label="Gateway">
                  <Select
                    value={pay.gateway}
                    onChange={(e) => setPay({ ...pay, gateway: e.target.value })}
                    className="w-full"
                  >
                    <option value="RAZORPAY">Razorpay</option>
                    <option value="COD">COD</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="CARD">Card</option>
                    <option value="MANUAL">Manual</option>
                  </Select>
                </Field>
                <Field label="Reference">
                  <Input
                    value={pay.reference}
                    onChange={(e) => setPay({ ...pay, reference: e.target.value })}
                    placeholder="pay_xxx"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Button
                  variant="primary"
                  disabled={!!busy || pay.amount === ''}
                  onClick={() =>
                    act('Payment recorded', () =>
                      api.post(`/orders/${id}/payments`, {
                        kind: pay.kind,
                        gateway: pay.gateway,
                        amount: Number(pay.amount),
                        gatewayPaymentId: pay.reference || undefined,
                      })
                    )
                  }
                >
                  {busy === 'Payment recorded' && (
                    <Spinner className="border-card/40 border-t-card" />
                  )}
                  Record payment
                </Button>
              </div>
            </div>
            )}
          </Card>

          <Card title="Timeline">
            <div className="mb-4 flex gap-2">
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a note on this order…"
              />
              <Button
                disabled={!!busy || !comment.trim()}
                onClick={() =>
                  act('Comment added', async () => {
                    await api.post(`/orders/${id}/comments`, { message: comment.trim() });
                    setComment('');
                  })
                }
              >
                Add
              </Button>
            </div>
            {o.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet</p>
            ) : (
              <ul className="space-y-2.5">
                {o.timeline.map((t) => (
                  <li key={t.id} className="border-l-2 border-border pl-3">
                    <div className="text-sm text-foreground">
                      {t.message ?? t.body ?? t.type ?? 'Event'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dateTime(t.occurredAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Customer">
            {o.customer ? (
              <div className="text-sm">
                <Link
                  href={`/admin/customers/${o.customer.id}`}
                  className="font-medium text-gold-ink hover:underline"
                >
                  {[o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                </Link>
                <div className="mt-1 text-muted-foreground">{o.customer.phone ?? '—'}</div>
                <div className="text-muted-foreground">{o.customer.email ?? '—'}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {o.customer.totalOrders ?? 0} order{(o.customer.totalOrders ?? 0) === 1 ? '' : 's'} · {money(o.customer.totalSpent ?? 0)} lifetime
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Guest checkout — no customer record
              </p>
            )}
          </Card>

          <Card title="Payment & delivery">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd>{o.paymentMethod}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery method</dt>
                <dd>{o.deliveryMethod.replaceAll('_', ' ')}</dd>
              </div>
              {o.shipmentType && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipment</dt>
                  <dd>{o.shipmentType.replaceAll('_', ' ')}</dd>
                </div>
              )}
              {o.discountCode && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount code</dt>
                  <dd className="font-mono">{o.discountCode}</dd>
                </div>
              )}
              {o.gstin && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">GSTIN</dt>
                  <dd className="font-mono text-xs">{o.gstin}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Place of supply</dt>
                <dd>{o.placeOfSupplyStateCode ?? '—'}</dd>
              </div>
            </dl>
          </Card>

          {collectable && (
            <CollectPayment
              kind="orders"
              doc={{
                id: o.id,
                number: o.orderNumber,
                balanceDue: o.balanceDue,
                paymentMethod: o.paymentMethod,
                paymentLinkUrl: o.paymentLinkUrl,
                paymentLinkId: o.paymentLinkId,
                paymentLinkAmount: o.paymentLinkAmount,
                paymentLinkCreatedAt: o.paymentLinkCreatedAt,
                customerName: o.customer?.firstName ?? o.shippingAddress?.firstName ?? null,
                customerPhone: o.customer?.phone ?? o.shippingAddress?.phone ?? null,
              }}
              onChange={load}
            />
          )}

          <Card title="Shipping address">
            <AddressBlock a={o.shippingAddress} />
          </Card>

          <Card title="Billing address">
            <AddressBlock a={o.billingAddress ?? o.shippingAddress} />
          </Card>

          {replacements.length > 0 && (
            <Card title={`Replacements (${replacements.length})`}>
              <ul className="space-y-3 text-sm">
                {replacements.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/admin/orders/${r.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {r.orderNumber}
                      </Link>
                      <Badge status={r.orderStatus === 'CANCELLED' ? 'CANCELLED' : r.deliveryStatus}>
                        {r.orderStatus === 'CANCELLED' ? 'CANCELLED' : r.deliveryStatus.replaceAll('_', ' ')}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {reasonLabel(r.replacementReason)} ·{' '}
                      {r.isFreeReplacement ? 'sent free' : money(r.grandTotal)} · {dateTime(r.placedAt)}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                If the first parcel comes back, record it as a return so the goods go back into stock.
              </p>
            </Card>
          )}

          <EmailTrail ownerType="ORDER" ownerId={o.id} refreshKey={trailKey} />

          {o.returns.length > 0 && (
            <Card title={`Returns (${o.returns.length})`}>
              <div className="space-y-2 text-sm">
                {o.returns.map((r) => (
                  <div key={r.id} className="flex justify-between">
                    <Link
                      href={`/admin/returns/${r.id}`}
                      className="font-mono text-xs text-gold-ink hover:underline"
                    >
                      {r.returnNumber ?? r.id.slice(0, 8)}
                    </Link>
                    <Badge status={r.status}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title={`Attachments (${files.length}/${fileLimit.maxFiles})`}>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing attached yet</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={f.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium text-gold-ink hover:underline"
                      >
                        {f.fileName}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {[f.mimeType, prettySize(f.sizeBytes)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!!busy}
                      onClick={() =>
                        act('Attachment removed', () => api.del(`/shared/attachments/${f.id}`))
                      }
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {files.length < fileLimit.maxFiles && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex gap-2">
                  <FileUpload
                    label="Upload file"
                    accept="image/*,application/pdf"
                    onUploaded={(files) =>
                      act('Attachment added', async () => {
                        for (const f of files) {
                          await api.post('/shared/attachments', {
                            ownerType: 'ORDER',
                            ownerId: id,
                            fileName: f.fileName,
                            fileUrl: f.url,
                            mimeType: f.mimeType,
                            sizeBytes: f.sizeBytes,
                          });
                        }
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a file or paste a URL. Up to {fileLimit.maxFiles} files.
                </p>
              </div>
            )}
          </Card>

          {(o.notes || o.internalNotes) && (
            <Card title="Notes">
              {o.notes && <p className="text-sm text-foreground">{o.notes}</p>}
              {o.internalNotes && (
                <p className="mt-2 text-sm text-warning">
                  Internal: {o.internalNotes}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {returning && (
        <RecordReturn
          order={o}
          open
          onClose={() => setReturning(false)}
          onDone={async (r) => {
            setReturning(false);
            toast.success(r.message);
            if (r.completed) {
              await load();
            } else {
              router.push(`/admin/returns/${r.id}`);
            }
          }}
        />
      )}
    </>
  );
}
