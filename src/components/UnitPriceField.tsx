'use client';

import { useMemo, useRef, useState } from 'react';
import { money } from '@/lib/api';
import { cn } from '@/lib/cn';
import { notifyEdited } from '@/lib/unsaved';
import { Button, Input, Select } from './ui';
import { Chevron } from './SearchSelect';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './ui/popover';

const UNITS: { value: string; label: string; family: string; factor: number }[] = [
  { value: 'ml', label: 'ml', family: 'volume', factor: 1 },
  { value: 'l', label: 'l', family: 'volume', factor: 1000 },
  { value: 'g', label: 'g', family: 'weight', factor: 1 },
  { value: 'kg', label: 'kg', family: 'weight', factor: 1000 },
  { value: 'pcs', label: 'pcs', family: 'count', factor: 1 },
  { value: 'cm', label: 'cm', family: 'length', factor: 1 },
  { value: 'm', label: 'm', family: 'length', factor: 100 },
];

const unitOf = (u: string) => UNITS.find((x) => x.value === u);

export type UnitPriceValues = {
  unitPriceTotal: string;
  unitPriceTotalUnit: string;
  unitPriceBase: string;
  unitPriceBaseUnit: string;
};

const EMPTY: UnitPriceValues = {
  unitPriceTotal: '',
  unitPriceTotalUnit: '',
  unitPriceBase: '',
  unitPriceBaseUnit: '',
};

export function computeUnitPrice(price: string, v: UnitPriceValues) {
  const p = Number(price);
  const total = Number(v.unitPriceTotal);
  const base = Number(v.unitPriceBase);
  const tu = unitOf(v.unitPriceTotalUnit);
  const bu = unitOf(v.unitPriceBaseUnit);

  if (!p || !total || !base || !tu || !bu) return null;
  if (tu.family !== bu.family) {
    return { error: `${tu.label} and ${bu.label} do not measure the same thing.` };
  }

  const ratio = (total * tu.factor) / (base * bu.factor);
  if (!ratio) return null;

  return { value: Math.round((p / ratio) * 100) / 100, unit: `${base} ${bu.label}` };
}

export function UnitPriceField({
  price,
  values,
  onChange,
}: {
  price: string;
  values: UnitPriceValues;
  onChange: (patch: Partial<UnitPriceValues>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UnitPriceValues>(values);
  const rootRef = useRef<HTMLDivElement>(null);
  const saved = useMemo(() => computeUnitPrice(price, values), [price, values]);
  const preview = useMemo(() => computeUnitPrice(price, draft), [price, draft]);

  const set = (patch: Partial<UnitPriceValues>) => setDraft((d) => ({ ...d, ...patch }));

  function commit() {
    notifyEdited(rootRef.current);
    onChange(draft);
    setOpen(false);
  }

  function clear() {
    notifyEdited(rootRef.current);
    setDraft(EMPTY);
    onChange(EMPTY);
    setOpen(false);
  }

  const label =
    saved && !('error' in saved) ? `${money(saved.value)} per ${saved.unit}` : '—';

  const row = (
    which: 'total' | 'base',
    heading: string,
    hint: string,
    placeholder: string
  ) => {
    const numKey = which === 'total' ? 'unitPriceTotal' : 'unitPriceBase';
    const unitKey = which === 'total' ? 'unitPriceTotalUnit' : 'unitPriceBaseUnit';
    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{heading}</span>
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.001"
            min="0"
            placeholder={placeholder}
            value={draft[numKey]}
            onChange={(e) => set({ [numKey]: e.target.value } as Partial<UnitPriceValues>)}
          />
          <Select
            className="w-20"
            value={draft[unitKey]}
            onChange={(e) => set({ [unitKey]: e.target.value } as Partial<UnitPriceValues>)}
          >
            <option value="">—</option>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  };

  return (
    <div ref={rootRef} className="sm:col-span-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">Unit price</span>
      <PopoverRoot
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(values);
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30',
              open && 'border-gold ring-2 ring-gold/30'
            )}
          >
            <span className={label === '—' ? 'text-muted-foreground' : 'text-foreground'}>{label}</span>
            <Chevron open={open} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={8} className="w-[300px] p-3">
          <div className="space-y-3">
            {row('total', 'Total amount', 'what is in the pack', '250')}
            {row('base', 'Base measure', 'what it is priced per', '100')}
          </div>

          <div
            className="mt-3 rounded-md bg-muted/60 px-2.5 py-2 text-xs"
            aria-live="polite"
          >
            {preview && 'error' in preview ? (
              <span className="text-destructive">{preview.error}</span>
            ) : preview ? (
              <span className="text-muted-foreground">
                Shows as{' '}
                <span className="font-semibold text-foreground">
                  {money(preview.value)} per {preview.unit}
                </span>
              </span>
            ) : !Number(price) ? (
              <span className="text-warning">
                Set a selling price first — the unit price divides it.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Fill both rows to see the price per unit.
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={clear}
              className="rounded px-1 text-xs text-muted-foreground hover:underline"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={commit}
                disabled={Boolean(preview && 'error' in preview)}
              >
                Done
              </Button>
            </div>
          </div>

        </PopoverContent>
      </PopoverRoot>
      <span className="mt-1 block text-[11px] text-muted-foreground">
        The shelf price per measure, worked out from the selling price.
      </span>
    </div>
  );
}
