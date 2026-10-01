'use client';

import { Input } from '@/components/ui';

export function RoundOffRow({
  value,
  onChange,
  auto,
  applied,
  money,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  auto: number;
  applied: number;
  money: (n: number) => string;
  disabled?: boolean;
}) {
  const manual = value.trim() !== '';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <dt className="text-muted-foreground">
        Round off
        <span className="ml-1.5 text-[11px] text-muted-foreground">
          {manual ? 'set by hand' : 'auto'}
        </span>
        {manual && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="ml-1.5 text-[11px] text-gold-ink hover:underline"
          >
            Use auto
          </button>
        )}
      </dt>
      <dd className="flex flex-wrap items-center justify-end gap-2">
        <Input
          type="number" step="0.01" min="-1" max="1"
          value={value}
          placeholder={auto.toFixed(2)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label="Round off"
          className="w-28 text-right"
        />
        <span className="w-24 text-right">{money(applied)}</span>
      </dd>
    </div>
  );
}
