'use client';

import { usePdfView } from '@/lib/pdfView';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { DocumentPdf, type PdfOrg } from '@/components/DocumentPdf';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading, PageHeader,
  Select, Table, Td, Textarea, Th, Spinner,
} from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useToast } from '@/lib/toast';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

const RECEIVE_LABEL: Record<string, string> = {
  NOT_RECEIVED: 'Not received',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
};

const REFUND_LABEL: Record<string, string> = {
  NOT_REFUNDED: 'Not refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
};

type ReturnLine = {
  id: string;
  quantity: number;
  quantityAccepted: number;
  quantityRejected: number;
  refundAmount: string;
  restock: boolean;
  condition: string | null;
  orderLine: {
    id: string; name: string; variantTitle: string | null; sku: string | null;
    hsnCode: string | null; quantity: number; unitPrice: string; taxRate: string;
    imageUrl: string | null;
  } | null;
};

type SalesReturn = {
  id: string;
  returnNumber: string;
  status: string;
  receiveStatus: string;
  refundStatus: string;
  reason: string | null;
  notes: string | null;
  inspectionNotes: string | null;
  pickupAwb: string | null;
  pickupScheduledAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  refundedAt: string | null;
  refundAmount: string;
  returnTotal: string;
  restocked: boolean;
  creditOnly: boolean;
  createdAt: string;
  order: {
    id: string; orderNumber: string; grandTotal: string;
    orderStatus?: string; placedAt?: string | null;
    customer: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  } | null;
  location: { id: string; name: string } | null;
  lines: ReturnLine[];
  creditNotes: {
    id: string; creditNumber: string; creditDate: string; status: string;
    grandTotal: string; balance: string; amountRefunded: string;
  }[];
};

const customerName = (r: SalesReturn) =>
  [r.order?.customer?.firstName, r.order?.customer?.lastName].filter(Boolean).join(' ') || '—';

export default function SalesReturnDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [doc, setDoc] = useState<SalesReturn | null>(null);
  const [org, setOrg] = useState<PdfOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPdf, setShowPdf] = usePdfView('return');
  const [tab, setTab] = useState('receives');

  const [busy, setBusy] = useState('');
  const toast = useToast();
  const [reload, setReload] = useState(0);

  const [inspecting, setInspecting] = useState(false);
  const [counts, setCounts] = useState<Record<string, { accepted: string; rejected: string }>>({});
  const [inspectionNotes, setInspectionNotes] = useState('');

  const [refunding, setRefunding] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: '', gateway: 'BANK_TRANSFER', restock: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [res, orgRes] = await Promise.all([
          api.get<{ data: SalesReturn }>(`/returns/${id}`),
          api.get<{ data: PdfOrg }>('/organization').catch(() => null),
        ]);
        if (cancelled) return;
        setDoc(res.data);
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
  }, [id, reload]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError('');
    try {
      await fn();
      toast.success(label);
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  if (loading) return <Loading />;
  if (!doc) return <ErrorBox message={error || 'Return not found'} />;

  const returnedQty = doc.lines.reduce((n, l) => n + l.quantity, 0);
  const acceptedQty = doc.lines.reduce((n, l) => n + l.quantityAccepted, 0);
  const rejectedQty = doc.lines.reduce((n, l) => n + l.quantityRejected, 0);
  const liveCredits = doc.creditNotes.filter((c) => c.status !== 'VOID');
  const credited = liveCredits.reduce((n, c) => n + Number(c.grandTotal), 0);

  const inspectionValid = doc.lines.every((l) => {
    const c = counts[l.id];
    if (!c) return false;
    const total = Number(c.accepted || 0) + Number(c.rejected || 0);
    return total > 0 && total <= l.quantity;
  });

  return (
    <>
      <div className="print:hidden">
        <PageCrumb label={customerName(doc)} />

        <PageHeader title={doc.returnNumber} subtitle={doc.reason ?? undefined} />

        <div className="mb-4 flex flex-wrap items-center gap-1 border-y border-border py-2">
          {liveCredits.length === 0 && !doc.restocked && !doc.refundedAt && (
            <Link href={`/admin/returns/${doc.id}/edit`}>
              <Button size="sm" variant="ghost">✎ Edit</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 PDF/Print
          </Button>
          {doc.refundStatus !== 'REFUNDED' && doc.order?.customer && (
            <Link href={`/admin/credit-notes/new?returnId=${doc.id}`}>
              <Button size="sm" variant="primary">Refund with a Credit Note</Button>
            </Link>
          )}
          {doc.refundStatus === 'REFUNDED' && doc.refundedAt && liveCredits.length === 0 && doc.order?.customer && (
            <Link href={`/admin/credit-notes/new?returnId=${doc.id}`}>
              <Button size="sm" title="The cash refund is already recorded - the credit note is created as refunded, for the GST record">
                Raise credit note for GST
              </Button>
            </Link>
          )}

          {doc.status === 'REQUESTED' && (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={!!busy}
                onClick={() =>
                  act('Approved', () => api.post(`/returns/${doc.id}/status`, { status: 'APPROVED' }))
                }
              >
                {busy === 'Approved' && <Spinner className="border-card/40 border-t-card" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!!busy}
                onClick={() => {
                  const notes = prompt('Reject this return - why?') ?? undefined;
                  if (notes === undefined) return;
                  act('Rejected', () =>
                    api.post(`/returns/${doc.id}/status`, { status: 'REJECTED', notes })
                  );
                }}
              >
                Reject
              </Button>
            </>
          )}

          {['APPROVED', 'PICKUP_SCHEDULED'].includes(doc.status) && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                act('Marked received', () =>
                  api.post(`/returns/${doc.id}/status`, { status: 'RECEIVED' })
                )
              }
            >
              {busy === 'Marked received' && <Spinner className="border-card/40 border-t-card" />}
              Mark received
            </Button>
          )}

          {doc.status === 'RECEIVED' && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() => {
                setCounts(
                  Object.fromEntries(
                    doc.lines.map((l) => [l.id, { accepted: String(l.quantity), rejected: '0' }])
                  )
                );
                setInspectionNotes(doc.inspectionNotes ?? '');
                setInspecting(true);
              }}
            >
              Inspect
            </Button>
          )}

          {doc.status === 'INSPECTED' && doc.refundStatus !== 'REFUNDED' && (
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={() => {
                setRefundForm({
                  amount: String(Number(doc.refundAmount)),
                  gateway: 'BANK_TRANSFER',
                  restock: !doc.creditOnly && !doc.restocked,
                });
                setRefunding(true);
              }}
            >
              Refund
            </Button>
          )}
        </div>


        {doc.status === 'RECEIVED' && (
          <p className="mb-4 rounded-md border border-gold/30 bg-gold-soft/60 px-3 py-2 text-xs text-foreground">
            The goods are back, but nobody has counted them yet. <strong>Inspect</strong> records how
            many arrived fit to sell — until then no stock returns to the shelf and there is nothing
            to refund against.
          </p>
        )}

        {error && <div className="mb-4"><ErrorBox message={error} /></div>}

        <div className="mb-4 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap gap-5 border-b border-border px-4">
            {[
              ['receives', 'Receives', doc.receivedAt ? 1 : 0],
              ['credits', 'Credit Notes', doc.creditNotes.length],
              ['orders', 'Sales Orders', doc.order ? 1 : 0],
            ].map(([key, label, count]) => (
              <button
                key={key as string}
                onClick={() => setTab(key as string)}
                className={`-mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                  tab === key
                    ? 'border-border font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {(count as number) > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'receives' && (
            <Table>
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>RECEIVED AT</Th>
                  <Th className="text-right">ACCEPTED</Th>
                  <Th className="text-right">REJECTED</Th>
                  <Th>RESTOCKED</Th>
                </tr>
              </thead>
              <tbody>
                {!doc.receivedAt && (
                  <EmptyRow colSpan={5} message="The goods have not come back yet" />
                )}
                {doc.receivedAt && (
                  <tr>
                    <Td className="text-xs text-muted-foreground">
                      {shortDate(doc.receivedAt)}
                    </Td>
                    <Td>{doc.location?.name ?? '—'}</Td>
                    <Td className="text-right font-medium">{acceptedQty}</Td>
                    <Td className="text-right">
                      {rejectedQty > 0 ? (
                        <span className="text-destructive">{rejectedQty}</span>
                      ) : (
                        0
                      )}
                    </Td>
                    <Td className="text-xs">
                      {doc.creditOnly
                        ? 'Credit-only — goods stayed with the customer'
                        : doc.restocked
                          ? 'Back on the shelf'
                          : 'Not yet'}
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}

          {tab === 'credits' && (
            <Table>
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>CREDIT NOTE#</Th>
                  <Th>STATUS</Th>
                  <Th className="text-right">AMOUNT</Th>
                  <Th className="text-right">REFUNDED</Th>
                </tr>
              </thead>
              <tbody>
                {doc.creditNotes.length === 0 && (
                  <EmptyRow
                    colSpan={5}
                    message="Nothing credited yet — a sales return is refunded by a credit note"
                  />
                )}
                {doc.creditNotes.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td className="text-xs text-muted-foreground">
                      {shortDate(c.creditDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/credit-notes/${c.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {c.creditNumber}
                      </Link>
                    </Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                    <Td className="text-right">{money(c.grandTotal)}</Td>
                    <Td className="text-right font-medium">{money(c.amountRefunded)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {tab === 'orders' && (
            <Table>
              <thead>
                <tr>
                  <Th>SALES ORDER#</Th>
                  <Th>DATE</Th>
                  <Th>STATUS</Th>
                  <Th className="text-right">ORDER TOTAL</Th>
                </tr>
              </thead>
              <tbody>
                {!doc.order && <EmptyRow colSpan={4} message="Not against a sales order" />}
                {doc.order && (
                  <tr className="hover:bg-muted/60">
                    <Td>
                      <Link
                        href={`/admin/orders/${doc.order.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {doc.order.orderNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {doc.order.placedAt ? shortDate(doc.order.placedAt) : '—'}
                    </Td>
                    <Td>
                      <Badge status={doc.order.orderStatus ?? 'OPEN'}>
                        {(doc.order.orderStatus ?? 'OPEN').replaceAll('_', ' ')}
                      </Badge>
                    </Td>
                    <Td className="text-right">{money(doc.order.grandTotal)}</Td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Receive Status :{' '}
            <strong className="text-foreground">
              {(RECEIVE_LABEL[doc.receiveStatus] ?? doc.receiveStatus).toUpperCase()}
            </strong>
          </span>
          <span className="text-muted-foreground/60">|</span>
          <span className="text-muted-foreground">
            Refund Status :{' '}
            <strong className="text-foreground">
              {(REFUND_LABEL[doc.refundStatus] ?? doc.refundStatus).toUpperCase()}
            </strong>
          </span>
          <span className="text-muted-foreground">
            Returned : <strong className="text-foreground">{returnedQty}</strong>
            {' '}unit(s) · {money(doc.returnTotal)}
          </span>
          {doc.creditOnly && <Badge tone="amber">Credit-only</Badge>}

          <label className="ml-auto flex cursor-pointer items-center gap-2 italic text-muted-foreground">
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

      {showPdf ? (
        <DocumentPdf
          title="SALES RETURN"
          org={org}
          ribbon={{
            label: doc.status.replaceAll('_', ' '),
            tone: doc.status === 'REJECTED' ? 'red' : doc.status === 'COMPLETED' ? 'green' : 'blue',
          }}
          numberLabel="RMA#"
          numberValue={doc.returnNumber}
          balanceLabel="Amount Refunded"
          balanceValue={money(doc.refundAmount)}
          party={{
            heading: 'Returned By',
            name: customerName(doc),
            lines: doc.order?.customer?.email ? [doc.order.customer.email] : [],
          }}
          meta={[
            { label: 'Return Date', value: shortDate(doc.createdAt) },
            ...(doc.order ? [{ label: 'Sales Order#', value: doc.order.orderNumber }] : []),
            ...(doc.reason ? [{ label: 'Reason', value: doc.reason }] : []),
            ...(doc.receivedAt ? [{ label: 'Received On', value: shortDate(doc.receivedAt) }] : []),
            ...(doc.pickupScheduledAt
              ? [{ label: 'Pickup Scheduled', value: shortDate(doc.pickupScheduledAt) }]
              : []),
            ...(doc.pickupAwb ? [{ label: 'Pickup AWB', value: doc.pickupAwb }] : []),
          ]}
          quantityLabel="Returned Qty"
          lines={doc.lines.map((l) => ({
            name: [l.orderLine?.name, l.orderLine?.variantTitle].filter(Boolean).join(' - '),
            description: l.condition ?? l.orderLine?.sku,
            hsnCode: l.orderLine?.hsnCode,
            quantity: l.quantity,
            rate: l.orderLine?.unitPrice,
            amount: l.refundAmount,
          }))}
          totals={[
            { label: 'Returned Value', value: money(doc.returnTotal) },
            ...(credited > 0
              ? [{ label: 'Credited', value: `(-) ${money(credited)}`, negative: true }]
              : []),
            { label: 'Amount Refunded', value: money(doc.refundAmount), strong: true },
          ]}
          notes={doc.notes}
          terms={doc.inspectionNotes ? `Inspection: ${doc.inspectionNotes}` : null}
        />
      ) : (
        <div className="space-y-5">
          <Card title="Returned items" padded={false}>
            <Table minWidth="820px">
              <thead>
                <tr>
                  <Th>ITEM</Th>
                  <Th className="text-right">RETURNED QTY</Th>
                  <Th className="text-right">ACCEPTED</Th>
                  <Th className="text-right">REJECTED</Th>
                  <Th>RESTOCK</Th>
                  <Th className="text-right">VALUE</Th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.length === 0 && <EmptyRow colSpan={6} message="No lines" />}
                {doc.lines.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/60">
                    <Td>
                      <div className="flex items-start gap-2.5">
                        <Thumb
                          url={l.orderLine?.imageUrl}
                          label={l.orderLine?.name ?? '?'}
                        />
                        <div className="min-w-0">
                          <div className="font-medium">
                            {[l.orderLine?.name, l.orderLine?.variantTitle]
                              .filter(Boolean)
                              .join(' - ')}
                          </div>
                          {l.condition && (
                            <div className="text-xs text-muted-foreground">
                              {l.condition}
                            </div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right">{l.quantity}</Td>
                    <Td className="text-right">{l.quantityAccepted}</Td>
                    <Td className="text-right">
                      {l.quantityRejected > 0 ? (
                        <span className="text-destructive">{l.quantityRejected}</span>
                      ) : (
                        0
                      )}
                    </Td>
                    <Td className="text-xs">
                      {l.restock ? 'Back to stock' : 'Not restocked'}
                    </Td>
                    <Td className="text-right font-medium">{money(l.refundAmount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title={`Credit Notes ${doc.creditNotes.length}`} padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>DATE</Th>
                  <Th>CREDIT NOTE#</Th>
                  <Th>STATUS</Th>
                  <Th className="text-right">AMOUNT</Th>
                  <Th className="text-right">REFUNDED</Th>
                </tr>
              </thead>
              <tbody>
                {doc.creditNotes.length === 0 && (
                  <EmptyRow
                    colSpan={5}
                    message="Nothing credited yet — a sales return is refunded by a credit note"
                  />
                )}
                {doc.creditNotes.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td className="text-xs text-muted-foreground">
                      {shortDate(c.creditDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/credit-notes/${c.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {c.creditNumber}
                      </Link>
                    </Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                    <Td className="text-right">{money(c.grandTotal)}</Td>
                    <Td className="text-right font-medium">{money(c.amountRefunded)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      <Modal
        open={inspecting}
        onClose={() => setInspecting(false)}
        title={`Inspect ${doc.returnNumber}`}
        width="max-w-3xl"
        footer={
          <>
            <Button type="button" onClick={() => setInspecting(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!!busy || !inspectionValid}
              onClick={() =>
                act('Inspection recorded', async () => {
                  await api.post(`/returns/${doc.id}/inspect`, {
                    inspectionNotes: inspectionNotes.trim() || undefined,
                    lines: doc.lines.map((l) => ({
                      returnLineId: l.id,
                      quantityAccepted: Number(counts[l.id]?.accepted || 0),
                      quantityRejected: Number(counts[l.id]?.rejected || 0),
                    })),
                  });
                  setInspecting(false);
                })
              }
            >
              {busy === 'Inspection recorded' && (
                <Spinner className="border-card/40 border-t-card" />
              )}
              Record inspection
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Count what actually arrived. <strong>Accepted</strong> units go back on the shelf as
            sellable and are what the customer gets credited for. <strong>Rejected</strong> units are
            back in the building but quarantined &mdash; returned damaged, and not creditable.
          </p>

          <Table minWidth="620px">
            <thead>
              <tr>
                <Th>ITEM</Th>
                <Th className="text-right">RETURNED</Th>
                <Th className="text-right">ACCEPTED</Th>
                <Th className="text-right">REJECTED</Th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => {
                const c = counts[l.id] ?? { accepted: '0', rejected: '0' };
                const over = Number(c.accepted || 0) + Number(c.rejected || 0) > l.quantity;
                return (
                  <tr key={l.id}>
                    <Td>
                      <span className="font-medium">{l.orderLine?.name ?? 'Item'}</span>
                      {l.orderLine?.sku && (
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {l.orderLine.sku}
                        </span>
                      )}
                      {over && (
                        <span className="block text-[11px] text-destructive">
                          More than the {l.quantity} returned
                        </span>
                      )}
                    </Td>
                    <Td className="text-right text-muted-foreground">{l.quantity}</Td>
                    <Td>
                      <Input
                        type="number"
                        min="0"
                        max={l.quantity}
                        value={c.accepted}
                        onChange={(e) =>
                          setCounts((p) => ({ ...p, [l.id]: { ...c, accepted: e.target.value } }))
                        }
                        className="w-20 text-right"
                      />
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        min="0"
                        max={l.quantity}
                        value={c.rejected}
                        onChange={(e) =>
                          setCounts((p) => ({ ...p, [l.id]: { ...c, rejected: e.target.value } }))
                        }
                        className="w-20 text-right"
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Field label="Inspection notes" hint="What condition the goods arrived in">
            <Textarea
              rows={2}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={refunding}
        onClose={() => setRefunding(false)}
        title={`Refund ${doc.returnNumber}`}
        width="max-w-lg"
        footer={
          <>
            <Button type="button" onClick={() => setRefunding(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                act('Refunded', async () => {
                  await api.post(`/returns/${doc.id}/refund`, {
                    amount: Number(refundForm.amount || 0),
                    gateway: refundForm.gateway,
                    restock: refundForm.restock,
                  });
                  setRefunding(false);
                })
              }
            >
              {busy === 'Refunded' && <Spinner className="border-card/40 border-t-card" />}
              Refund
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Amount"
            hint={`Inspection accepted ${acceptedQty} unit(s), worth ${money(doc.refundAmount)}`}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={refundForm.amount}
              onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
            />
          </Field>

          <Field label="Refund through">
            <Select
              value={refundForm.gateway}
              onChange={(e) => setRefundForm({ ...refundForm, gateway: e.target.value })}
              className="w-full"
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="UPI">UPI</option>
              <option value="RAZORPAY">Razorpay</option>
              <option value="CARD">Card</option>
              <option value="COD">Cash</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </Field>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={refundForm.restock}
              disabled={doc.creditOnly || doc.restocked}
              onChange={(e) => setRefundForm({ ...refundForm, restock: e.target.checked })}
            />
            <span className="text-foreground">
              Put the accepted units back into stock
              <span className="block text-xs text-muted-foreground">
                {doc.creditOnly
                  ? 'Off: this is a credit-only return — the customer keeps the goods.'
                  : doc.restocked
                    ? 'Off: this return has already been restocked once.'
                    : `${acceptedQty} unit(s) go back on the shelf as sellable.`}
              </span>
            </span>
          </label>
        </div>
      </Modal>
    </>
  );
}
