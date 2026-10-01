'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SearchSelect, type SearchOption } from './SearchSelect';

type TaxRate = {
  id: string;
  name: string;
  rate: string;
  type: string;
  section: string | null;
};

export function TdsSelect({
  section,
  onChange,
  className = '',
  placeholder = 'Select a Tax',
}: {
  section: string;
  onChange: (next: { section: string; rate: string }) => void;
  className?: string;
  placeholder?: string;
}) {
  const [taxes, setTaxes] = useState<TaxRate[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: TaxRate[] }>('/sales/tax-rates', { type: 'TDS' })
      .then((r) => {
        if (!cancelled) setTaxes(r.data.filter((t) => t.type === 'TDS'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const options: SearchOption[] = taxes.map((t) => ({
    value: t.name,
    label: t.name,
    hint: `${Number(t.rate)}%${t.section ? ` · ${t.section}` : ''}`,
  }));

  if (section && !options.some((o) => o.value === section)) {
    options.unshift({ value: section, label: section, hint: 'No longer in the tax master' });
  }

  return (
    <SearchSelect
      value={section}
      options={options}
      onChange={(name) => {
        const tax = taxes.find((t) => t.name === name);
        onChange({ section: name, rate: tax ? String(Number(tax.rate)) : '' });
      }}
      placeholder={placeholder}
      searchPlaceholder="Search taxes"
      emptyMessage="No TDS taxes found"
      className={className}
      clearable
    />
  );
}
