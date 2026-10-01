'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { SearchSelect, type SearchOption } from './SearchSelect';
import { Modal, ConfirmModal } from './Modal';
import { Badge, Button, Field, Input, Select, Table, Td, Th, EmptyRow } from './ui';

export type WithholdingTax = {
  id: string;
  name: string;
  rate: string;
  type: 'TDS' | 'TCS';
  section: string | null;
  natureOfCollection: string | null;
  isActive: boolean;
};

export type WithholdingKind = '' | 'TDS' | 'TCS';

export function TaxWithholdingRow({
  kind,
  taxId,
  amount,
  onKindChange,
  onTaxChange,
  money,
}: {
  kind: WithholdingKind;
  taxId: string;
  amount: number;
  onKindChange: (k: WithholdingKind) => void;
  onTaxChange: (id: string) => void;
  money: (v: unknown) => string;
}) {
  const [taxes, setTaxes] = useState<WithholdingTax[]>([]);
  const [managing, setManaging] = useState<'TDS' | 'TCS' | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: WithholdingTax[] }>('/sales/tax-rates');
        if (cancelled) return;
        setTaxes(res.data.filter((t) => t.type === 'TDS' || t.type === 'TCS'));
      } catch {
        if (!cancelled) setTaxes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const options: SearchOption[] = taxes
    .filter((t) => t.type === kind)
    .map((t) => ({
      value: t.id,
      label: t.name,
      hint: `${Number(t.rate)}%${t.section ? ` · ${t.section}` : ''}`,
    }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3 pt-1.5">
          {(['TDS', 'TCS'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-muted-foreground">
              <input
                type="radio"
                name="withholding"
                checked={kind === t}
                onChange={() => {
                  onKindChange(t);
                  onTaxChange('');
                }}
              />
              {t}
            </label>
          ))}
          {kind && (
            <button
              type="button"
              onClick={() => {
                onKindChange('');
                onTaxChange('');
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <SearchSelect
            value={taxId}
            options={options}
            onChange={onTaxChange}
            disabled={!kind}
            placeholder="Select a Tax"
            searchPlaceholder="Search"
            emptyMessage="NO RESULTS FOUND"
            className="w-full sm:w-60"
            action={
              kind ? { label: `⚙ Manage ${kind}`, onClick: () => setManaging(kind) } : undefined
            }
          />
          <span className="w-24 text-right">
            {kind === 'TDS' ? '-' : kind === 'TCS' ? '+' : ''}
            {money(amount)}
          </span>
        </div>
      </div>

      <ManageWithholdingModal
        kind={managing}
        onClose={() => setManaging(null)}
        taxes={taxes}
        onChanged={reload}
      />
    </>
  );
}

export function ManageWithholdingModal({
  kind,
  onClose,
  taxes,
  onChanged,
}: {
  kind: 'TDS' | 'TCS' | null;
  onClose: () => void;
  taxes: WithholdingTax[];
  onChanged: () => void;
}) {
  const blank = { name: '', rate: '', section: '', natureOfCollection: '', isActive: true };
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = taxes.filter((t) => t.type === kind);

  function startNew() {
    setEditing(null);
    setForm(blank);
    setError('');
    setShowForm(true);
  }

  function startEdit(t: WithholdingTax) {
    setEditing(t.id);
    setForm({
      name: t.name,
      rate: String(Number(t.rate)),
      section: t.section ?? '',
      natureOfCollection: t.natureOfCollection ?? '',
      isActive: t.isActive,
    });
    setError('');
    setShowForm(true);
  }

  async function save() {
    setError('');
    if (!form.name.trim()) return setError('Enter a tax name');
    if (form.rate === '' || Number.isNaN(Number(form.rate))) return setError('Enter a rate');

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        rate: Number(form.rate),
        type: kind,
        section: kind === 'TDS' ? form.section.trim() || null : null,
        natureOfCollection: kind === 'TCS' ? form.natureOfCollection.trim() || null : null,
        isActive: form.isActive,
      };
      if (editing) await api.patch(`/sales/tax-rates/${editing}`, body);
      else await api.post('/sales/tax-rates', body);
      onChanged();
      setShowForm(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await api.del(`/sales/tax-rates/${id}`);
      onChanged();
      setConfirmId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={!!kind}
        onClose={onClose}
        title={`Manage ${kind ?? ''}`}
        width="max-w-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">{kind} taxes</h3>
          <Button size="sm" variant="success" onClick={startNew}>
            + New {kind} Tax
          </Button>
        </div>

        {error && !showForm && (
          <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Table>
          <thead>
            <tr>
              <Th>TAX NAME</Th>
              <Th className="text-right">RATE (%)</Th>
              <Th>{kind === 'TCS' ? 'NATURE OF COLLECTION' : 'SECTION'}</Th>
              <Th>STATUS</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5} message={`No ${kind} Taxes to show`} />
            )}
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-muted/60">
                <Td>{t.name}</Td>
                <Td className="text-right">{Number(t.rate)}</Td>
                <Td className="text-muted-foreground">
                  {kind === 'TCS'
                    ? (t.natureOfCollection ?? '—')
                    : t.section
                      ? `Section ${t.section}`
                      : '—'}
                </Td>
                <Td>
                  <Badge tone={t.isActive ? 'green' : 'gray'}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      title="Edit"
                      className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(t.id)}
                      title="Delete"
                      className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      🗑
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Edit ${kind} Tax` : `New ${kind} Tax`}
        footer={
          <>
            <Button type="button" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Field label="Tax Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={kind === 'TDS' ? 'Commission or Brokerage' : 'Sale of Goods'}
              autoFocus
            />
          </Field>
          <Field label="Rate (%)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
          </Field>
          {kind === 'TDS' ? (
            <Field label="Section" hint="The Income Tax Act section, e.g. 194C">
              <Input
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                placeholder="194H"
              />
            </Field>
          ) : (
            <Field label="Nature of Collection">
              <Input
                value={form.natureOfCollection}
                onChange={(e) => setForm({ ...form, natureOfCollection: e.target.value })}
                placeholder="Sale of Goods"
              />
            </Field>
          )}
          <Field label="Status">
            <Select
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
              className="w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove(confirmId)}
        title={`Delete ${kind} tax`}
        message="Documents already using this rate keep their own snapshot of the name and percentage, so they are unaffected."
        confirmLabel="Delete"
        busy={saving}
      />
    </>
  );
}
