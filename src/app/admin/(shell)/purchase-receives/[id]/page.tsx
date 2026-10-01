'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, shortDate, money, errorMessage } from '@/lib/api';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import { ConfirmModal } from '@/components/Modal';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Loading, PageHeader,
  Table, Td, Th, Spinner,
} from '@/components/ui';
import { useToast } from '@/lib/toast';
import { ReceiptBatches, type ReceiptCredit } from '@/components/quality/ReceiptBatches';
import type { QcSummary, ReceiptLot } from '@/lib/quality';

type ReceiveLine = {
  id: string;
  poLineId: string;
  itemId: string;
  quantityReceived: string;
  quantityRejected: string;
  quantityBilled: string;
  lotNo: string | null;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  artworkVersion: string | null;
  unitCost: string;
  notes: string | null;
  item?: {
    id: string; name: string; sku: string | null; unit: string;
    hsnCode: string | null; imageUrls: string[];
  } | null;
};

type Receipt = {
  id: string;
  receiveNumber: string;
  receiveDate: string;
  status: string;
  billedStatus: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  notes: string | null;
  quantity: number;
  vendor: { id: string; displayName: string; email: string | null; gstin: string | null } | null;
  purchaseOrder: {
    id: string;
    poNumber: string;
    poDate: string;
    status: string;
    lines: { id: string; itemId: string; itemName: string; description: string | null; quantity: string; quantityReceived: string; unit: string; rate: string }[];
  } | null;
  bill: {
    id: string;
    billNumber: string;
    billDate: string;
    status: string;
    lines: { id: string; itemId: string | null; itemName: string; description: string | null; quantity: string; rate: string; unit?: string }[];
  } | null;
  location: { id: string; name: string; code: string } | null;
  lines: ReceiveLine[];
  bills: { id: string; billNumber: string; billDate: string; status: string; grandTotal: string }[];
  lots: ReceiptLot[];
  vendorCredits: ReceiptCredit[];
  qc: QcSummary | null;
};

export default function PurchaseReceiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);

  const [showPdf, setShowPdf] = usePdfView('purchase_receive');
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'' | 'delete' | 'transit' | 'received' | 'draft'>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: Receipt }>(`/purchase-receives/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setReceipt(res.data);
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

  const setStatus = (status: string, label: string) =>
    act(label, () => api.post(`/purchase-receives/${id}/status`, { status }));

  if (loading) return <Loading />;
  if (!receipt) {
    return <ErrorBox message={error || 'Purchase receive not found'} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const isReceived = receipt.status === 'RECEIVED';
  const billed = receipt.billedStatus === 'FULL';
  const orderedByLine = new Map(
    (receipt.purchaseOrder?.lines ?? receipt.bill?.lines ?? []).map((l) => [l.id, l])
  );

  const menuItem =
    'block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <>
      <div className="print:hidden">
        <div className="mb-1 text-xs text-muted-foreground">
          Location:{' '}
          <span className="text-foreground">{receipt.location?.name ?? '—'}</span>
        </div>

        <PageHeader
          title={receipt.receiveNumber}
        />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          <Link href={`/admin/purchase-receives/${receipt.id}/edit`}>
            <Button size="sm" variant="ghost" title={billed ? 'Quantities are locked once billed; dates, notes and tracking can still change' : undefined}>
              ✎ Edit
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {receipt.status !== 'IN_TRANSIT' && !isReceived && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('transit')}>
              🚚 Mark as In Transit
            </Button>
          )}
          {!isReceived && (
            <Button size="sm" variant="success" onClick={() => setDialog('received')} disabled={!!busy}>
              {busy === 'Marked received' && <Spinner className="border-card/40 border-t-card" />}
              Mark as Received
            </Button>
          )}
          {isReceived && !billed && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('draft')}>
              ↩ Move back to Draft
            </Button>
          )}

          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>⋯</Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setDialog('delete'); }}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        <Card padded={false} className="mb-4">
          <button
            type="button"
            onClick={() => setLinkedOpen((v) => !v)}
            className="flex w-full items-center gap-5 px-4 py-2.5 text-left text-sm"
          >
            <span className="font-medium">
              Bills <span className="text-muted-foreground">{receipt.bills.length}</span>
            </span>
            <span className="font-medium">
              Purchase Orders <span className="text-muted-foreground">{receipt.purchaseOrder ? 1 : 0}</span>
            </span>
            <span className="ml-auto text-muted-foreground">{linkedOpen ? '▾' : '▸'}</span>
          </button>
          {linkedOpen && (
            <div className="border-t border-border px-4 py-3 text-sm">
              {receipt.bill && (
                <p className="mb-2">
                  <span className="text-muted-foreground">Raised from bill: </span>
                  <Link href={`/admin/bills/${receipt.bill.id}`} className="font-medium text-gold-ink hover:underline">
                    {receipt.bill.billNumber}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">{shortDate(receipt.bill.billDate)}</span>
                </p>
              )}
              {receipt.purchaseOrder && (
                <p className="mb-2">
                  <span className="text-muted-foreground">Purchase order: </span>
                  <Link
                    href={`/admin/purchase-orders/${receipt.purchaseOrder.id}`}
                    className="font-medium text-gold-ink hover:underline"
                  >
                    {receipt.purchaseOrder.poNumber}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {shortDate(receipt.purchaseOrder.poDate)}
                  </span>
                </p>
              )}
              {receipt.bills.length === 0 ? (
                <p className="text-muted-foreground">No bills raised yet.</p>
              ) : (
                receipt.bills.map((b) => (
                  <p key={b.id}>
                    <Link
                      href={`/admin/bills/${b.id}`}
                      className="font-medium text-gold-ink hover:underline"
                    >
                      {b.billNumber}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {shortDate(b.billDate)} · {money(b.grandTotal)}
                    </span>
                  </p>
                ))
              )}
            </div>
          )}
        </Card>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <Badge status={receipt.status}>{receipt.status.replaceAll('_', ' ')}</Badge>
          <span className="text-muted-foreground">
            Bill Status :{' '}
            <strong className={billed ? 'text-success' : 'text-warning'}>
              {billed ? 'BILLED' : receipt.billedStatus === 'PARTIAL' ? 'PARTIALLY BILLED' : 'YET TO BE BILLED'}
            </strong>
          </span>
          {receipt.trackingNumber && (
            <span className="text-muted-foreground">
              Tracking:{' '}
              {receipt.trackingUrl ? (
                <a
                  href={receipt.trackingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-gold-ink hover:underline"
                >
                  {receipt.trackingNumber}
                </a>
              ) : (
                <strong>{receipt.trackingNumber}</strong>
              )}
            </span>
          )}

          {receipt.qc?.state === 'PENDING' && <Badge tone="amber">{receipt.qc.pending} waiting for QC</Badge>}

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

        <ReceiptBatches
          receiptId={receipt.id}
          received={isReceived}
          vendorName={receipt.vendor?.displayName ?? null}
          lots={receipt.lots ?? []}
          credits={receipt.vendorCredits ?? []}
          qc={receipt.qc ?? null}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      </div>

      {showPdf ? (
        <DocumentPdf
          rateLabel="Purchase Price"
          title="PURCHASE RECEIVE"
          ribbon={
            isReceived
              ? { label: 'Received', tone: 'green' }
              : receipt.status === 'IN_TRANSIT'
                ? { label: 'In Transit', tone: 'amber' }
                : null
          }
          org={org}
          numberLabel="Receive#"
          numberValue={receipt.receiveNumber}
          party={{
            heading: 'VENDOR NAME',
            name: receipt.vendor?.displayName ?? '—',
            lines: [],
            gstin: receipt.vendor?.gstin,
          }}
          quantityLabel="Received Qty"
          meta={[
            { label: 'Date', value: shortDate(receipt.receiveDate) },
            ...(receipt.purchaseOrder
              ? [{ label: 'Purchase Order#', value: receipt.purchaseOrder.poNumber }]
              : receipt.bill
                ? [{ label: 'Bill#', value: receipt.bill.billNumber }]
                : []),
            {
              label: 'Status',
              value:
                receipt.status.charAt(0) + receipt.status.slice(1).toLowerCase().replace('_', ' '),
            },
            ...(receipt.trackingNumber ? [{ label: 'Tracking#', value: receipt.trackingNumber }] : []),
          ]}
          lines={receipt.lines.map((l) => {
            const po = orderedByLine.get(l.poLineId);
            return {
              name: l.item?.name ?? po?.itemName ?? 'Item',
              description: po?.description ?? l.notes,
              hsnCode: l.item?.hsnCode ?? null,
              quantity: l.quantityReceived,
              unit: l.item?.unit ?? po?.unit,
            };
          })}
          totals={[]}
          notes={receipt.notes}
          showSignature={false}
        />
      ) : (
        <Card>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-8">
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  PURCHASE RECEIVE
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Receive# <strong className="text-foreground">{receipt.receiveNumber}</strong>
                </p>
              </div>

              <div>
                <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                  STATUS
                </div>
                <div className="border-l-2 border-warning pl-3">
                  <div className="flex items-center gap-6 py-1 text-sm">
                    <span className="w-16 text-muted-foreground">Receive</span>
                    <Badge status={receipt.status}>{receipt.status.replaceAll('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-6 py-1 text-sm">
                    <span className="w-16 text-muted-foreground">Bill</span>
                    <span
                      className={
                        billed
                          ? 'text-success'
                          : receipt.billedStatus === 'PARTIAL'
                            ? 'text-warning'
                            : 'text-muted-foreground'
                      }
                    >
                      {billed ? 'Billed' : receipt.billedStatus === 'PARTIAL' ? 'Partially Billed' : 'Not billed'}
                    </span>
                  </div>
                </div>
              </div>

              {receipt.purchaseOrder && (
                <div className="flex gap-8 text-sm">
                  <span className="w-32 text-[11px] font-semibold tracking-wide text-muted-foreground">
                    PURCHASE ORDER#
                  </span>
                  <Link
                    href={`/admin/purchase-orders/${receipt.purchaseOrder.id}`}
                    className="font-medium text-gold-ink hover:underline"
                  >
                    {receipt.purchaseOrder.poNumber}
                  </Link>
                </div>
              )}

              {receipt.bill && (
                <div className="flex gap-8 text-sm">
                  <span className="w-32 text-[11px] font-semibold tracking-wide text-muted-foreground">
                    BILL#
                  </span>
                  <Link href={`/admin/bills/${receipt.bill.id}`} className="font-medium text-gold-ink hover:underline">
                    {receipt.bill.billNumber}
                  </Link>
                </div>
              )}

              <div className="flex gap-8 text-sm">
                <span className="w-32 text-[11px] font-semibold tracking-wide text-muted-foreground">
                  DATE
                </span>
                <span className="text-foreground">
                  {shortDate(receipt.receiveDate)}
                </span>
              </div>

              {receipt.trackingNumber && (
                <div className="flex gap-8 text-sm">
                  <span className="w-32 text-[11px] font-semibold tracking-wide text-muted-foreground">
                    TRACKING#
                  </span>
                  <span className="text-foreground">{receipt.trackingNumber}</span>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
                VENDOR NAME
              </div>
              {receipt.vendor ? (
                <Link
                  href={`/admin/vendors/${receipt.vendor.id}`}
                  className="font-medium text-gold-ink hover:underline"
                >
                  {receipt.vendor.displayName}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <Table minWidth="720px">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>ITEMS &amp; DESCRIPTION</Th>
                <Th className="text-right">QUANTITY</Th>
                <Th>BILL STATUS</Th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.length === 0 && <EmptyRow colSpan={4} />}
              {receipt.lines.map((l, i) => {
                const po = orderedByLine.get(l.poLineId);
                const image = l.item?.imageUrls?.[0];
                return (
                  <tr key={l.id}>
                    <Td className="align-top text-muted-foreground">{i + 1}</Td>
                    <Td>
                      <div className="flex items-start gap-3">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded border border-border object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded border border-border bg-muted/60" />
                        )}
                        <div>
                          {l.item ? (
                            <Link
                              href={`/admin/items/${l.item.id}`}
                              className="font-medium text-gold-ink hover:underline"
                            >
                              {l.item.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{po?.itemName ?? 'Item'}</span>
                          )}
                          {po?.description && (
                            <div className="whitespace-pre-line text-xs text-muted-foreground">
                              {po.description}
                            </div>
                          )}
                          {(l.batchNo || l.lotNo || l.artworkVersion) && (
                            <div className="text-xs text-muted-foreground">
                              {(l.batchNo || l.lotNo) && `Batch ${l.batchNo || l.lotNo}`}
                              {l.mfgDate && ` · mfg ${shortDate(l.mfgDate)}`}
                              {l.expiryDate && ` · exp ${shortDate(l.expiryDate)}`}
                              {l.artworkVersion && ` · artwork ${l.artworkVersion}`}
                            </div>
                          )}
                          {Number(l.quantityRejected) > 0 && (
                            <div className="text-xs text-destructive">
                              {Number(l.quantityRejected)} rejected
                            </div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-right align-top">
                      <strong>{Number(l.quantityReceived)}</strong>{' '}
                      <span className="text-xs text-muted-foreground">{l.item?.unit ?? po?.unit}</span>
                    </Td>
                    <Td className="align-top">
                      {Number(l.quantityBilled) > 0 ? (
                        <span className="text-sm">
                          <strong>{Number(l.quantityBilled)}</strong>{' '}
                          <span className="text-muted-foreground">Billed</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {receipt.notes && (
            <div className="mt-6">
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
                NOTES
              </div>
              <p className="whitespace-pre-line text-sm text-foreground">
                {receipt.notes}
              </p>
            </div>
          )}
        </Card>
      )}

      <ConfirmModal
        open={dialog === 'transit'}
        onClose={() => setDialog('')}
        onConfirm={() => setStatus('IN_TRANSIT', 'Marked in transit')}
        title="Mark as In Transit"
        danger={false}
        confirmLabel="Mark in transit"
        busy={!!busy}
        message="The goods are on the road but not yet ours — stock does not move, and the quantity stays in the incoming expectation on the purchase order."
      />

      <ConfirmModal
        open={dialog === 'received'}
        onClose={() => setDialog('')}
        onConfirm={() => setStatus('RECEIVED', 'Marked received')}
        title="Mark as Received"
        danger={false}
        confirmLabel="Mark received"
        busy={!!busy}
        message={`${receipt.quantity} unit(s) will clear the incoming expectation and land in on-hand stock at ${receipt.location?.name ?? 'this location'}. They wait for QC before they can be labelled or sold. Product lines need a batch number and mfg date - edit the receipt first if they are missing.`}
      />

      <ConfirmModal
        open={dialog === 'draft'}
        onClose={() => setDialog('')}
        onConfirm={() => setStatus('DRAFT', 'Moved back to draft')}
        title="Move back to Draft"
        confirmLabel="Move to draft"
        busy={!!busy}
        message="The stock this receipt added is taken back out and the purchase order is owed the goods again. Refused once QC has been done on any batch - undo the QC first."
      />

      <ConfirmModal
        open={dialog === 'delete'}
        onClose={() => setDialog('')}
        onConfirm={() =>
          act('Deleted', () => api.del(`/purchase-receives/${id}`), '/purchase-receives')
        }
        title="Delete purchase receive"
        confirmLabel="Delete"
        busy={!!busy}
        message={`${receipt.receiveNumber} will be removed${isReceived ? ', and the stock it added taken back out' : ''}. This is refused once the receipt has been billed.`}
      />
    </>
  );
}
