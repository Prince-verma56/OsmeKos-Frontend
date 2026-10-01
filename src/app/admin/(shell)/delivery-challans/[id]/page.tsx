'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import { OffMrpCell } from '@/components/OffMrp';
import { lineDiscountText, mrpPdfTotals } from '@/lib/mrp';
import { amountInWords } from '@/lib/amountInWords';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { PdfCustomize, type PdfTemplate } from '@/components/PdfCustomize';
import { ConfirmModal } from '@/components/Modal';
import {
  Badge, Button, Card, ErrorBox, Loading, PageHeader, Table, Td, Th,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

const CHALLAN_TYPE_LABEL: Record<string, string> = {
  JOB_WORK: 'Job Work',
  SUPPLY_ON_APPROVAL: 'Supply on Approval',
  SAMPLES_MARKETING: 'Samples & Marketing',
  STOCK_TRANSFER: 'Stock Transfer',
  OTHERS: 'Others',
};

type Address = {
  attention?: string | null; line1?: string | null; line2?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null;
  country?: string | null; phone?: string | null;
};

type ChallanLine = {
  id: string; itemName: string; description: string | null; sku: string | null;
  hsnCode: string | null; unit: string; quantity: string; rate: string;
  taxRate: string; taxAmount: string; cgstAmount: string; sgstAmount: string;
  igstAmount: string; lineTotal: string;
  imageUrl?: string | null;
  mrp?: string | null; discountPercent?: string | null; discountAmount?: string | null;
};

const lineDiscountLabel = (l: ChallanLine) => {
  if (l.discountPercent && Number(l.discountPercent) > 0) return `${Number(l.discountPercent)}%`;
  if (l.discountAmount && Number(l.discountAmount) > 0) return money(l.discountAmount);
  return '—';
};

type Challan = {
  orderInvoice?: { id: string; invoiceNumber: string } | null;
  id: string;
  challanNumber: string;
  challanType: string;
  challanDate: string;
  referenceNumber: string | null;
  subject: string | null;
  status: string;
  invoiceStatus: 'NOT_INVOICED' | 'INVOICED';
  stockMoved: boolean;
  sourceOfSupplyCode: string | null;
  placeOfSupplyCode: string | null;
  gstin: string | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  transporter: string | null;
  vehicleNumber: string | null;
  ewayBillNumber: string | null;
  taxTreatment: string;
  discountLevel?: 'TRANSACTION' | 'LINE_ITEM';
  discountPercent: string | null;
  subtotal: string;
  discountTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  shippingCharge?: string;
  codCharge?: string;
  adjustment: string;
  adjustmentLabel: string | null;
  grandTotal: string;
  deliveredAt: string | null;
  returnedAt: string | null;
  customerNotes: string | null;
  terms: string | null;
  customer: {
    id: string; displayName: string | null;
  } | null;
  order: { id: string; orderNumber: string } | null;
  orders?: { id: string; orderNumber: string }[];
  location: { id: string; name: string } | null;
  lines: ChallanLine[];
};

const addressLines = (a: Address | null | undefined): string[] =>
  a
    ? ([
        a.attention, a.line1, a.line2, a.city,
        [a.state, a.pincode].filter(Boolean).join(' '),
        a.country ?? 'India',
        a.phone ? `Phone: ${a.phone}` : null,
      ].filter(Boolean) as string[])
    : [];

export default function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [challan, setChallan] = useState<Challan | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [showPdf, setShowPdf] = usePdfView('delivery_challan');
  const [template, setTemplate] = useState<PdfTemplate>('standard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'' | 'return' | 'cancel' | 'delete'>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: Challan }>(`/delivery-challans/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setChallan(res.data);
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
  if (!challan) {
    return (
      <ErrorBox message={error || 'Challan not found'} onRetry={() => setReloadKey((k) => k + 1)} />
    );
  }

  const isDraft = challan.status === 'DRAFT';
  const isCancelled = challan.status === 'CANCELLED';
  const isReturned = challan.status === 'RETURNED';
  const orderInvoice = challan.orderInvoice ?? null;
  const challanOrders = challan.orders?.length ? challan.orders : challan.order ? [challan.order] : [];
  const invoiced = challan.invoiceStatus === 'INVOICED' || !!orderInvoice;

  const intraState =
    !!challan.sourceOfSupplyCode &&
    !!challan.placeOfSupplyCode &&
    challan.sourceOfSupplyCode === challan.placeOfSupplyCode;

  const rates = [...new Set(challan.lines.map((l) => Number(l.taxRate)))];
  const uniformRate = rates.length === 1 ? rates[0] : null;
  const grossSubtotal = Number(challan.subtotal) + Number(challan.discountTotal);
  const hasMrp = challan.lines.some((l) => l.mrp != null && Number(l.mrp) > 0);
  const hasLineDiscount =
    challan.discountLevel === 'LINE_ITEM' && challan.lines.some((l) => Number(l.discountAmount ?? 0) > 0);
  const mrpLines = challan.lines.map((l) => ({ mrp: l.mrp, quantity: l.quantity, netTaxable: Number(l.lineTotal), taxPercent: Number(l.taxRate) }));

  const totals = [
    ...mrpPdfTotals(mrpLines, money),
    { label: 'Sub Total', value: money(grossSubtotal) },
    ...(Number(challan.discountTotal) > 0
      ? [{
          label: `Discount${challan.discountPercent && Number(challan.discountPercent) > 0 ? `(${Number(challan.discountPercent)}%)` : ''}`,
          value: `(-) ${money(challan.discountTotal)}`,
          negative: true,
        }]
      : []),
    { label: 'Total Taxable Amount', value: money(challan.subtotal) },
    ...(intraState
      ? [
          { label: `CGST${uniformRate != null ? ` (${uniformRate / 2}%)` : ''}`, value: money(challan.cgstTotal) },
          { label: `SGST${uniformRate != null ? ` (${uniformRate / 2}%)` : ''}`, value: money(challan.sgstTotal) },
        ]
      : [{ label: `IGST${uniformRate != null ? ` (${uniformRate}%)` : ''}`, value: money(challan.igstTotal) }]),
    ...(Number(challan.shippingCharge ?? 0) > 0
      ? [{ label: 'Shipping Charge', value: money(challan.shippingCharge ?? 0) }]
      : []),
    ...(Number(challan.codCharge ?? 0) > 0
      ? [{ label: 'COD Charge', value: money(challan.codCharge ?? 0) }]
      : []),
    ...(Number(challan.adjustment) !== 0
      ? [{ label: challan.adjustmentLabel || 'Adjustment', value: money(challan.adjustment) }]
      : []),
    { label: 'Total Value', value: money(challan.grandTotal), strong: true },
  ];

  const menuItem =
    'block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={challan.customer?.displayName ?? '—'} />

        <PageHeader
          title={challan.challanNumber}
          subtitle={challan.subject ?? undefined}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {!isCancelled && !invoiced && (
            <Link href={`/admin/delivery-challans/${challan.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {isDraft && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() => act('Opened', () => api.post(`/delivery-challans/${challan.id}/open`))}
            >
              Convert to Open
            </Button>
          )}
          {['DRAFT', 'OPEN'].includes(challan.status) && (
            <Button
              size="sm"
              variant="success"
              disabled={!!busy}
              onClick={() => act('Marked delivered', () => api.post(`/delivery-challans/${challan.id}/deliver`))}
            >
              Mark as Delivered
            </Button>
          )}
          {!isCancelled && !isReturned && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('return')}>
              Mark as Returned
            </Button>
          )}
          {!invoiced && !isCancelled && challan.customer && (
            <Link href={`/admin/invoices/new?challanId=${challan.id}`}>
              <Button size="sm" variant="ghost">Create Invoice</Button>
            </Link>
          )}

          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>⋯</Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                  {!isCancelled && (
                    <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('cancel'); }}>
                      Cancel Challan
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

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <Badge status={challan.status}>{challan.status}</Badge>
          <Badge tone={invoiced ? 'green' : 'gray'}>
            {invoiced ? 'Invoiced' : 'Not invoiced'}
          </Badge>
          {orderInvoice && challan.invoiceStatus !== 'INVOICED' && (
            <span className="text-muted-foreground">
              Order billed on{' '}
              <Link href={`/admin/invoices/${orderInvoice.id}`} className="font-medium text-gold-ink hover:underline">
                {orderInvoice.invoiceNumber}
              </Link>
            </span>
          )}
          <span className="text-muted-foreground">
            {CHALLAN_TYPE_LABEL[challan.challanType] ?? challan.challanType}
          </span>
          {challanOrders.length > 0 && (
            <span className="text-muted-foreground">
              Sales order{challanOrders.length > 1 ? 's' : ''}:{' '}
              {challanOrders.map((o, i) => (
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
          {challan.stockMoved ? (
            <Badge tone="amber">
              Holding stock at {challan.location?.name ?? 'the warehouse'}
            </Badge>
          ) : challanOrders.length ? (
            <span className="text-xs text-muted-foreground">
              Stock is tracked by the order&rsquo;s fulfilment, not this challan
            </span>
          ) : null}
          {challan.sourceOfSupplyCode && challan.placeOfSupplyCode && (
            <Badge tone={intraState ? 'green' : 'blue'}>
              {stateName(challan.sourceOfSupplyCode)} → {stateName(challan.placeOfSupplyCode)}
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
            termsDocType="delivery_challan"
          />
        </div>
      )}

      {showPdf ? (
        <DocumentPdf
          template={template}
          title="DELIVERY CHALLAN"
          org={org}
          ribbon={
            isCancelled
              ? { label: 'Cancelled', tone: 'red' }
              : isDraft
                ? { label: 'Draft', tone: 'amber' }
                : isReturned
                  ? { label: 'Returned', tone: 'green' }
                  : { label: challan.status === 'DELIVERED' ? 'Delivered' : 'Open', tone: 'blue' }
          }
          numberLabel="Challan#"
          numberValue={challan.challanNumber}
          balanceLabel="Total Value"
          balanceValue={money(challan.grandTotal)}
          party={{
            heading: 'Bill To',
            name: challan.customer?.displayName ?? '—',
            lines: addressLines(challan.billingAddress),
            gstin: challan.gstin,
          }}
          deliverTo={{
            heading: 'Deliver To',
            name: challan.customer?.displayName ?? '—',
            lines: addressLines(challan.shippingAddress ?? challan.billingAddress),
          }}
          meta={[
            { label: 'Challan Date', value: shortDate(challan.challanDate) },
            {
              label: 'Challan Type',
              value: CHALLAN_TYPE_LABEL[challan.challanType] ?? challan.challanType,
            },
            ...(challan.referenceNumber
              ? [{ label: 'Reference#', value: challan.referenceNumber }]
              : []),
            ...(challanOrders.length
              ? [{ label: challanOrders.length > 1 ? 'Order Numbers' : 'Order Number', value: challanOrders.map((o) => o.orderNumber).join(', ') }]
              : []),
            ...(challan.placeOfSupplyCode
              ? [{
                  label: 'Place Of Supply',
                  value: `${stateName(challan.placeOfSupplyCode)} (${challan.placeOfSupplyCode})`,
                }]
              : []),
            ...(challan.transporter ? [{ label: 'Transporter', value: challan.transporter }] : []),
            ...(challan.vehicleNumber
              ? [{ label: 'Vehicle Number', value: challan.vehicleNumber }]
              : []),
            ...(challan.ewayBillNumber
              ? [{ label: 'E-Way Bill#', value: challan.ewayBillNumber }]
              : []),
          ]}
          lines={challan.lines.map((l) => ({
            name: l.itemName,
            description: l.description ?? l.sku,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            unit: l.unit,
            rate: l.rate,
            mrp: l.mrp,
            discount: lineDiscountText(l, money),
            taxRate: l.taxRate,
            cgstAmount: l.cgstAmount,
            sgstAmount: l.sgstAmount,
            igstAmount: l.igstAmount,
            amount: l.lineTotal,
          }))}
          totals={totals}
          amountInWords={amountInWords(challan.grandTotal)}
          notes={challan.customerNotes}
          terms={challan.terms}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <Card title="Items" padded={false}>
              <Table dense minWidth={hasMrp || hasLineDiscount ? '900px' : '760px'}>
                <thead>
                  <tr>
                    <Th>ITEM</Th>
                    <Th className="text-right">QTY</Th>
                    {hasMrp && <Th className="text-right">MRP</Th>}
                    <Th className="text-right">SELLING PRICE</Th>
                    {hasMrp && <Th className="text-right">OFF MRP</Th>}
                    {hasLineDiscount && <Th className="text-right">DISCOUNT</Th>}
                    <Th className="text-right">AMOUNT</Th>
                  </tr>
                </thead>
                <tbody>
                  {challan.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/60">
                      <Td>
                        <div className="flex items-start gap-2.5">
                          <Thumb url={l.imageUrl} label={l.itemName} />
                          <div className="min-w-0">
                            <div className="font-medium">{l.itemName}</div>
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
                      <Td className="whitespace-nowrap text-right font-medium">
                        {money(l.lineTotal)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Totals">
              <dl className="space-y-1.5 text-sm">
                {totals.map((t) => (
                  <div key={t.label} className={`flex justify-between ${t.strong ? 'font-semibold' : ''}`}>
                    <dt className="text-muted-foreground">
                      {t.label}
                      {t.sub && (
                        <span className={`block text-xs ${t.negative ? 'text-destructive' : 'text-muted-foreground'}`}>{t.sub}</span>
                      )}
                    </dt>
                    <dd className={t.negative ? 'text-destructive' : ''}>{t.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                A challan declares value for the road. Nothing is owed on it — the invoice does that.
              </p>
            </Card>

            {(challan.transporter || challan.vehicleNumber || challan.ewayBillNumber) && (
              <Card title="Transport">
                <dl className="space-y-1.5 text-sm">
                  {[
                    ['Transporter', challan.transporter],
                    ['Vehicle', challan.vehicleNumber],
                    ['E-way bill', challan.ewayBillNumber],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label as string} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-right">{value}</dd>
                      </div>
                    ))}
                </dl>
              </Card>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={dialog === 'return'}
        title="Mark these goods as returned?"
        message={
          challan.stockMoved
            ? `${challan.challanNumber} is holding stock — marking it returned puts those units back on the shelf.`
            : `${challan.challanNumber} will be marked returned.`
        }
        confirmLabel="Mark returned"
        busy={busy === 'Returned'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Returned', () => api.post(`/delivery-challans/${challan.id}/return`))}
      />

      <ConfirmModal
        open={dialog === 'cancel'}
        title="Cancel this challan?"
        message={
          challan.stockMoved
            ? `${challan.challanNumber} is holding stock — cancelling releases it.`
            : `${challan.challanNumber} will be cancelled. The number stays used.`
        }
        confirmLabel="Cancel challan"
        busy={busy === 'Cancelled'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Cancelled', () => api.post(`/delivery-challans/${challan.id}/cancel`))}
      />

      <ConfirmModal
        open={dialog === 'delete'}
        title="Delete this challan?"
        message={`${challan.challanNumber} will be removed${challan.stockMoved ? ', and the stock it holds will be released' : ''}.`}
        confirmLabel="Delete"
        busy={busy === 'Deleted'}
        onClose={() => setDialog('')}
        onConfirm={() =>
          act('Deleted', () => api.del(`/delivery-challans/${challan.id}`), '/delivery-challans')
        }
      />
    </>
  );
}
