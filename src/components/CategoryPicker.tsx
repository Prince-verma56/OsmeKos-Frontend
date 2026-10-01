'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { categoryLabel, sortForPicker, type CategoryRef } from '@/lib/categories';
import { useToast } from '@/lib/toast';
import { SearchSelect } from '@/components/SearchSelect';
import { Button, Input, Spinner } from '@/components/ui';

type Category = CategoryRef & { position?: number };

export function CategoryPicker({
  value,
  categories,
  onChange,
  onCreated,
  canCreate = true,
}: {
  value: string;
  categories: Category[];
  onChange: (id: string) => void;
  onCreated?: (category: Category) => void;
  canCreate?: boolean;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  const options = [
    { value: '', label: 'Uncategorised' },
    ...sortForPicker(categories).map((c) => ({ value: c.id, label: categoryLabel(categories, c) })),
  ];

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await api.post<{ data: Category }>('/categories', {
        name: trimmed,
        ...(parentId && { parentId }),
      });
      onCreated?.(res.data);
      onChange(res.data.id);
      toast.success(`Category "${res.data.name}" added`);
      setName('');
      setParentId('');
      setAdding(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <SearchSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Uncategorised"
        searchPlaceholder="Search categories…"
        emptyMessage="No category matches"
        className="w-full"
        action={canCreate ? { label: '+ New category', onClick: () => setAdding(true) } : undefined}
      />
      {adding && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              aria-label="New category name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  create();
                }
                if (e.key === 'Escape') setAdding(false);
              }}
            />
            <SearchSelect
              value={parentId}
              onChange={setParentId}
              options={[{ value: '', label: 'Top level' }, ...sortForPicker(categories).map((c) => ({ value: c.id, label: categoryLabel(categories, c) }))]}
              placeholder="Top level"
              searchPlaceholder="Parent category…"
              emptyMessage="No category matches"
              ariaLabel="Parent category"
            />
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="primary" onClick={create} disabled={busy || !name.trim()}>
                {busy && <Spinner />}
                Add
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
