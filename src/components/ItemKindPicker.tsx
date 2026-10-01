'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, Select } from './ui';
import { Modal } from './Modal';

export type ItemKind = {
  id: string;
  name: string;
  baseCategory: string;
  hint: string | null;
};

export const BASE_CATEGORIES = [
  { value: 'FINISHED_GOOD', label: 'Finished product', hint: 'What customers buy - bought from the factory' },
  { value: 'PACKAGING', label: 'Packaging', hint: 'Boxes, cartons and shipping material' },
  { value: 'RAW_MATERIAL', label: 'Raw material', hint: 'Bought in to make something else' },
  { value: 'CONSUMABLE', label: 'Consumable', hint: 'Used up in the business, not sold' },
];

export function ItemKindPicker({
  kindId,
  category,
  onPick,
}: {
  kindId: string;
  category: string;
  onPick: (kind: ItemKind) => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const [kinds, setKinds] = useState<ItemKind[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', baseCategory: 'FINISHED_GOOD', hint: '' });

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: ItemKind[] }>('/item-kinds');
      setKinds(res.data);
    } catch {
      setKinds([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const selected =
    kinds.find((k) => k.id === kindId) ?? (kindId ? undefined : kinds.find((k) => k.baseCategory === category));

  async function add() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post<{ data: ItemKind }>('/item-kinds', {
        name: draft.name.trim(),
        baseCategory: draft.baseCategory,
        hint: draft.hint.trim() || undefined,
      });
      await load();
      onPick(res.data);
      setAdding(false);
      setDraft({ name: '', baseCategory: 'FINISHED_GOOD', hint: '' });
      toast.success(`${res.data.name} added`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      on
        ? 'border-gold bg-gold-soft font-medium text-foreground'
        : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
    }`;

  return (
    <div data-field="" className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        What kind of item is this?
      </span>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button key={k.id} type="button" onClick={() => onPick(k)} aria-pressed={selected?.id === k.id} className={chip(selected?.id === k.id)}>
            {k.name}
          </button>
        ))}
        {can('items:write') && (
          <button type="button" onClick={() => setAdding(true)} className={chip(false)}>
            + Add
          </button>
        )}
      </div>
      {selected?.hint && (
        <span className="mt-1 block text-xs text-muted-foreground/80">{selected.hint}</span>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a kind of item"
        description="It joins the list here and on every other item screen."
        footer={
          <>
            <Button type="button" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="button" variant="primary" disabled={saving || !draft.name.trim()} onClick={add}>
              {saving ? 'Adding…' : 'Add kind'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Tester, sample, gift wrap…"
            />
          </Field>
          <Field
            label="Treat it like"
            hint="This decides how the item behaves in stock, sales and purchases. It cannot be changed later."
          >
            <Select
              value={draft.baseCategory}
              onChange={(e) => setDraft({ ...draft, baseCategory: e.target.value })}
            >
              {BASE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} — {c.hint}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" hint="Shown under the buttons when this kind is picked.">
            <Input
              value={draft.hint}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
              placeholder="Optional"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
