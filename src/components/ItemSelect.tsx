'use client';

import { currencySymbol, numberLocale } from '@/lib/api';
import { useMemo } from 'react';
import { SearchSelect } from './SearchSelect';
import { itemLabel } from '@/lib/items';

export type SelectableItem = {
  id: string;
  name: string;
  sku?: string | null;
  imageUrls?: string[] | null;
  unit?: string | null;
  sizeValue?: string | number | null;
  sizeUnit?: string | null;
  mrp?: string | number | null;
  sellingPrice?: string | number | null;
  sellingTaxTreatment?: string | null;
};

const rupees = (v: string | number) =>
  `${currencySymbol()}${Number(v).toLocaleString(numberLocale(), { maximumFractionDigits: 2 })}`;

export function ItemSelect({
  value,
  items,
  onChange,
  placeholder = 'Type or click to select an item',
  className = '',
  disabled = false,
}: {
  value: string;
  items: SelectableItem[];
  onChange: (itemId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const options = useMemo(
    () =>
      items.map((it) => ({
        value: it.id,
        label: itemLabel(it),
        imageUrl: it.imageUrls?.[0] ?? null,
        tag: it.sku ?? null,
        hint:
          [
            it.mrp != null && it.mrp !== '' ? `MRP ${rupees(it.mrp)}` : null,
            it.sellingPrice != null && it.sellingPrice !== ''
              ? `Rate ${rupees(it.sellingPrice)}${it.sellingTaxTreatment === 'EXCLUSIVE' ? ' + tax' : ' incl. tax'}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || (it.unit ?? undefined),
      })),
    [items]
  );

  return (
    <SearchSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search by name or SKU…"
      emptyMessage="No items match"
      className={className}
      disabled={disabled}
      clearable
    />
  );
}
