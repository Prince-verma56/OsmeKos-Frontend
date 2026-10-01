'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Paged } from '@/lib/api';
import { SearchSelect } from './SearchSelect';

export type VendorChoice = {
  id: string;
  displayName: string;
  companyName?: string | null;
  gstin?: string | null;
  email?: string | null;
};

export function VendorSelect<T extends VendorChoice>({
  value,
  vendors,
  onChange,
  placeholder = 'Select a vendor',
  disabled = false,
}: {
  value: string;
  vendors: T[];
  onChange: (vendorId: string, vendor: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [found, setFound] = useState<T[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const all = useMemo(() => {
    const byId = new Map(vendors.map((v) => [v.id, v]));
    for (const v of found) if (!byId.has(v.id)) byId.set(v.id, v);
    return [...byId.values()];
  }, [vendors, found]);

  const options = useMemo(
    () =>
      all.map((v) => {
        const company = v.companyName?.trim();
        return {
          value: v.id,
          label: company && company !== v.displayName ? `${v.displayName} - ${company}` : v.displayName,
          tag: v.gstin || v.email || null,
        };
      }),
    [all]
  );

  function search(query: string) {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await api.get<Paged<T>>('/vendors', { search: q, limit: 20 });
        setFound((prev) => {
          const seen = new Set(prev.map((v) => v.id));
          return [...prev, ...res.data.filter((v) => !seen.has(v.id))];
        });
      } catch {
      }
    }, 250);
  }

  return (
    <SearchSelect
      value={value}
      options={options}
      onChange={(id) => onChange(id, all.find((v) => v.id === id) ?? null)}
      onSearch={search}
      placeholder={placeholder}
      searchPlaceholder="Search by name, GSTIN or email"
      emptyMessage="No vendor matches - keep typing to search all vendors"
      clearable
      disabled={disabled}
    />
  );
}
