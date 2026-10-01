'use client';

import { useCallback, useMemo, useState } from 'react';

export function useRowSelection<T extends { id?: string | null }>(rows: T[]) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const ids = useMemo(
    () => rows.map((r, i) => String(r.id ?? `row-${i}`)),
    [rows]
  );

  const selectedIds = useMemo(
    () => ids.filter((id) => picked.has(id)),
    [ids, picked]
  );

  const isSelected = useCallback((id: string) => picked.has(id), [picked]);

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setPicked((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      return allOn ? new Set() : new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setPicked(new Set()), []);

  const allSelected = ids.length > 0 && selectedIds.length === ids.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const rowsToExport = useMemo(
    () =>
      selectedIds.length === 0
        ? rows
        : rows.filter((r, i) => picked.has(String(r.id ?? `row-${i}`))),
    [rows, selectedIds, picked]
  );

  return {
    selectedIds,
    count: selectedIds.length,
    isSelected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    rowsToExport,
    idOf: (r: T, i: number) => String(r.id ?? `row-${i}`),
  };
}

export function SelectAllBox({
  allSelected,
  someSelected,
  onToggle,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={allSelected}
      ref={(el) => {
        if (el) el.indeterminate = someSelected;
      }}
      onChange={onToggle}
      className="cursor-pointer"
      aria-label="Select all rows"
    />
  );
}

export function SelectBox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      className="cursor-pointer"
      aria-label="Select row"
    />
  );
}

export function SelectionBar({
  count,
  total,
  onClear,
  children,
}: {
  count: number;
  total: number;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/60 px-4 py-2 text-sm">
      <span className="font-medium text-foreground">
        {count} of {total} selected
      </span>
      <span className="text-xs text-muted-foreground">
        Export will contain only these
      </span>
      {children}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-xs text-gold-ink hover:underline"
      >
        Clear selection
      </button>
    </div>
  );
}
