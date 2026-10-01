'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, errorMessage, todayIso } from '@/lib/api';
import { stateName } from '@/lib/states';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { PdfCustomize, type PdfTemplate } from '@/components/PdfCustomize';
import { Modal, ConfirmModal } from '@/components/Modal';
import { usePaymentTerms } from '@/components/PaymentTermSelect';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Thumb } from '@/components/SearchSelect';

type Line = {
  id: string;
  itemId: string;
  itemName: string;
  imageUrl?: string | null;
  description: string | null;
  hsnCode: string | null;
  unit: string;
  quantity: string;
  quantityReceived: string;
  quantityBilled: string;
  rate: string;
  discountPercent: string | null;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
  item?: { id: string; name: string; sku: string | null; unit: string } | null;
};

type Receive = {
  id: string;
  receiveNumber: string;
  receiveDate: string;
  status: string;
  billedStatus: string;
  notes: string | null;
  lines: { id: string; poLineId: string; quantityReceived: string; quantityRejected: string }[];
};

type PO = {
  id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  referenceNumber: string | null;
  status: string;
  receivedStatus: string;
  billedStatus: string;
  paymentTerms: string;
  shipmentPreference: string | null;
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
  taxWithholdingType: 'TDS' | 'TCS' | null;
  taxWithholdingTaxId: string | null;
  taxWithholdingName: string | null;
  taxWithholdingRate: string | null;
  taxWithholdingAmount: string;
  shippingCharge: string;
  adjustment: string;
  adjustmentLabel: string | null;
  roundOff?: string;
  roundOffManual?: boolean;
  grandTotal: string;
  originalGrandTotal?: string | null;
  amendmentCount?: number;
  amendedAt?: string | null;
  amendments?: {
    id: string;
    billId: string | null;
    billNumber: string | null;
    adminName: string | null;
    createdAt: string;
    previousTotal: string;
    newTotal: string;
    changes: {
      lineId: string;
      itemName: string;
      removed?: boolean;
      before: { quantity: number; rate: number; taxRate?: number; discountPercent?: number | null };
      after: { quantity: number; rate: number; taxRate?: number; discountPercent?: number | null };
    }[];
  }[];
  customerNotes: string | null;
  termsConditions: string | null;
  pdfTemplate: string | null;
  deliveryTarget: 'LOCATION' | 'CUSTOMER';
  deliveryLocationId: string | null;
  deliveryCustomerId: string | null;
  vendor: {
    id: string; displayName: string; gstin: string | null; email?: string | null;
    sourceOfSupplyCode?: string | null;
  } | null;
  location: { id: string; code: string; name: string; stateCode?: string | null } | null;
  lines: Line[];
  receives?: Receive[];
};

type ReceiveDraft = Record<string, { qty: string; rejected: string; batchNo: string; mfgDate: string; expiryDate: string }>;

const STATUS_TONE: Record<string, 'green' | 'amber' | 'gray'> = {
  FULL: 'green',
  PARTIAL: 'amber',
  NONE: 'gray',
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { label: termName } = usePaymentTerms();
  const router = useRouter();

  const [po, setPo] = useState<PO | null>(null);
  const [advances, setAdvances] = useState<
    { id: string; paymentNumber: string; paymentDate: string; amount: string; unapplied: number }[]
  >([]);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [vendorAddress, setVendorAddress] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);

  const [showPdf, setShowPdf] = usePdfView('purchase_order');
  const [template, setTemplate] = useState<PdfTemplate>('standard');
  const [deliverTo, setDeliverTo] = useState<{ name: string; lines: string[] } | null>(null);
  const [receivesOpen, setReceivesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [receiving, setReceiving] = useState(false);
  const [draft, setDraft] = useState<ReceiveDraft>({});

  const [dialog, setDialog] = useState<
    '' | 'email' | 'delivery' | 'cancelItems' | 'markReceived' | 'cancel' | 'delete' | 'bill' | 'share'
  >('');
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' });
  const [deliveryDate, setDeliveryDate] = useState('');

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: PO }>(`/purchase-orders/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;

        setPo(res.data);
        setOrg(orgRes?.data ?? null);
        setError('');

        api
          .get<{ data: { id: string; paymentNumber: string; paymentDate: string; amount: string; unapplied: number }[] }>(
            '/bills/payments',
            { purchaseOrderId: res.data.id, limit: 100 }
          )
          .then((r) => {
            if (!cancelled) setAdvances(r.data);
          })
          .catch(() => {});
        if (res.data.pdfTemplate) setTemplate(res.data.pdfTemplate as PdfTemplate);
        setDeliveryDate(res.data.expectedDeliveryDate?.slice(0, 10) ?? '');

        const d: ReceiveDraft = {};
        for (const l of res.data.lines) {
          const outstanding = Number(l.quantity) - Number(l.quantityReceived ?? 0);
          d[l.id] = {
            qty: outstanding > 0 ? String(outstanding) : '0',
            rejected: '0',
            batchNo: '',
            mfgDate: '',
            expiryDate: '',
          };
        }
        setDraft(d);

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
              ? ([a.line1, a.line2, `${a.city}, ${a.state}`, `${a.country} ${a.pincode}`].filter(
                  Boolean
                ) as string[])
              : []
          );
        }
        if (res.data.deliveryTarget === 'CUSTOMER' && res.data.deliveryCustomerId) {
          const c = await api
            .get<{ data: { firstName: string | null; lastName: string | null; addresses: { line1: string; line2?: string | null; city: string; state: string; pincode: string; country: string }[] } }>(
              `/customers/${res.data.deliveryCustomerId}`
            )
            .catch(() => null);
          if (cancelled) return;
          const addr = c?.data.addresses?.[0];
          setDeliverTo({
            name: [c?.data.firstName, c?.data.lastName].filter(Boolean).join(' ') || 'Customer',
            lines: addr
              ? ([addr.line1, addr.line2, `${addr.city} ${addr.state} ${addr.pincode}`, addr.country].filter(
                  Boolean
                ) as string[])
              : [],
          });
        } else {
          const target = res.data.deliveryLocationId ?? res.data.location?.id;
          const l = target
            ? await api
                .get<{ data: { name: string; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; pincode: string | null; country: string | null } }>(
                  `/locations/${target}`
                )
                .catch(() => null)
            : null;
          if (cancelled) return;
          const d = l?.data;
          setDeliverTo(
            d
              ? {
                  name: d.name,
                  lines: [
                    d.addressLine1,
                    d.addressLine2,
                    [d.city, d.state, d.pincode].filter(Boolean).join(' '),
                    d.country ?? 'India',
                  ].filter(Boolean) as string[],
                }
              : null
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

  function flash(m: string) {
    toast.success(m);
  }

  async function act(label: string, fn: () => Promise<unknown>, opts?: { redirect?: string }) {
    setBusy(label);
    setError('');
    setMenuOpen(false);
    try {
      await fn();
      if (opts?.redirect) {
        router.push(opts.redirect);
        return;
      }
      flash(label);
      setDialog('');
      reload();
    } catch (err) {
      setError(errorMessage(err));
      setDialog('');
    } finally {
      setBusy('');
    }
  }

  async function submitReceive() {
    const lines = Object.entries(draft)
      .filter(([, v]) => Number(v.qty) > 0)
      .map(([poLineId, v]) => ({
        poLineId,
        quantityReceived: Number(v.qty),
        quantityRejected: Number(v.rejected || 0),
        batchNo: v.batchNo.trim() || undefined,
        mfgDate: v.mfgDate || undefined,
        expiryDate: v.expiryDate || undefined,
      }));

    if (!lines.length) {
      setError('Enter a received quantity on at least one line');
      return;
    }
    await act('Goods received', async () => {
      await api.post(`/purchase-orders/${id}/receive`, {
        receiveDate: todayIso(),
        lines,
      });
      setReceiving(false);
    });
  }

  async function convertToBill() {
    if (!po) return;
    const lines = po.lines
      .map((l) => ({
        poLineId: l.id,
        itemId: l.itemId,
        itemName: l.itemName,
        description: l.description ?? undefined,
        hsnCode: l.hsnCode ?? undefined,
        quantity: Number(l.quantity) - Number(l.quantityBilled ?? 0),
        rate: Number(l.rate),
        discountPercent: l.discountPercent ? Number(l.discountPercent) : undefined,
        taxRate: Number(l.taxRate),
      }))
      .filter((l) => l.quantity > 0);

    if (!lines.length) {
      setError('Every line on this order has already been billed');
      setDialog('');
      return;
    }

    const firstBill = po.lines.every((l) => Number(l.quantityBilled ?? 0) === 0);

    await act('Converted to bill', async () => {
      const res = await api.post<{ data: { id: string } }>('/bills', {
        vendorId: po.vendor!.id,
        purchaseOrderId: po.id,
        orderNumber: po.poNumber,
        billDate: todayIso(),
        paymentTerms: po.paymentTerms,
        taxTreatment: po.taxTreatment,
        discountLevel: po.discountLevel,
        discountPercent: po.discountPercent ? Number(po.discountPercent) : undefined,
        isReverseCharge: po.isReverseCharge,
        sourceOfSupplyCode: po.sourceOfSupplyCode ?? undefined,
        destinationOfSupplyCode: po.destinationOfSupplyCode ?? undefined,
        adjustment: firstBill ? Number(po.adjustment ?? 0) : 0,
        adjustmentLabel: firstBill ? (po.adjustmentLabel ?? undefined) : undefined,
        shippingCharge: firstBill ? Number(po.shippingCharge ?? 0) : 0,
        roundOff: firstBill && po.roundOffManual ? Number(po.roundOff ?? 0) : null,
        taxWithholdingType: po.taxWithholdingTaxId ? po.taxWithholdingType : undefined,
        taxWithholdingTaxId: po.taxWithholdingTaxId ?? undefined,
        status: 'OPEN',
        lines,
      });
      router.push(`/admin/bills/${res.data.id}`);
    });
  }

  if (loading) return <Loading />;
  if (!po) return <ErrorBox message={error || 'Purchase order not found'} onRetry={reload} />;

  const canIssue = po.status === 'DRAFT';
  const canReceive = ['ISSUED', 'PARTIALLY_RECEIVED'].includes(po.status);
  const canCancel = !['RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status);
  const canEdit = !['CANCELLED', 'CLOSED'].includes(po.status);
  const outstanding = po.lines.reduce(
    (n, l) => n + Math.max(0, Number(l.quantity) - Number(l.quantityReceived ?? 0)),
    0
  );
  const fullyBilled = po.billedStatus === 'FULL';

  const rates = [...new Set(po.lines.map((l) => Number(l.taxRate)))];
  const uniformRate = rates.length === 1 ? rates[0] : null;

  const intraState =
    !!po.sourceOfSupplyCode &&
    !!po.destinationOfSupplyCode &&
    po.sourceOfSupplyCode === po.destinationOfSupplyCode;

  const totals = [
    { label: 'Sub Total', value: money(Number(po.subtotal) + Number(po.discountTotal)) },
    ...(Number(po.discountTotal) > 0
      ? [{
          label: `Discount${po.discountPercent && Number(po.discountPercent) > 0 ? ` (${Number(po.discountPercent)}%)` : ''}`,
          value: `(-) ${money(po.discountTotal)}`,
          negative: true,
        }]
      : []),
    ...(intraState
      ? [
          { label: `CGST${uniformRate != null ? `${uniformRate / 2} (${uniformRate / 2}%)` : ''}`, value: money(po.cgstTotal) },
          { label: `SGST${uniformRate != null ? `${uniformRate / 2} (${uniformRate / 2}%)` : ''}`, value: money(po.sgstTotal) },
        ]
      : [
          {
            label: `IGST${uniformRate != null ? `${uniformRate} (${uniformRate}%)` : ''}`,
            value: money(po.igstTotal),
          },
        ]),
    ...(Number(po.shippingCharge) > 0
      ? [{ label: 'Shipping', value: money(po.shippingCharge) }]
      : []),
    ...(Number(po.adjustment) !== 0
      ? [{ label: po.adjustmentLabel || 'Adjustment', value: money(po.adjustment) }]
      : []),
    ...(po.taxWithholdingType
      ? [{
          label: `${po.taxWithholdingType}${po.taxWithholdingName ? ` (${po.taxWithholdingName})` : ''}`,
          value: `${po.taxWithholdingType === 'TDS' ? '(-) ' : '(+) '}${money(po.taxWithholdingAmount)}`,
          negative: po.taxWithholdingType === 'TDS',
        }]
      : []),
    ...(Number(po.roundOff ?? 0) !== 0
      ? [{ label: 'Round Off', value: money(po.roundOff ?? 0) }]
      : []),
    { label: 'Total', value: money(po.grandTotal), strong: true },
  ];

  const menuItem =
    'block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <>
      <div className="print:hidden">
        <div className="mb-1 text-xs text-muted-foreground">
          Location: <span className="text-foreground">{po.location?.name ?? '—'}</span>
        </div>

        <PageHeader
          title={po.poNumber}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {canEdit && (
            <Link href={`/admin/purchase-orders/${po.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEmailForm({
                to: po.vendor?.email ?? '',
                subject: `Purchase Order ${po.poNumber} from ${org?.legalName ?? 'OsmeKos'}`,
                body:
                  `Dear ${po.vendor?.displayName ?? 'Supplier'},\n\n` +
                  `Please find our purchase order ${po.poNumber} dated ${shortDate(po.poDate)} ` +
                  `for a total of ${money(po.grandTotal)}.\n\nRegards,\n${org?.legalName ?? 'OsmeKos'}`,
              });
              setDialog('email');
            }}
          >
            ✉ Send Email
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog('share')}>
            ↗ Share
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {canIssue && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() => act('Purchase order issued', () => api.post(`/purchase-orders/${id}/issue`))}
            >
              {busy === 'Purchase order issued' && <Spinner className="border-card/40 border-t-card" />}
              Issue
            </Button>
          )}
          {canReceive && (
            <Button size="sm" variant="ghost" onClick={() => setReceiving((v) => !v)}>
              ⇩ {receiving ? 'Cancel receiving' : 'Receive'}
            </Button>
          )}
          {!fullyBilled && po.status !== 'DRAFT' && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('bill')}>
              🧾 Convert to Bill
            </Button>
          )}

          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>
              ⋯
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('delivery'); }}>
                    Expected Delivery Date
                  </button>
                  {canReceive && (
                    <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('cancelItems'); }}>
                      Cancel Items
                    </button>
                  )}
                  {canCancel && (
                    <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('cancel'); }}>
                      Mark as Canceled
                    </button>
                  )}
                  <button
                    className={menuItem}
                    onClick={() =>
                      act('Cloned', async () => {
                        const res = await api.post<{ data: { id: string } }>(`/purchase-orders/${id}/clone`);
                        router.push(`/admin/purchase-orders/${res.data.id}`);
                      })
                    }
                  >
                    Clone
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('delete'); }}>
                    Delete
                  </button>
                  {canReceive && (
                    <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('markReceived'); }}>
                      Mark as Received
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        {po.status !== 'DRAFT' && po.status !== 'CANCELLED' && (outstanding > 0 || !fullyBilled) && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <span className="text-sm">
              <span className="mr-1">✦</span>
              <strong>WHAT&apos;S NEXT?</strong>{' '}
              <span className="text-muted-foreground">
                {outstanding > 0 && !fullyBilled
                  ? 'Convert it to a bill or create a receive to complete your purchase.'
                  : outstanding > 0
                    ? 'Create a receive to bring the goods into stock.'
                    : 'Convert it to a bill to record what you owe.'}
              </span>
            </span>
            <span className="ml-auto flex gap-2">
              {!fullyBilled && (
                <Button size="sm" variant="success" onClick={() => setDialog('bill')}>
                  Convert to Bill
                </Button>
              )}
              {outstanding > 0 && (
                <Button size="sm" onClick={() => setReceiving(true)}>Receive</Button>
              )}
            </span>
          </div>
        )}

        <Card padded={false} className="mb-4">
          <button
            type="button"
            onClick={() => setReceivesOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="text-sm font-medium">
              Receives{' '}
              <span className="text-muted-foreground">{po.receives?.length ?? 0}</span>
            </span>
            <span className="text-muted-foreground">{receivesOpen ? '▾' : '▸'}</span>
          </button>
          {receivesOpen && (
            <Table>
              <thead>
                <tr>
                  <Th>Receive#</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Billed</Th>
                  <Th className="text-right">Quantity</Th>
                </tr>
              </thead>
              <tbody>
                {!po.receives?.length && <EmptyRow colSpan={5} message="Nothing received yet" />}
                {po.receives?.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/60">
                    <Td>
                      <Link href={`/admin/purchase-receives/${r.id}`} className="font-medium text-gold-ink hover:underline">
                        {r.receiveNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs text-muted-foreground">{shortDate(r.receiveDate)}</Td>
                    <Td><Badge status={r.status}>{r.status.replaceAll('_', ' ')}</Badge></Td>
                    <Td><Badge tone={STATUS_TONE[r.billedStatus] ?? 'gray'}>{r.billedStatus}</Badge></Td>
                    <Td className="text-right">
                      {r.lines.reduce((n, l) => n + Number(l.quantityReceived), 0)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {receiving && (
          <Card title="Receive goods" className="mb-4" padded={false}>
            <Table minWidth="900px">
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="text-right">Ordered</Th>
                  <Th className="text-right">Already received</Th>
                  <Th className="text-right">Receiving now</Th>
                  <Th className="text-right">Rejected</Th>
                  <Th>Batch</Th>
                  <Th>Mfg date</Th>
                  <Th>Expiry</Th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => (
                  <tr key={l.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Thumb url={l.imageUrl} label={l.itemName} />
                        <span className="min-w-0">{l.itemName}</span>
                      </div>
                    </Td>
                    <Td className="text-right">{Number(l.quantity)}</Td>
                    <Td className="text-right">{Number(l.quantityReceived)}</Td>
                    <Td>
                      <Input
                        type="number" min="0" step="0.01"
                        value={draft[l.id]?.qty ?? '0'}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...draft[l.id], qty: e.target.value } })}
                        className="w-24 text-right"
                      />
                    </Td>
                    <Td>
                      <Input
                        type="number" min="0" step="0.01"
                        value={draft[l.id]?.rejected ?? '0'}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...draft[l.id], rejected: e.target.value } })}
                        className="w-20 text-right"
                      />
                    </Td>
                    <Td>
                      <Input
                        value={draft[l.id]?.batchNo ?? ''}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...draft[l.id], batchNo: e.target.value } })}
                        className="w-28"
                      />
                    </Td>
                    <Td>
                      <Input
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={draft[l.id]?.mfgDate ?? ''}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...draft[l.id], mfgDate: e.target.value } })}
                        className="w-36"
                      />
                    </Td>
                    <Td>
                      <Input
                        type="date"
                        value={draft[l.id]?.expiryDate ?? ''}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...draft[l.id], expiryDate: e.target.value } })}
                        className="w-36"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex gap-2 px-4 py-3">
              <Button variant="success" onClick={submitReceive} disabled={!!busy}>
                {busy === 'Goods received' && <Spinner className="border-card/40 border-t-card" />}
                Confirm receipt
              </Button>
              <Button onClick={() => setReceiving(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Receive Status :{' '}
            <strong className={po.receivedStatus === 'FULL' ? 'text-success' : 'text-warning'}>
              {po.receivedStatus === 'FULL' ? 'RECEIVED' : po.receivedStatus === 'PARTIAL' ? 'PARTIALLY RECEIVED' : 'YET TO BE RECEIVED'}
            </strong>
          </span>
          <span className="text-muted-foreground">
            Bill Status :{' '}
            <strong className={fullyBilled ? 'text-success' : 'text-warning'}>
              {fullyBilled ? 'BILLED' : po.billedStatus === 'PARTIAL' ? 'PARTIALLY BILLED' : 'YET TO BE BILLED'}
            </strong>
          </span>
          <Badge status={po.status}>{po.status.replaceAll('_', ' ')}</Badge>
          {po.isReverseCharge && <Badge tone="amber">Reverse charge</Badge>}
          {po.sourceOfSupplyCode && po.destinationOfSupplyCode && (
            <Badge tone={intraState ? 'green' : 'blue'}>
              {stateName(po.sourceOfSupplyCode)} → {stateName(po.destinationOfSupplyCode)}
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
            onTemplateChange={(t) => {
              setTemplate(t);
              api.patch(`/purchase-orders/${id}`, { pdfTemplate: t }).catch(() => {});
            }}
            org={org}
            onOrgSaved={setOrg}
            termsDocType="purchase_order"
            documentTerms={po.termsConditions ?? ''}
            onDocumentTermsSaved={
              canEdit && can('purchase-orders:write')
                ? async (terms) => {
                    await api.patch(`/purchase-orders/${id}`, { termsConditions: terms });
                  }
                : undefined
            }
            onTermsDone={() => {
              flash('Terms updated');
              reload();
            }}
          />
        </div>
      )}

      {showPdf ? (
        <DocumentPdf
          rateLabel="Purchase Price"
          template={template}
          title="PURCHASE ORDER"
          ribbon={
            po.status === 'ISSUED'
              ? { label: 'Issued', tone: 'blue' }
              : po.status === 'RECEIVED'
                ? { label: 'Received', tone: 'green' }
                : po.status === 'CANCELLED'
                  ? { label: 'Cancelled', tone: 'red' }
                  : null
          }
          org={org}
          numberLabel="#"
          numberValue={po.poNumber}
          party={{
            heading: 'Vendor Address',
            name: po.vendor?.displayName ?? '—',
            lines: vendorAddress,
            gstin: po.vendor?.gstin,
          }}
          deliverTo={
            deliverTo
              ? {
                  heading: 'Deliver To',
                  name: deliverTo.name,
                  lines: deliverTo.lines,
                  gstin: org?.gstin,
                  extras: [
                    org?.brandName ? `Brand: ${org.brandName}®` : null,
                    org?.email ?? null,
                    org?.website ?? null,
                  ].filter(Boolean) as string[],
                }
              : null
          }
          meta={[
            { label: 'Date', value: shortDate(po.poDate) },
            ...(po.expectedDeliveryDate
              ? [{ label: 'Delivery Date', value: shortDate(po.expectedDeliveryDate) }]
              : []),
            ...(po.referenceNumber ? [{ label: 'Reference', value: po.referenceNumber }] : []),
            { label: 'Terms', value: termName(po.paymentTerms) },
          ]}
          lines={po.lines.map((l) => ({
            name: l.itemName,
            description: l.description,
            hsnCode: l.hsnCode,
            quantity: l.quantity,
            unit: l.unit,
            rate: l.rate,
            amount: l.lineTotal,
          }))}
          totals={totals}
          notes={po.customerNotes}
          terms={po.termsConditions}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <Card title="Items" padded={false}>
              <Table minWidth="820px">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th className="text-right">Ordered</Th>
                    <Th className="text-right">Received</Th>
                    <Th className="text-right">Billed</Th>
                    <Th className="text-right">Purchase price</Th>
                    <Th className="text-right">Tax</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <div className="font-medium">{l.itemName}</div>
                        {l.description && (
                          <div className="text-xs text-muted-foreground">{l.description}</div>
                        )}
                      </Td>
                      <Td className="text-right">{Number(l.quantity)} {l.unit}</Td>
                      <Td className="text-right">{Number(l.quantityReceived)}</Td>
                      <Td className="text-right">{Number(l.quantityBilled ?? 0)}</Td>
                      <Td className="text-right">{money(l.rate)}</Td>
                      <Td className="text-right">{Number(l.taxRate)}%</Td>
                      <Td className="text-right font-medium">{money(l.lineTotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
          <div className="space-y-5">
            <Card title="Advance paid">
              <p className="mb-3 text-xs text-muted-foreground">
                Money paid to the vendor before the bill arrives. It waits here and can be put against the bill
                raised from this order.
              </p>
              {advances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing paid ahead on this order yet</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {advances.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3">
                      <Link href={`/admin/payments-made/${a.id}`} className="font-mono text-xs text-gold-ink hover:underline">
                        {a.paymentNumber}
                      </Link>
                      <span className="text-right">
                        <span className="block tabular-nums">{money(a.amount)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {Number(a.unapplied) > 0 ? `${money(a.unapplied)} still unused` : 'all used'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {can('payments-made:write') && po.vendor?.id && (
                <Link
                  href={`/admin/payments-made/new?type=advance&vendorId=${po.vendor.id}&purchaseOrderId=${po.id}`}
                  className="mt-3 inline-block text-sm text-gold-ink hover:underline"
                >
                  Pay an advance on this order
                </Link>
              )}
            </Card>

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
                {po.originalGrandTotal != null && Number(po.originalGrandTotal) !== Number(po.grandTotal) && (
                  <div className="flex justify-between text-xs">
                    <dt className="text-muted-foreground">
                      Originally ordered at
                      {po.amendmentCount ? ` (amended ${po.amendmentCount}×)` : ''}
                    </dt>
                    <dd className="text-muted-foreground">{money(po.originalGrandTotal)}</dd>
                  </div>
                )}
              </dl>
            </Card>
            {(po.amendments?.length ?? 0) > 0 && (
              <Card title="Amendments">
                <ol className="space-y-3 text-sm">
                  {(po.amendments ?? []).map((a) => (
                    <li key={a.id} className="border-l-2 border-gold/50 pl-3">
                      <div className="text-xs text-muted-foreground">
                        {shortDate(a.createdAt)}
                        {a.adminName ? ` · ${a.adminName}` : ''}
                        {a.billId && (
                          <>
                            {' · from '}
                            <Link href={`/admin/bills/${a.billId}`} className="text-gold-ink hover:underline">
                              {a.billNumber ?? 'bill'}
                            </Link>
                          </>
                        )}
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {a.changes.map((c, i) => (
                          <li key={i}>
                            {c.itemName}:{' '}
                            {c.removed
                              ? 'removed - nothing supplied'
                              : [
                                  c.before.quantity !== c.after.quantity &&
                                    `qty ${c.before.quantity} → ${c.after.quantity}`,
                                  c.before.rate !== c.after.rate &&
                                    `rate ${money(c.before.rate)} → ${money(c.after.rate)}`,
                                  c.before.taxRate !== c.after.taxRate &&
                                    `GST ${c.before.taxRate}% → ${c.after.taxRate}%`,
                                  (c.before.discountPercent ?? null) !== (c.after.discountPercent ?? null) &&
                                    `discount ${c.before.discountPercent ?? 0}% → ${c.after.discountPercent ?? 0}%`,
                                ]
                                  .filter(Boolean)
                                  .join(', ')}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                        {money(a.previousTotal)} → <span className="font-medium text-foreground">{money(a.newTotal)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal
        open={dialog === 'email'}
        onClose={() => setDialog('')}
        title="Send Email"
        footer={
          <>
            <Button onClick={() => setDialog('')} disabled={!!busy}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!!busy || !emailForm.to}
              onClick={() =>
                act('Email recorded', () =>
                  api.post('/emails', {
                    ownerType: 'PURCHASE_ORDER',
                    ownerId: po.id,
                    to: emailForm.to,
                    subject: emailForm.subject,
                    body: emailForm.body,
                    template: 'po_notification',
                  })
                )
              }
            >
              Send
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="To" required>
            <Input value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} />
          </Field>
          <Field label="Subject">
            <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
          </Field>
          <Field label="Message">
            <Textarea rows={6} value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} />
          </Field>
          {!po.vendor?.email && (
            <p className="text-xs text-warning">
              This vendor has no email on file — enter one above.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            With no SMTP configured the message is filed against this order rather than delivered.
          </p>
        </div>
      </Modal>

      <Modal
        open={dialog === 'share'}
        onClose={() => setDialog('')}
        title="Share"
        footer={<Button onClick={() => setDialog('')}>Close</Button>}
      >
        <Field label="Link to this purchase order">
          <Input
            readOnly
            value={typeof window !== 'undefined' ? window.location.href : ''}
            onFocus={(e) => e.currentTarget.select()}
          />
        </Field>
        <p className="mt-2 text-xs text-muted-foreground">
          Anyone opening this needs an admin account — it is not a public link.
        </p>
      </Modal>

      <Modal
        open={dialog === 'delivery'}
        onClose={() => setDialog('')}
        title="Expected Delivery Date"
        footer={
          <>
            <Button onClick={() => setDialog('')} disabled={!!busy}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                act('Delivery date updated', () =>
                  api.patch(`/purchase-orders/${id}`, {
                    expectedDeliveryDate: deliveryDate || undefined,
                  })
                )
              }
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Expected delivery">
          <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </Field>
      </Modal>

      <ConfirmModal
        open={dialog === 'bill'}
        onClose={() => setDialog('')}
        onConfirm={convertToBill}
        title="Convert to Bill"
        danger={false}
        confirmLabel="Create bill"
        busy={!!busy}
        message={`A bill will be raised against ${po.vendor?.displayName ?? 'this vendor'} for everything on ${po.poNumber} that has not been billed yet.`}
      />

      <ConfirmModal
        open={dialog === 'cancelItems'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Outstanding items cancelled', () => api.post(`/purchase-orders/${id}/cancel-items`))}
        title="Cancel Items"
        confirmLabel="Cancel outstanding"
        busy={!!busy}
        message={`Drops the ${outstanding} unit(s) still outstanding. Each line shrinks to what actually arrived, the totals are recalculated and the incoming stock expectation is released.`}
      />

      <ConfirmModal
        open={dialog === 'markReceived'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Marked received', () => api.post(`/purchase-orders/${id}/mark-received`))}
        title="Mark as Received"
        danger={false}
        confirmLabel="Mark received"
        busy={!!busy}
        message={`Receives the remaining ${outstanding} unit(s) in full. A goods receipt is written and stock moves from incoming to on hand.`}
      />

      <ConfirmModal
        open={dialog === 'cancel'}
        onClose={() => setDialog('')}
        onConfirm={() => act('Purchase order cancelled', () => api.post(`/purchase-orders/${id}/cancel`))}
        title="Mark as Canceled"
        confirmLabel="Cancel order"
        busy={!!busy}
        message={`${po.poNumber} will be cancelled and any incoming stock expectation released.`}
      />

      <ConfirmModal
        open={dialog === 'delete'}
        onClose={() => setDialog('')}
        onConfirm={() =>
          act('Deleted', () => api.del(`/purchase-orders/${id}`), { redirect: '/purchase-orders' })
        }
        title="Delete purchase order"
        confirmLabel="Delete"
        busy={!!busy}
        message={`${po.poNumber} will be removed. This is refused if goods have been received or a bill raised — close it instead.`}
      />
    </>
  );
}
