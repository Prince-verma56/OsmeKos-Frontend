'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertOctagon, ArrowDownToLine, ArrowUpFromLine, RotateCcw, ShieldCheck, Tags } from 'lucide-react';
import { api, errorMessage, money, shortDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { PageCrumb } from '@/lib/crumbs';
import { Badge, Button, Card, EmptyRow, ErrorBox, Field, Loading, PageHeader, Spinner, Table, Td, Textarea, Th } from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/Modal';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import { fmtQty, lotStatusOf, needsLabel, type LotStatus } from '@/lib/quality';
import { MarkLabelledDialog, type LabelTarget } from '@/components/quality/MarkLabelledDialog';
import { ExpiryCell } from '@/components/quality/ExpiryCell';

type LotBrief = {
  id: string;
  batchNo: string | null;
  status: LotStatus;
  quantityReceived: string;
  quantityRemaining: string;
  expiryDate: string | null;
  daysToExpiry: number | null;
  locationId: string;
  sourceType: string | null;
  needsLabelling: boolean;
  labelledAt: string | null;
  item: { id: string; name: string; sku: string | null; unit: string; itemCategory: string };
};

type Movement = {
  id: string;
  lotId: string;
  documentType: string;
  kind: string;
  number: string | null;
  href: string | null;
  date: string;
  quantity: number;
  party: { type: string; id: string; name: string | null; email?: string | null; phone?: string | null } | null;
  batchNo: string | null;
  itemName: string | null;
  isThisLot: boolean;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  quantity: number;
  documents: { kind: string; number: string | null; href: string | null; date: string; quantity: number; itemName: string | null }[];
};

type Batch = LotBrief & {
  mfgDate: string | null;
  mrp: string | null;
  unitCost: string;
  artworkVersion: string | null;
  recalledAt: string | null;
  recallReason: string | null;
  recalledBy: { id: string; name: string } | null;
  receivedAt: string;
  vendor: { id: string; displayName: string } | null;
  location: { id: string; name: string } | null;
  coa: { id: string; fileName: string; fileUrl: string } | null;
  labelledBy: { id: string; name: string } | null;
  splitFrom: { id: string; batchNo: string | null; status: string } | null;
  origin:
    | { kind: 'receipt'; id: string; receiveNumber: string; receiveDate: string; vendor: { id: string; displayName: string } | null; purchaseOrder: { id: string; poNumber: string } | null }
    | { kind: 'transfer'; id: string; docNumber: string; documentDate: string }
    | { kind: string }
    | null;
  inspections: { id: string; inspectionNumber: string; status: string; quantityAccepted: string; quantityRejected: string; rejectReason: string | null; inspectedAt: string }[];
  rejectedBy: { id: string; inspectionNumber: string; rejectReason: string | null; inspectedAt: string } | null;
  family: LotBrief[];
  movements: Movement[];
  customers: Customer[];
  totals: { received: number; remaining: number; sentToCustomers: number; familyRemaining: number };
};

export default function BatchPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [recallOpen, setRecallOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [labelTarget, setLabelTarget] = useState<LabelTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: Batch }>(`/batches/${id}`)
      .then((r) => {
        if (!cancelled) setBatch(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  async function act(path: string, body: object, done: () => void) {
    setBusy(true);
    setActionError('');
    try {
      const res = await api.post<{ message: string }>(path, body);
      toast.success(res.message);
      done();
      setReload((k) => k + 1);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!batch) return <Loading />;

  const status = lotStatusOf(batch.status);
  const canRecall = can('inventory:write');
  const recallable = ['AVAILABLE', 'EXPIRED', 'ON_HOLD'].includes(batch.status);
  const packaging = batch.item.itemCategory === 'PACKAGING';
  const unlabelled = needsLabel(batch);

  const customerColumns: Column<Customer>[] = [
    { header: 'Customer', value: (c) => c.name ?? '', width: 180 },
    { header: 'Phone', value: (c) => c.phone ?? '' },
    { header: 'Email', value: (c) => c.email ?? '', width: 180 },
    { header: 'Units', value: (c) => c.quantity, align: 'right' },
    { header: 'Documents', value: (c) => c.documents.map((d) => `${d.number ?? d.kind} (${d.quantity})`).join(', '), width: 220 },
  ];

  return (
    <>
      <PageCrumb label={batch.batchNo ?? 'Batch'} />
      <PageHeader
        eyebrow={batch.item.name}
        title={batch.batchNo ? `Batch ${batch.batchNo}` : 'Unbatched stock'}
        subtitle={[batch.location?.name, batch.vendor?.displayName && `from ${batch.vendor.displayName}`].filter(Boolean).join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {unlabelled && <Badge tone="amber">Not labelled</Badge>}
            {canRecall && unlabelled && (
              <Button
                variant="primary"
                onClick={() =>
                  setLabelTarget({ id: batch.id, batchNo: batch.batchNo, itemName: batch.item.name, remaining: Number(batch.quantityRemaining) })
                }
              >
                <Tags /> Mark as labelled
              </Button>
            )}
            {canRecall && recallable && (
              <Button variant="danger" onClick={() => { setReason(''); setActionError(''); setRecallOpen(true); }}>
                <AlertOctagon /> Recall
              </Button>
            )}
            {canRecall && batch.status === 'RECALLED' && (
              <Button variant="ghost" onClick={() => { setActionError(''); setCancelOpen(true); }}>
                <RotateCcw /> Cancel recall
              </Button>
            )}
          </div>
        }
      />

      {unlabelled && (
        <div className="mb-5 rounded-lg border border-gold/30 bg-gold-soft/60 px-4 py-3 text-sm">
          <div className="font-medium text-foreground">{fmtQty(batch.quantityRemaining)} units are not labelled yet</div>
          <p className="text-muted-foreground">
            They passed QC but can&apos;t be sold until they&apos;re labelled. Use <strong>Mark as labelled</strong> when the labels are on - all at once or a few at a time.
          </p>
        </div>
      )}

      {batch.status === 'RECALLED' && (
        <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <div className="font-medium text-destructive">Recalled{batch.recalledAt ? ` on ${shortDate(batch.recalledAt)}` : ''}</div>
          <p className="text-foreground">{batch.recallReason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Blocked from sale, including batches labelled or moved from it.
            {batch.customers.length > 0 && ` ${batch.customers.length} customer${batch.customers.length === 1 ? '' : 's'} received units - see the list below.`}
          </p>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Received', value: fmtQty(batch.totals.received) },
          { label: 'Left here', value: fmtQty(batch.totals.remaining) },
          { label: 'Sent to customers', value: fmtQty(batch.totals.sentToCustomers) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-medium tabular-nums text-foreground">{s.value}</div>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
          <div className="text-xs text-muted-foreground">{packaging ? 'Artwork' : 'Best before'}</div>
          <div className="text-lg font-medium text-foreground">
            {packaging ? batch.artworkVersion ?? '—' : <ExpiryCell date={batch.expiryDate} days={batch.daysToExpiry} />}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Where it came from">
          <ul className="space-y-3 text-sm">
            {batch.origin?.kind === 'receipt' && 'receiveNumber' in batch.origin && (
              <li className="flex gap-3">
                <ArrowDownToLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span>
                  Received on{' '}
                  <Link href={`/admin/purchase-receives/${batch.origin.id}`} className="font-mono text-gold-ink hover:underline">
                    {batch.origin.receiveNumber}
                  </Link>{' '}
                  · {shortDate(batch.origin.receiveDate)}
                  {batch.origin.vendor && ` from ${batch.origin.vendor.displayName}`}
                  {batch.origin.purchaseOrder && (
                    <>
                      {' · '}
                      <Link href={`/admin/purchase-orders/${batch.origin.purchaseOrder.id}`} className="font-mono hover:underline">
                        {batch.origin.purchaseOrder.poNumber}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            )}
            {batch.labelledAt && (
              <li className="flex gap-3">
                <Tags className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span>
                  Marked labelled {shortDate(batch.labelledAt)}
                  {batch.labelledBy && ` by ${batch.labelledBy.name}`}
                  {batch.splitFrom && (
                    <>
                      {' from '}
                      <Link href={`/admin/batches/${batch.splitFrom.id}`} className="font-mono text-gold-ink hover:underline">
                        {batch.splitFrom.batchNo ?? 'unbatched'}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            )}
            {batch.origin?.kind === 'transfer' && 'docNumber' in batch.origin && (
              <li className="flex gap-3">
                <ArrowDownToLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span>
                  Moved here on <span className="font-mono">{batch.origin.docNumber}</span> · {shortDate(batch.origin.documentDate)}
                </span>
              </li>
            )}
            {batch.origin?.kind === 'item_opening_stock' && (
              <li className="flex gap-3">
                <ArrowDownToLine className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span>
                  Opening stock, entered with{' '}
                  <Link href={`/admin/items/${batch.item.id}`} className="text-gold-ink hover:underline">
                    the item
                  </Link>{' '}
                  · {shortDate(batch.receivedAt)}
                </span>
              </li>
            )}
            {!batch.origin && <li className="text-muted-foreground">Opening stock</li>}
            {batch.inspections.map((i) => (
              <li key={i.id} className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span>
                  QC <span className="font-mono">{i.inspectionNumber}</span> · {shortDate(i.inspectedAt)} · {fmtQty(i.quantityAccepted)} accepted
                  {Number(i.quantityRejected) > 0 && `, ${fmtQty(i.quantityRejected)} rejected (${i.rejectReason ?? 'no reason'})`}
                  {i.status === 'VOIDED' && ' · undone'}
                </span>
              </li>
            ))}
            {batch.rejectedBy && (
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.5} />
                <span>
                  Rejected at QC <span className="font-mono">{batch.rejectedBy.inspectionNumber}</span>
                  {batch.rejectedBy.rejectReason && ` - ${batch.rejectedBy.rejectReason}`}
                </span>
              </li>
            )}
            {batch.coa && (
              <li className="pl-7">
                <a href={batch.coa.fileUrl} target="_blank" rel="noreferrer noopener" className="text-gold-ink hover:underline">
                  COA: {batch.coa.fileName}
                </a>
              </li>
            )}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Mfg date</dt>
              <dd>{batch.mfgDate ? shortDate(batch.mfgDate) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">MRP</dt>
              <dd>{batch.mrp ? money(batch.mrp) : '—'}</dd>
            </div>
            {can('costs:read') && (
              <div>
                <dt className="text-xs text-muted-foreground">Cost per unit</dt>
                <dd>{money(batch.unitCost)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Split and moved">
          {batch.family.length === 0 ? (
            <p className="text-sm text-muted-foreground">No part of this batch has been labelled separately, rejected or moved.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {batch.family.map((f) => {
                const s = lotStatusOf(f.status);
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-2">
                    <ArrowUpFromLine className="size-4 text-muted-foreground" strokeWidth={1.5} />
                    <Link href={`/admin/batches/${f.id}`} className="font-mono text-gold-ink hover:underline">
                      {f.batchNo ?? 'unbatched'}
                    </Link>
                    <span className="text-muted-foreground">
                      {f.item.name} · {fmtQty(f.quantityRemaining)} left
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {needsLabel(f) && <Badge tone="amber">Not labelled</Badge>}
                    {f.needsLabelling && f.labelledAt && <Badge>Labelled</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title={`Customers who received this batch (${batch.customers.length})`}
        className="mt-5"
        padded={false}
        action={
          batch.customers.length > 0 ? (
            <ExportMenu
              label="Export list"
              spec={() => ({
                title: `Batch ${batch.batchNo ?? ''} customers`,
                subtitle: `${batch.item.name} - ${batch.customers.length} customers, ${fmtQty(batch.totals.sentToCustomers)} units`,
                columns: customerColumns as Column<unknown>[],
                rows: batch.customers,
              })}
            />
          ) : null
        }
      >
        <Table minWidth="640px">
          <thead>
            <tr>
              <Th>CUSTOMER</Th>
              <Th>CONTACT</Th>
              <Th className="text-right">UNITS</Th>
              <Th>ON</Th>
            </tr>
          </thead>
          <tbody>
            {batch.customers.length === 0 && <EmptyRow colSpan={4} message="No units from this batch have gone to customers yet" />}
            {batch.customers.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-gold-ink hover:underline">
                    {c.name ?? 'Customer'}
                  </Link>
                </Td>
                <Td className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</Td>
                <Td className="text-right tabular-nums">{fmtQty(c.quantity)}</Td>
                <Td className="text-xs">
                  {c.documents.map((d, i) => (
                    <span key={`${d.number}-${i}`} className="mr-2 inline-block">
                      {d.href ? (
                        <Link href={d.href} className="font-mono text-gold-ink hover:underline">
                          {d.number}
                        </Link>
                      ) : (
                        d.number
                      )}{' '}
                      <span className="text-muted-foreground">({fmtQty(d.quantity)})</span>
                    </span>
                  ))}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="Every movement" className="mt-5" padded={false}>
        <Table minWidth="720px">
          <thead>
            <tr>
              <Th>DATE</Th>
              <Th>WHAT</Th>
              <Th>WHO</Th>
              <Th>BATCH</Th>
              <Th className="text-right">UNITS</Th>
            </tr>
          </thead>
          <tbody>
            {batch.movements.length === 0 && <EmptyRow colSpan={5} message="No units have left this batch yet" />}
            {batch.movements.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-xs text-muted-foreground">{shortDate(m.date)}</Td>
                <Td>
                  <span className="text-muted-foreground">{m.kind}</span>{' '}
                  {m.href ? (
                    <Link href={m.href} className="font-mono text-gold-ink hover:underline">
                      {m.number}
                    </Link>
                  ) : (
                    <span className="font-mono">{m.number}</span>
                  )}
                </Td>
                <Td>{m.party?.name ?? '—'}</Td>
                <Td className="text-xs">
                  {m.isThisLot ? (
                    <span className="text-muted-foreground">This batch</span>
                  ) : (
                    <span>
                      <span className="font-mono">{m.batchNo}</span> <span className="text-muted-foreground">{m.itemName}</span>
                    </span>
                  )}
                </Td>
                <Td className="text-right tabular-nums">{fmtQty(m.quantity)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal
        open={recallOpen}
        onClose={() => !busy && setRecallOpen(false)}
        title={`Recall ${batch.batchNo ? `batch ${batch.batchNo}` : 'this batch'}`}
        description="Blocks every unit left in this batch from sale, including stock labelled or moved from it. It does not contact customers - use the list on this page."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRecallOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => act(`/batches/${batch.id}/recall`, { reason: reason.trim() }, () => setRecallOpen(false))}
              disabled={busy || reason.trim().length < 5}
            >
              {busy && <Spinner />}
              Recall batch
            </Button>
          </>
        }
      >
        <Field label="Reason" required hint="Shown on the batch and in the history">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Factory reported a contamination issue" />
        </Field>
        <p className="mt-3 text-sm text-muted-foreground">
          {fmtQty(batch.totals.familyRemaining)} units in stock will be blocked. {batch.customers.length} customer
          {batch.customers.length === 1 ? '' : 's'} already received units.
        </p>
        {actionError && <p className="mt-3 text-sm text-destructive">{actionError}</p>}
      </Modal>

      <MarkLabelledDialog target={labelTarget} onClose={() => setLabelTarget(null)} onDone={() => setReload((k) => k + 1)} />

      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => act(`/batches/${batch.id}/cancel-recall`, {}, () => setCancelOpen(false))}
        title="Cancel the recall"
        danger={false}
        confirmLabel="Cancel recall"
        busy={busy}
        message={
          actionError ||
          'The batch and everything made from it can be sold again, unless it has expired in the meantime.'
        }
      />
    </>
  );
}
