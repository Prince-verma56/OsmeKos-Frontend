'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Button, Card, Field, Input, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';

type Preview = { orders: number; invoices: number; bills: number; payments: number; purchaseOrders: number; lots: number; phrase: string };

export function ClearDataCard() {
  const { admin } = useAuth();
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = (admin?.role?.permissions ?? []).includes('*');

  useEffect(() => {
    if (!isOwner) return;
    api
      .get<{ data: Preview }>('/organization/clear-data')
      .then((r) => setPreview(r.data))
      .catch(() => setPreview(null));
  }, [isOwner, open]);

  if (!isOwner) return null;

  async function clear() {
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>('/organization/clear-data', { password, phrase: phrase.trim() });
      toast.success(res.message);
      setOpen(false);
      setPassword('');
      setPhrase('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const expected = preview?.phrase ?? 'CLEAR ALL DATA';
  const ready = phrase.trim() === expected && password.length > 0;

  return (
    <Card title="Clear data">
      <p className="text-sm text-muted-foreground">
        Wipes every order, invoice, payment, bill, purchase order, receipt, batch, stock movement and credit note, so you can start
        clean after testing. Logins, roles, settings, items, products, customers and vendors are kept. Stock goes back to zero.
        This cannot be undone.
      </p>
      {preview && (
        <p className="mt-2 text-xs text-muted-foreground">
          Right now: {preview.orders} orders · {preview.invoices} invoices · {preview.payments} payments received · {preview.purchaseOrders}{' '}
          purchase orders · {preview.bills} bills · {preview.lots} batches
        </p>
      )}
      <div className="mt-3">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Clear all data…
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title="Clear all transaction data?"
        description="Everything listed above is deleted for good. Only the owner can do this."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={clear} disabled={!ready || busy}>
              {busy && <Spinner />}
              Clear everything
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Your password" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label={`Type ${expected} to confirm`} required>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={expected} className="font-mono" autoComplete="off" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
