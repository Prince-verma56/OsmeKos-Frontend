'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Paged } from '@/lib/api';
import { SearchSelect } from './SearchSelect';

export type CustomerChoice = {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerType?: string | null;
  b2bAccount?: { companyName?: string | null } | null;
};

export const customerName = (c: CustomerChoice) =>
  c.displayName?.trim() ||
  [c.firstName, c.lastName].filter(Boolean).join(' ') ||
  c.phone ||
  c.email ||
  'Unnamed customer';

export function CustomerSelect<T extends CustomerChoice>({
  value,
  customers,
  onChange,
  placeholder = 'Select a customer',
  disabled = false,
  include,
}: {
  value: string;
  customers: T[];
  onChange: (customerId: string, customer: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  include?: (customer: T) => boolean;
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
    const byId = new Map(customers.map((c) => [c.id, c]));
    for (const c of found) if (!byId.has(c.id)) byId.set(c.id, c);
    return [...byId.values()].filter((c) => !include || include(c) || c.id === value);
  }, [customers, found, include, value]);

  const options = useMemo(
    () =>
      all.map((c) => {
        const name = customerName(c);
        const company = c.b2bAccount?.companyName?.trim();
        return {
          value: c.id,
          label: company && company !== name ? `${name} - ${company}` : name,
          tag: [c.phone, c.email].filter(Boolean).join(' · ') || null,
          hint: c.customerType === 'B2B' ? 'B2B' : undefined,
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
        const res = await api.get<Paged<T>>('/customers', { search: q, limit: 20 });
        setFound((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...res.data.filter((c) => !seen.has(c.id))];
        });
      } catch {
      }
    }, 250);
  }

  return (
    <SearchSelect
      value={value}
      options={options}
      onChange={(id) => onChange(id, all.find((c) => c.id === id) ?? null)}
      onSearch={search}
      placeholder={placeholder}
      searchPlaceholder="Search by name, phone or email"
      emptyMessage="No customer matches - keep typing to search all customers"
      clearable
      disabled={disabled}
    />
  );
}
