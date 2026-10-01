'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { ConfirmModal } from './Modal';
import { Button, Spinner } from './ui';

export type BulkResult = {
  deleted: { id: string; message: string }[];
  refused: { id: string; message: string }[];
};

export function useRowSelection(idsOnPage: string[]) {
  const [selected, setSelected] = useState<string[]>([]);

  const onPage = selected.filter((id) => idsOnPage.includes(id));
  const allOnPage = idsOnPage.length > 0 && onPage.length === idsOnPage.length;
  const someOnPage = onPage.length > 0 && !allOnPage;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleAll = () =>
    setSelected((s) =>
      allOnPage ? s.filter((id) => !idsOnPage.includes(id)) : [...new Set([...s, ...idsOnPage])]
    );

  return {
    selected,
    count: selected.length,
    isSelected: (id: string) => selected.includes(id),
    toggle,
    toggleAll,
    allOnPage,
    someOnPage,
    clear: () => setSelected([]),
    pick: <T extends { id: string }>(rows: T[]) =>
      selected.length === 0 ? rows : rows.filter((r) => selected.includes(r.id)),
  };
}

export function SelectAllBox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      aria-label="Select all on this page"
      className="cursor-pointer"
    />
  );
}

export function SelectBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label="Select row"
      className="cursor-pointer"
    />
  );
}

export function BulkBar({
  count,
  noun,
  endpoint,
  ids,
  onDone,
  onClear,
  actions,
}: {
  count: number;
  noun: string;
  endpoint: string;
  ids: string[];
  onDone: () => void;
  onClear: () => void;
  actions?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState('');

  const label = `${count} ${noun}${count === 1 ? '' : 's'}`;

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ data: BulkResult }>(endpoint, { ids });
      setResult(res.data);
      setConfirming(false);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {count > 0 && (
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm">
        <span className="font-medium text-foreground">{label} selected</span>
        {actions}
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
          {busy && <Spinner />}
          Delete
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:underline"
        >
          Clear selection
        </button>
      </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {result.deleted.length} deleted
              {result.refused.length > 0 && `, ${result.refused.length} refused`}
            </span>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Dismiss
            </button>
          </div>
          {result.refused.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {result.refused.map((r) => (
                <li key={r.id}>· {r.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        title={`Delete ${label}`}
        confirmLabel="Delete"
        busy={busy}
        message={
          `${label} will be deleted. Each one is checked on its own — anything with ` +
          'activity against it is refused and left alone, and you will be told which.'
        }
      />
    </>
  );
}
