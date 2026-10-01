'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Button, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { Stepper } from '@/components/Stepper';

export type LabelTarget = { id: string; batchNo: string | null; itemName: string; remaining: number };

export function MarkLabelledDialog({ target, onClose, onDone }: { target: LabelTarget | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(target?.remaining ?? 0);
  const [targetId, setTargetId] = useState(target?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (target && target.id !== targetId) {
    setTargetId(target.id);
    setQuantity(target.remaining);
    setError('');
  }

  async function save() {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ message: string }>(`/batches/${target.id}/mark-labelled`, { quantity });
      toast.success(res.message);
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={() => !busy && onClose()}
      title="Mark as labelled"
      description={
        target
          ? `${target.itemName}${target.batchNo ? `, batch ${target.batchNo}` : ''}. Labelled units become available to sell straight away.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || quantity < 1}>
            {busy && <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />}
            Mark {quantity} labelled
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-3">
          <Stepper
            label="Units labelled"
            value={quantity}
            min={1}
            max={target.remaining}
            tone="success"
            onChange={setQuantity}
            hint={`${target.remaining} not labelled yet`}
          />
          {quantity < target.remaining && (
            <p className="text-sm text-muted-foreground">
              The other {target.remaining - quantity} stay unlabelled and can be marked later.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
