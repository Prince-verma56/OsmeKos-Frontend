'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Select } from './ui';

type Rate = {
  id: string;
  name: string;
  rate: string;
  type: 'GST' | 'IGST' | 'CESS' | 'TDS' | 'TCS';
  isDefault: boolean;
  isActive: boolean;
};

export function TaxRateSelect({
  value,
  onChange,
  type,
}: {
  value: string;
  onChange: (rate: string) => void;
  type: 'GST' | 'IGST';
}) {
  const [rates, setRates] = useState<Rate[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Rate[] }>('/sales/tax-rates', { type });
      setRates(res.data ?? []);
    } catch {
    }
  }, [type]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const options = useMemo(() => {
    const list = rates.map((r) => ({
      value: String(Number(r.rate)),
      label: `${r.name} — ${Number(r.rate)}%${r.isDefault ? ' (default)' : ''}`,
    }));
    const known = new Set(list.map((o) => o.value));
    if (value && !known.has(String(Number(value)))) {
      list.unshift({ value: String(Number(value)), label: `${Number(value)}% — not in the list` });
    }
    return list;
  }, [rates, value]);

  return (
    <Select
      className="w-full"
      value={value ? String(Number(value)) : ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Not set</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
