'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import {
  Button, EmptyRow, ErrorBox, Field, Input, Loading, Select,
  Table, Td, Textarea, Th,
} from '@/components/ui';
import { Icon } from '@/components/Icon';

export type MasterValues = Record<string, string | number | boolean | null>;

export type MasterField = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  wide?: boolean;
  when?: (v: MasterValues) => boolean;
};

export type MasterColumn<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function MasterCrud<T extends { id: string }>({
  endpoint,
  singular,
  columns,
  fields,
  blank,
  toForm,
  canWrite,
  listParams,
  searchOn,
  note,
  deletable = true,
  deleteHint,
  sort,
}: {
  endpoint: string;
  singular: string;
  columns: MasterColumn<T>[];
  fields: MasterField[];
  blank: MasterValues;
  toForm: (row: T) => MasterValues;
  canWrite: boolean;
  listParams?: Record<string, string | number | boolean | undefined>;
  searchOn?: (row: T) => string;
  note?: React.ReactNode;
  deletable?: boolean | ((row: T) => boolean);
  deleteHint?: string;
  sort?: (a: T, b: T) => number;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<MasterValues>(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [doomed, setDoomed] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const paramKey = JSON.stringify(listParams ?? {});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: T[] }>(endpoint, JSON.parse(paramKey));
      setRows(res.data ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [endpoint, paramKey]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const shown = useMemo(() => {
    let list = rows;
    if (search && searchOn) {
      const q = search.toLowerCase();
      list = list.filter((r) => searchOn(r).toLowerCase().includes(q));
    }
    return sort ? [...list].sort(sort) : list;
  }, [rows, search, searchOn, sort]);

  function startCreate() {
    setEditing(null);
    setValues(blank);
    setFormError('');
    setOpen(true);
  }

  function startEdit(row: T) {
    setEditing(row);
    setValues(toForm(row));
    setFormError('');
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError('');
    try {
      const body: MasterValues = {};
      for (const f of fields) {
        if (f.when && !f.when(values)) continue;
        body[f.name] = values[f.name];
      }

      if (editing) await api.patch(`${endpoint}/${editing.id}`, body);
      else await api.post(endpoint, body);

      toast.success(editing ? `${singular} updated` : `${singular} created`);
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!doomed) return;
    setDeleting(true);
    try {
      await api.del(`${endpoint}/${doomed.id}`);
      toast.success(`${singular} deleted`);
      setDoomed(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const set = (name: string, v: string | number | boolean | null) =>
    setValues((p) => ({ ...p, [name]: v }));

  if (loading) return <Loading label={`Loading ${singular.toLowerCase()}s…`} />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {note && <div className="text-xs text-muted-foreground">{note}</div>}
        </div>
        <div className="flex items-center gap-2">
          {searchOn && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-48"
            />
          )}
          {canWrite && (
            <Button variant="primary" onClick={startCreate}>
              New {singular.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={c.header} className={c.className}>
                {c.header}
              </Th>
            ))}
            <Th className="text-right">{canWrite ? 'Actions' : ''}</Th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <EmptyRow
              colSpan={columns.length + 1}
              message={search ? 'Nothing matches that search' : `No ${singular.toLowerCase()}s yet`}
            />
          )}
          {shown.map((row) => (
            <tr key={row.id} className="hover:bg-muted/60">
              {columns.map((c) => (
                <Td key={c.header} className={c.className}>
                  {c.cell(row)}
                </Td>
              ))}
              <Td className="text-right">
                {canWrite && (
                  <div className="flex justify-end gap-1.5 whitespace-nowrap">
                    <Button size="sm" onClick={() => startEdit(row)}>
                      Edit
                    </Button>
                    {(typeof deletable === 'function' ? deletable(row) : deletable) && (
                      <Button size="sm" variant="danger" onClick={() => setDoomed(row)}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {!canWrite && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="roles" className="h-3.5 w-3.5" />
          Your role can read this list but not change it.
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}
        footer={
          <>
            <Button type="button" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : `Create ${singular.toLowerCase()}`}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields
            .filter((f) => !f.when || f.when(values))
            .map((f) => (
              <div key={f.name} className={f.wide ? 'sm:col-span-2' : ''}>
                {f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.name])}
                      onChange={(e) => set(f.name, e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-foreground">{f.label}</span>
                  </label>
                ) : (
                  <Field label={f.label} required={f.required} hint={f.hint}>
                    {f.type === 'select' ? (
                      <Select
                        value={String(values[f.name] ?? '')}
                        onChange={(e) => set(f.name, e.target.value)}
                      >
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : f.type === 'textarea' ? (
                      <Textarea
                        value={String(values[f.name] ?? '')}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        type={f.type === 'number' ? 'number' : 'text'}
                        step={f.step}
                        value={String(values[f.name] ?? '')}
                        onChange={(e) =>
                          set(f.name, f.type === 'number' ? e.target.value : e.target.value)
                        }
                        placeholder={f.placeholder}
                      />
                    )}
                  </Field>
                )}
              </div>
            ))}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(doomed)}
        onClose={() => setDoomed(null)}
        onConfirm={remove}
        busy={deleting}
        title={`Delete this ${singular.toLowerCase()}?`}
        confirmLabel="Delete"
        message={
          <>
            This removes it from every picker in the admin.
            {deleteHint && (
              <span className="mt-2 block text-muted-foreground">{deleteHint}</span>
            )}
          </>
        }
      />
    </>
  );
}
