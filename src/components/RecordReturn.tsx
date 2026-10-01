'use client';

import { useState } from 'react';
import { api, errorMessage, money } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Button, ErrorBox, Field, Input, Select, Spinner, Textarea } from '@/components/ui';

export type ReturnableOrder = {
  id: string;
  orderNumber: string;
  amountPaid: string;
  amountRefunded: string;
  lines: {
    id: string;
    name: string;
    variantTitle: string | null;
    quantityFulfilled: number;
    quantityReturned: number;
    packSize?: number;
  }[];
  returns: { status: string; lines?: { orderLineId: string; quantity: number }[] }[];
};

const RTO = 'Returned to us (RTO)';
const REASONS = [RTO, 'Customer sent it back', 'Damaged in transit', 'Wrong item sent', 'Other'];
const OPEN = ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'RECEIVED', 'INSPECTED'];

export function returnableLines(order: ReturnableOrder) {
  const pending = new Map<string, number>();
  for (const r of order.returns) {
    if (!OPEN.includes(r.status)) continue;
    for (const l of r.lines ?? []) pending.set(l.orderLineId, (pending.get(l.orderLineId) ?? 0) + l.quantity);
  }
  return order.lines
    .map((l) => ({ ...l, returnable: l.quantityFulfilled - l.quantityReturned - (pending.get(l.id) ?? 0) }))
    .filter((l) => l.returnable > 0);
}

export function RecordReturn({
  order,
  open,
  onClose,
  onDone,
}: {
  order: ReturnableOrder;
  open: boolean;
  onClose: () => void;
  onDone: (result: { id: string; message: string; completed: boolean }) => void;
}) {
  const lines = returnableLines(order);
  const refundable = Math.max(0, Number(order.amountPaid) - Number(order.amountRefunded));

  const [reason, setReason] = useState(RTO);
  const [back, setBack] = useState(true);
  const [picked, setPicked] = useState<Record<string, { quantity: string; restock: boolean }>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { quantity: String(l.returnable), restock: true }]))
  );
  const [refund, setRefund] = useState('');
  const [gateway, setGateway] = useState('MANUAL');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (id: string, patch: Partial<{ quantity: string; restock: boolean }>) =>
    setPicked((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  async function submit() {
    setError('');
    const chosen = lines
      .map((l) => ({ line: l, q: Math.floor(Number(picked[l.id]?.quantity || 0)) }))
      .filter(({ q }) => q > 0);
    if (!chosen.length) return setError('Pick at least one item and how many came back');
    const over = chosen.find(({ line, q }) => q > line.returnable);
    if (over) return setError(`Only ${over.line.returnable} of "${over.line.name}" can be returned`);
    const refundAmount = back && refund.trim() ? Number(refund) : 0;
    if (refundAmount > refundable) return setError(`Only ${money(refundable)} was paid and can be refunded`);

    setSaving(true);
    try {
      const res = await api.post<{ message: string; data: { id: string; status: string } }>('/returns', {
        orderId: order.id,
        reason,
        notes: notes.trim() || undefined,
        rto: reason === RTO,
        receivedNow: back,
        ...(refundAmount > 0 && { refundAmount, refundGateway: gateway }),
        lines: chosen.map(({ line, q }) => ({
          orderLineId: line.id,
          quantity: q,
          restock: picked[line.id]?.restock ?? true,
        })),
      });
      onDone({ id: res.data.id, message: res.message, completed: res.data.status === 'COMPLETED' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record a return on ${order.orderNumber}`}
      width="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" disabled={saving || !lines.length} onClick={submit}>
            {saving && <Spinner className="border-card/40 border-t-card" />}
            {back ? 'Record and restock' : 'Create return'}
          </Button>
        </>
      }
    >
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing on this order can be returned - every shipped item is already returned or on an open
          return.
        </p>
      ) : (
        <div className="space-y-4">
          {error && <ErrorBox message={error} />}

          <Field label="Why is it coming back?">
            <Select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value === RTO) setBack(true);
              }}
              className="w-full"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Coming back</th>
                  <th className="pb-2 pl-4 text-left font-medium">Back in stock</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <div className="text-foreground">
                        {[l.name, l.variantTitle].filter(Boolean).join(' - ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.returnable} can come back
                        {(l.packSize ?? 1) > 1 ? ` · each is ${l.packSize} singles` : ''}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <Input
                        type="number" min="0" step="1" max={l.returnable}
                        value={picked[l.id]?.quantity ?? ''}
                        onChange={(e) => set(l.id, { quantity: e.target.value })}
                        className="w-20 text-right"
                        aria-label={`How many ${l.name} came back`}
                      />
                    </td>
                    <td className="py-2 pl-4">
                      <label className="flex items-center gap-2 text-foreground">
                        <input
                          type="checkbox"
                          checked={picked[l.id]?.restock ?? true}
                          onChange={(e) => set(l.id, { restock: e.target.checked })}
                        />
                        Sellable
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-muted-foreground">
              Untick Sellable for anything damaged - it is counted as returned but not put back into stock.
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2.5 text-sm">
            <input type="checkbox" checked={back} onChange={(e) => setBack(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="block font-medium text-foreground">
                The parcel is already back with us
              </span>
              <span className="block text-xs text-muted-foreground">
                {back
                  ? 'Sellable items go back into stock now and the return is closed.'
                  : 'The return waits as requested - approve, receive and inspect it on its page.'}
              </span>
            </span>
          </label>

          {back && refundable > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Refund to the customer" hint={`Up to ${money(refundable)} was paid. Leave blank for none.`}>
                <Input
                  type="number" min="0" step="0.01" max={refundable}
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Refunded by">
                <Select value={gateway} onChange={(e) => setGateway(e.target.value)} className="w-full">
                  <option value="MANUAL">Manual</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="RAZORPAY">Razorpay</option>
                  <option value="CARD">Card</option>
                </Select>
              </Field>
            </div>
          )}

          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Courier, AWB, condition…" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
