'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Modal } from './Modal';
import { Button, EmptyRow, ErrorBox, Input, Table, Td, Th, Spinner } from './ui';
import { SearchSelect } from './SearchSelect';

export type Transporter = {
  id: string;
  name: string;
  transporterId: string | null;
  phone: string | null;
  isActive: boolean;
};

export function useTransporters() {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: Transporter[] }>('/transporters')
      .then((r) => {
        if (!cancelled) setTransporters(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { transporters, refresh };
}

export function TransporterSelect({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
}) {
  const { transporters, refresh } = useTransporters();
  const [managing, setManaging] = useState(false);

  const known = transporters.some((t) => t.name === value);
  const chosen = transporters.find((t) => t.name === value) ?? null;

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <SearchSelect
          value={value}
          onChange={onChange}
          className="w-full"
          placeholder="Select or add a transporter"
          searchPlaceholder="Search transporters…"
          emptyMessage="No transporters yet"
          clearable
          options={[
            ...transporters.map((t) => ({
              value: t.name,
              label: t.name,
              hint: t.transporterId ?? undefined,
            })),
            ...(value && !known ? [{ value, label: `${value} (not on the list)` }] : []),
          ]}
          action={{ label: '⚙ Manage transporters', onClick: () => setManaging(true) }}
        />
      </div>

      {chosen?.transporterId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Transporter ID <span className="font-mono">{chosen.transporterId}</span> — goes on the
          e-way bill
        </p>
      )}

      <ManageTransporters
        open={managing}
        onClose={() => setManaging(false)}
        onChanged={refresh}
        onSelect={(name) => {
          onChange(name);
          setManaging(false);
        }}
      />
    </>
  );
}

function ManageTransporters({
  open,
  onClose,
  onChanged,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onSelect: (name: string) => void;
}) {
  const [rows, setRows] = useState<Transporter[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', transporterId: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .get<{ data: Transporter[] }>('/transporters', { includeInactive: true })
      .then((r) => {
        if (!cancelled) setRows(r.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, reloadKey]);

  async function save() {
    setError('');
    if (!draft.name.trim()) return setError('Enter a name');
    const id = draft.transporterId.trim();
    if (id && id.length !== 15) {
      return setError('A transporter ID is exactly 15 characters — a GSTIN, or a TRANSIN');
    }

    setBusy(true);
    try {
      const res = await api.post<{ data: Transporter }>('/transporters', {
        name: draft.name.trim(),
        transporterId: id || undefined,
        phone: draft.phone.trim() || undefined,
      });
      setDraft({ name: '', transporterId: '', phone: '' });
      setAdding(false);
      setReloadKey((k) => k + 1);
      onChanged();
      onSelect(res.data.name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(t: Transporter) {
    setError('');
    try {
      await api.del(`/transporters/${t.id}`);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const q = search.toLowerCase();
  const shown = search
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) || (r.transporterId ?? '').toLowerCase().includes(q)
      )
    : rows;

  return (
    <Modal open={open} onClose={onClose} title="Manage Transporters" width="max-w-2xl">
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {adding ? (
        <div className="mb-4 rounded-md border border-border bg-muted/60 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </span>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="V-Trans (India) Ltd."
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Transporter ID
              </span>
              <Input
                value={draft.transporterId}
                onChange={(e) => setDraft((d) => ({ ...d, transporterId: e.target.value }))}
                maxLength={15}
                placeholder="15-char GSTIN or TRANSIN"
                className="font-mono"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Phone
              </span>
              <Input
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 16) }))}
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="success" onClick={save} disabled={busy}>
              {busy && <Spinner className="border-card/40 border-t-card" />}
              Save and Select
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraft({ name: '', transporterId: '', phone: '' });
                setError('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-3">
          <Input
            placeholder="Search transporter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="success" onClick={() => setAdding(true)} className="ml-auto">
            + New Transporter
          </Button>
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <Th>TRANSPORTER</Th>
            <Th>TRANSPORTER ID</Th>
            <Th>PHONE</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && <EmptyRow colSpan={4} message="No transporters on the list yet" />}
          {shown.map((t) => (
            <tr key={t.id} className="hover:bg-muted/60">
              <Td>
                <button
                  type="button"
                  onClick={() => onSelect(t.name)}
                  className="font-medium text-gold-ink hover:underline"
                >
                  {t.name}
                </button>
                {!t.isActive && (
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    inactive
                  </span>
                )}
              </Td>
              <Td className="font-mono text-xs text-muted-foreground">
                {t.transporterId ?? '—'}
              </Td>
              <Td className="text-xs text-muted-foreground">{t.phone ?? '—'}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  onClick={() => removeOne(t)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <p className="mt-3 text-xs text-muted-foreground">
        The transporter ID is the 15-character GSTIN, or the TRANSIN issued to a carrier who is not
        GST-registered. An e-way bill will not accept anything else. Orders keep their own copy of
        the name, so removing a transporter here never changes an order already raised.
      </p>
    </Modal>
  );
}
