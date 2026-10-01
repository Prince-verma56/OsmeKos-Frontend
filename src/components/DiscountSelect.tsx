'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, money, type Paged } from '@/lib/api';
import { SearchSelect } from './SearchSelect';
import { Button, Input } from './ui';

type Discount = {
  id: string;
  code: string | null;
  title: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
  value: string;
  isAutomatic: boolean;
  isActive: boolean;
  isExpired: boolean;
  isScheduled: boolean;
  isExhausted: boolean;
  minimumSubtotal: string | null;
};

function offer(d: Discount) {
  const n = Number(d.value);
  if (d.type === 'PERCENTAGE') return `${n}% off`;
  if (d.type === 'FIXED_AMOUNT') return `${money(n)} off`;
  if (d.type === 'FREE_SHIPPING') return 'Free shipping';
  return `Buy ${n} get 1`;
}

export function DiscountSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [codes, setCodes] = useState<Discount[]>([]);
  const [typing, setTyping] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paged<Discount>>('/sales/discounts', {
        limit: 100,
        isActive: 'true',
      });
      setCodes(res.data);
    } catch {
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const options = useMemo(() => {
    const usable = codes.filter(
      (d) => d.code && !d.isAutomatic && !d.isExpired && !d.isExhausted
    );
    const known = usable.map((d) => ({
      value: d.code as string,
      label: d.code as string,
      hint: offer(d),
      group: d.isScheduled ? 'Not started yet' : 'Running now',
    }));
    if (value && !known.some((o) => o.value === value)) {
      known.unshift({ value, label: value, hint: 'on this order', group: 'On this order' });
    }
    return known;
  }, [codes, value]);

  if (typing && !disabled) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="DIWALI10"
          className="font-mono"
          autoFocus
        />
        <Button type="button" size="sm" onClick={() => setTyping(false)}>
          Pick
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <SearchSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={options.length ? 'No code' : 'No codes running'}
        searchPlaceholder="Search codes…"
        emptyMessage="No codes available"
        clearable
        disabled={disabled}
        action={disabled ? undefined : { label: '✎ Type a code by hand', onClick: () => setTyping(true) }}
      />
      <div className="flex items-center gap-3 text-[11px]">
        <Link
          href="/admin/discounts"
          className="text-gold-ink hover:underline"
        >
          ⚙ Manage discounts
        </Link>
        <span className="text-muted-foreground">
          Automatic discounts apply on their own
        </span>
      </div>
    </div>
  );
}
