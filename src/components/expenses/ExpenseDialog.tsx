'use client';

import { useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Modal } from '@/components/Modal';
import { Button, ErrorBox, Field, Input, Select, Spinner, Textarea } from '@/components/ui';

export type Head = {
  id: string;
  name: string;
  isActive: boolean;
  children: { id: string; name: string; isActive: boolean }[];
};

export type ExpenseRow = {
  id: string;
  spentOn: string;
  amount: string;
  payee: string | null;
  description: string | null;
  notes: string | null;
  head: { id: string; name: string };
  subHead: { id: string; name: string } | null;
};

const dateValue = (iso: string) => iso.slice(0, 10);

export function ExpenseDialog({
  heads,
  expense,
  onClose,
  onSaved,
}: {
  heads: Head[];
  expense: ExpenseRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    spentOn: expense ? dateValue(expense.spentOn) : new Date().toISOString().slice(0, 10),
    amount: expense ? String(Number(expense.amount)) : '',
    headId: expense?.head.id ?? '',
    subHeadId: expense?.subHead?.id ?? '',
    payee: expense?.payee ?? '',
    description: expense?.description ?? '',
    notes: expense?.notes ?? '',
  });

  const subHeads = useMemo(
    () => heads.find((h) => h.id === form.headId)?.children ?? [],
    [heads, form.headId]
  );

  async function save() {
    if (!form.headId) {
      setError('Pick a head first');
      return;
    }
    if (!(Number(form.amount) > 0)) {
      setError('Put in what it cost');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        spentOn: form.spentOn,
        amount: Number(form.amount),
        headId: form.headId,
        subHeadId: form.subHeadId || null,
        payee: form.payee.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (expense) await api.patch(`/expenses/${expense.id}`, body);
      else await api.post('/expenses', body);

      toast.success(expense ? 'Expense updated' : 'Expense added');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? 'Edit expense' : 'New expense'}
      description="What was spent, what it was for, and who it went to"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving && <Spinner className="border-card/40 border-t-card" />}
            {expense ? 'Save' : 'Add expense'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <Input
              type="date"
              value={form.spentOn}
              onChange={(e) => setForm({ ...form, spentOn: e.target.value })}
              required
            />
          </Field>
          <Field label="Amount" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Head" required>
            <Select
              value={form.headId}
              onChange={(e) => setForm({ ...form, headId: e.target.value, subHeadId: '' })}
              className="w-full"
              required
            >
              <option value="">Pick a head</option>
              {heads.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sub-head" hint={form.headId ? undefined : 'Pick a head first'}>
            <Select
              value={form.subHeadId}
              onChange={(e) => setForm({ ...form, subHeadId: e.target.value })}
              className="w-full"
              disabled={!subHeads.length}
            >
              <option value="">None</option>
              {subHeads.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Vendor / Payee">
          <Input
            value={form.payee}
            onChange={(e) => setForm({ ...form, payee: e.target.value })}
            placeholder="Hostinger, Bo International, Setbiz India…"
          />
        </Field>

        <Field label="Description">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Domain renewal, Company registration…"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anything worth remembering about this spend"
          />
        </Field>
      </div>
    </Modal>
  );
}
