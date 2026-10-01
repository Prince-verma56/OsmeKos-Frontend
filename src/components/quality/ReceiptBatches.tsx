'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CornerDownRight, ShieldCheck, Tags, Undo2 } from 'lucide-react';
import { api, errorMessage, money, shortDate, todayIso } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Field, Input, Spinner, Textarea } from '@/components/ui';
import { Checkbox } from '@/components/ui/misc';
import { Modal } from '@/components/Modal';
import { fmtQty, lotStatusOf, needsLabel, type QcSummary, type ReceiptLot } from '@/lib/quality';
import { MarkLabelledDialog, type LabelTarget } from './MarkLabelledDialog';

export type ReceiptCredit = {
  id: string;
  creditNumber: string;
  creditDate: string;
  status: string;
  grandTotal: string;
  replacementRequested: boolean;
};

type Props = {
  receiptId: string;
  received: boolean;
  vendorName: string | null;
  lots: ReceiptLot[];
  credits: ReceiptCredit[];
  qc: QcSummary | null;
  onChanged: () => void;
};

export function ReceiptBatches({ receiptId, received, vendorName, lots, credits, qc, onChanged }: Props) {
  const { can } = useAuth();
  const toast = useToast();
  const canInspect = can('qc:write');
  const canReturn = canInspect && can('vendor-credits:write');
  const canLabel = can('inventory:write');
  const [labelTarget, setLabelTarget] = useState<LabelTarget | null>(null);

  const [undo, setUndo] = useState<{ inspectionId: string; number: string; label: string } | null>(null);
  const [undoReason, setUndoReason] = useState('');
  const [returning, setReturning] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [returnForm, setReturnForm] = useState({ creditDate: todayIso(), reason: '', notes: '', requestReplacement: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ordered = useMemo(() => {
    const parents = lots.filter((l) => !l.splitFromLotId);
    const out: ReceiptLot[] = [];
    for (const p of parents) {
      out.push(p);
      out.push(...lots.filter((l) => l.splitFromLotId === p.id));
    }
    out.push(...lots.filter((l) => l.splitFromLotId && !parents.some((p) => p.id === l.splitFromLotId)));
    return out;
  }, [lots]);

  const returnable = lots.filter((l) => l.status === 'REJECTED' && Number(l.quantityRemaining) > 0);

  function openReturn(only?: ReceiptLot) {
    setError('');
    setPicks(
      Object.fromEntries(
        returnable.map((l) => [l.id, !only || only.id === l.id ? fmtQty(l.quantityRemaining) : ''])
      )
    );
    setReturnForm({ creditDate: todayIso(), reason: '', notes: '', requestReplacement: false });
    setReturning(true);
  }

  async function submitReturn() {
    const chosen = returnable
      .map((l) => ({ lotId: l.id, quantity: Number(picks[l.id] || 0) }))
      .filter((p) => p.quantity > 0);
    if (!chosen.length) {
      setError('Enter how many units go back on at least one batch');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ message: string; data: { id: string; creditNumber: string } }>(
        '/vendor-credits/return-rejected',
        {
          lots: chosen,
          creditDate: returnForm.creditDate,
          reason: returnForm.reason.trim() || undefined,
          notes: returnForm.notes.trim() || undefined,
          requestReplacement: returnForm.requestReplacement,
        }
      );
      toast.success(res.message ?? `${res.data.creditNumber} raised`);
      setReturning(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitUndo() {
    if (!undo) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ message: string }>(`/quality/inspections/${undo.inspectionId}/void`, { reason: undoReason.trim() });
      toast.success(res.message ?? 'QC undone');
      setUndo(null);
      setUndoReason('');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!received && lots.length === 0) {
    return (
      <Card title="Batches & QC" className="mb-4">
        <p className="text-sm text-muted-foreground">
          Batches appear here once the goods are marked received. Everything received then waits for QC.
        </p>
      </Card>
    );
  }

  const lotLabel = (l: ReceiptLot) => `${l.batchNo ? `batch ${l.batchNo} of ` : ''}${l.item.name}`;

  return (
    <>
      <Card
        title="Batches & QC"
        className="mb-4"
        action={
          canReturn && returnable.length > 0 ? (
            <Button size="sm" onClick={() => openReturn()}>
              <Undo2 /> Return rejected units
            </Button>
          ) : null
        }
      >
        {qc && qc.state !== 'NONE' && (
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {qc.pending > 0 && (
              <span>
                <strong className="tabular-nums text-warning">{fmtQty(qc.pending)}</strong>{' '}
                <span className="text-muted-foreground">waiting for QC</span>
              </span>
            )}
            {qc.accepted > 0 && (
              <span>
                <strong className="tabular-nums text-success">{fmtQty(qc.accepted)}</strong>{' '}
                <span className="text-muted-foreground">accepted</span>
              </span>
            )}
            {qc.toLabel > 0 && (
              <span>
                <strong className="tabular-nums text-warning">{fmtQty(qc.toLabel)}</strong>{' '}
                <span className="text-muted-foreground">not labelled yet</span>
              </span>
            )}
            {qc.rejected > 0 && (
              <span>
                <strong className="tabular-nums text-destructive">{fmtQty(qc.rejected)}</strong>{' '}
                <span className="text-muted-foreground">
                  rejected{qc.rejectedLeft > 0 ? ` · ${fmtQty(qc.rejectedLeft)} still to go back` : ' · all returned'}
                </span>
              </span>
            )}
          </div>
        )}

        {error && !returning && !undo && (
          <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No batches on this receipt. Receipts recorded before QC was switched on have no batch records.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {ordered.map((lot) => {
              const status = lotStatusOf(lot.status);
              const inspection = lot.splitFromLotId
                ? null
                : lot.inspections.find((i) => i.status === 'COMPLETED') ?? null;
              const qcLotId = lot.splitFromLotId ?? lot.id;
              const packaging = lot.item.itemCategory === 'PACKAGING';
              return (
                <li key={lot.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 ${lot.splitFromLotId ? 'bg-muted/30 pl-6' : ''}`}>
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {lot.splitFromLotId && <CornerDownRight className="size-3.5 text-muted-foreground" strokeWidth={1.5} />}
                      <span className="truncate">{lot.item.name}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <Link href={`/admin/batches/${lot.id}`} className="font-mono text-gold-ink hover:underline">
                        {lot.batchNo ?? 'No batch no.'}
                      </Link>
                      {packaging ? (
                        lot.artworkVersion && <span>Artwork {lot.artworkVersion}</span>
                      ) : (
                        <>
                          {lot.mfgDate && <span>Mfg {shortDate(lot.mfgDate)}</span>}
                          {lot.expiryDate && <span>Exp {shortDate(lot.expiryDate)}</span>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="w-24 text-right text-sm tabular-nums">
                    <strong>{fmtQty(lot.splitFromLotId || lot.status === 'REJECTED' ? lot.quantityReceived : lot.quantityRemaining)}</strong>{' '}
                    <span className="text-xs text-muted-foreground">{lot.item.unit}</span>
                  </div>

                  <div className="flex w-32 flex-wrap gap-1">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {needsLabel(lot) && <Badge tone="amber">Not labelled</Badge>}
                    {lot.needsLabelling && lot.labelledAt && <Badge>Labelled</Badge>}
                  </div>

                  <div className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
                    {inspection && (
                      <div>
                        <Link href={`/admin/purchase-receives/${receiptId}/qc/${qcLotId}`} className="font-mono text-gold-ink hover:underline">
                          {inspection.inspectionNumber}
                        </Link>{' '}
                        · {fmtQty(inspection.quantityAccepted)} accepted
                        {Number(inspection.quantityRejected) > 0 && `, ${fmtQty(inspection.quantityRejected)} rejected`}
                      </div>
                    )}
                    {lot.status === 'REJECTED' && (
                      <div>
                        {Number(lot.quantityRemaining) > 0
                          ? `${fmtQty(lot.quantityRemaining)} still here`
                          : 'All returned'}
                      </div>
                    )}
                    {lot.creditLines.map((c) => (
                      <div key={c.credit.id}>
                        {fmtQty(c.quantity)} returned on{' '}
                        <Link href={`/admin/vendor-credits/${c.credit.id}`} className="font-mono text-gold-ink hover:underline">
                          {c.credit.creditNumber}
                        </Link>
                        {c.credit.status === 'VOID' && ' (void)'}
                        {c.credit.replacementRequested && ' · replacement asked'}
                      </div>
                    ))}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {lot.status === 'PENDING_QC' && canInspect && (
                      <Link href={`/admin/purchase-receives/${receiptId}/qc/${lot.id}`}>
                        <Button size="sm" variant="primary">
                          <ShieldCheck /> Inspect
                        </Button>
                      </Link>
                    )}
                    {lot.status === 'PENDING_QC' && !canInspect && <Badge tone="gray">QC permission needed</Badge>}
                    {needsLabel(lot) && canLabel && Number(lot.quantityRemaining) > 0 && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          setLabelTarget({ id: lot.id, batchNo: lot.batchNo, itemName: lot.item.name, remaining: Number(lot.quantityRemaining) })
                        }
                      >
                        <Tags /> Mark labelled
                      </Button>
                    )}
                    {inspection && canInspect && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setError('');
                          setUndoReason('');
                          setUndo({ inspectionId: inspection.id, number: inspection.inspectionNumber, label: lotLabel(lot) });
                        }}
                      >
                        Undo QC
                      </Button>
                    )}
                    {lot.status === 'REJECTED' && Number(lot.quantityRemaining) > 0 && canReturn && (
                      <Button size="sm" onClick={() => openReturn(lot)}>
                        Return
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {credits.length > 0 && (
          <div className="mt-4 text-sm">
            <div className="caps-label mb-1.5">Vendor credits from this receipt</div>
            <ul className="space-y-1">
              {credits.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/admin/vendor-credits/${c.id}`} className="font-mono text-gold-ink hover:underline">
                    {c.creditNumber}
                  </Link>
                  <span className="text-muted-foreground">{shortDate(c.creditDate)}</span>
                  <span className="tabular-nums">{money(c.grandTotal)}</span>
                  <Badge status={c.status}>{c.status}</Badge>
                  {c.replacementRequested && <Badge tone="gold">Replacement asked</Badge>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <MarkLabelledDialog target={labelTarget} onClose={() => setLabelTarget(null)} onDone={onChanged} />

      <Modal
        open={returning}
        onClose={() => !busy && setReturning(false)}
        title="Return rejected units"
        description={`A vendor credit is raised for ${vendorName ?? 'the vendor'} at the price paid, and the units leave stock.`}
        width="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturning(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitReturn} disabled={busy}>
              {busy && <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />}
              Raise vendor credit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-md border border-border">
            {returnable.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{l.batchNo ?? 'No batch no.'}</span> · {fmtQty(l.quantityRemaining)} rejected here · {money(l.unitCost)} each
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={Number(l.quantityRemaining)}
                  step="1"
                  value={picks[l.id] ?? ''}
                  onChange={(e) => setPicks((p) => ({ ...p, [l.id]: e.target.value }))}
                  className="w-24 text-right"
                  aria-label={`Units of ${lotLabel(l)} to return`}
                />
              </li>
            ))}
          </ul>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Credit date" required>
              <Input
                type="date"
                value={returnForm.creditDate}
                onChange={(e) => setReturnForm((f) => ({ ...f, creditDate: e.target.value }))}
              />
            </Field>
            <Field label="Reason" hint="Printed on the credit - defaults to Rejected at QC">
              <Input
                value={returnForm.reason}
                onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Rejected at QC"
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              rows={2}
              value={returnForm.notes}
              onChange={(e) => setReturnForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Collected by the factory driver"
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
            <Checkbox
              checked={returnForm.requestReplacement}
              onCheckedChange={(v) => setReturnForm((f) => ({ ...f, requestReplacement: v === true }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              Ask {vendorName ?? 'the vendor'} to send a replacement
              <span className="block text-xs text-muted-foreground">
                Adds the returned quantity back to the purchase order as still to come.
              </span>
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={!!undo}
        onClose={() => !busy && setUndo(null)}
        title={`Undo ${undo?.number ?? 'QC'}`}
        description={undo ? `The result for ${undo.label} is cancelled and the batch waits for QC again.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUndo(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitUndo} disabled={busy || undoReason.trim().length < 3}>
              {busy && <Spinner />}
              Undo QC
            </Button>
          </>
        }
      >
        <Field label="Why?" required>
          <Textarea
            rows={3}
            value={undoReason}
            onChange={(e) => setUndoReason(e.target.value)}
            placeholder="e.g. Counted the wrong pallet"
          />
        </Field>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </Modal>
    </>
  );
}
