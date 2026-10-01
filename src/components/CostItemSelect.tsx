'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SearchSelect } from './SearchSelect';
import { itemLabel } from '@/lib/items';

export type CostItem = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  sizeValue?: string | number | null;
  sizeUnit?: string | null;
  costPrice?: string | number | null;
  otherCostTotal?: string | number | null;
  imageUrls?: string[] | null;
};

let cache: Promise<CostItem[]> | null = null;

function loadItems() {
  if (!cache) {
    cache = api
      .get<{ data: CostItem[] }>('/items', { limit: 100, status: 'ACTIVE', sortBy: 'name' })
      .then((res) => res.data)
      .catch(() => [] as CostItem[]);
  }
  return cache;
}

export const costOf = (item: CostItem) =>
  Number(item.costPrice ?? 0) + Number(item.otherCostTotal ?? 0);

export function CostItemSelect({
  value,
  onPick,
  exceptId,
  className = '',
  placeholder = 'Pick an item',
  emptyLabel = 'Type it in myself',
}: {
  value: string;
  onPick: (item: CostItem | null) => void;
  exceptId?: string;
  className?: string;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [items, setItems] = useState<CostItem[]>([]);

  const load = useCallback(async () => {
    setItems(await loadItems());
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const options = items
    .filter((i) => i.id !== exceptId)
    .map((i) => ({
      value: i.id,
      label: itemLabel(i),
      hint: i.sku ?? undefined,
      imageUrl: i.imageUrls?.[0],
    }));

  return (
    <SearchSelect
      value={value}
      options={[{ value: '', label: emptyLabel }, ...options]}
      placeholder={placeholder}
      onChange={(next) => onPick(items.find((i) => i.id === next) ?? null)}
      className={className}
    />
  );
}
