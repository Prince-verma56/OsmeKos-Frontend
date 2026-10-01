'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { DateRange as DayRange } from 'react-day-picker';
import { numberLocale } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Calendar } from './ui/calendar';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const add = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const monthsBack = (d: Date, months: number) => new Date(d.getFullYear(), d.getMonth() - months, d.getDate() + 1);

function fyStart(on: Date) {
  const year = on.getMonth() >= 3 ? on.getFullYear() : on.getFullYear() - 1;
  return new Date(year, 3, 1);
}

export type Range = { from: string; to: string };

type Preset = { key: string; label: string; short: string; range: (today: Date) => Range };

export const PRESETS: Preset[] = [
  { key: 'today', label: 'Today', short: 'Today', range: (t) => ({ from: isoDay(t), to: isoDay(t) }) },
  { key: 'last-7', label: 'Last 7 days', short: '7 days', range: (t) => ({ from: isoDay(add(t, -6)), to: isoDay(t) }) },
  { key: 'last-30', label: 'Last 30 days', short: '30 days', range: (t) => ({ from: isoDay(add(t, -29)), to: isoDay(t) }) },
  { key: 'last-3m', label: 'Last 3 months', short: '3 months', range: (t) => ({ from: isoDay(monthsBack(t, 3)), to: isoDay(t) }) },
  { key: 'last-12m', label: 'Last 12 months', short: '12 months', range: (t) => ({ from: isoDay(monthsBack(t, 12)), to: isoDay(t) }) },
  {
    key: 'this-month',
    label: 'This month',
    short: 'This month',
    range: (t) => ({
      from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)),
      to: isoDay(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
    }),
  },
  {
    key: 'last-month',
    label: 'Last month',
    short: 'Last month',
    range: (t) => ({
      from: isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
      to: isoDay(new Date(t.getFullYear(), t.getMonth(), 0)),
    }),
  },
  {
    key: 'this-quarter',
    label: 'This quarter',
    short: 'Quarter',
    range: (t) => {
      const q = Math.floor(t.getMonth() / 3) * 3;
      return { from: isoDay(new Date(t.getFullYear(), q, 1)), to: isoDay(new Date(t.getFullYear(), q + 3, 0)) };
    },
  },
  {
    key: 'this-fy',
    label: 'This financial year',
    short: 'This FY',
    range: (t) => {
      const s = fyStart(t);
      return { from: isoDay(s), to: isoDay(new Date(s.getFullYear() + 1, 2, 31)) };
    },
  },
  {
    key: 'last-fy',
    label: 'Previous financial year',
    short: 'Last FY',
    range: (t) => {
      const s = fyStart(t);
      return { from: isoDay(new Date(s.getFullYear() - 1, 3, 1)), to: isoDay(new Date(s.getFullYear(), 2, 31)) };
    },
  },
];

export const QUICK_RANGES = ['last-7', 'last-30', 'last-3m', 'last-12m'];
export const ACCOUNTING_RANGES = ['this-month', 'last-month', 'this-quarter', 'this-fy'];

export const presetRange = (key: string): Range => {
  if (key === 'all') return { from: '', to: '' };
  return (PRESETS.find((p) => p.key === key) ?? PRESETS[2]).range(new Date());
};

export function presetKey(from: string, to: string) {
  if (!from && !to) return 'all';
  const today = new Date();
  return PRESETS.find((p) => {
    const r = p.range(today);
    return r.from === from && r.to === to;
  })?.key;
}

export function presetLabel(from: string, to: string) {
  const key = presetKey(from, to);
  if (key === 'all') return 'All time';
  return PRESETS.find((p) => p.key === key)?.label;
}

const shortDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(numberLocale(), { day: 'numeric', month: 'short' });
};

const ordered = (range: Range): Range =>
  range.from && range.to && range.from > range.to ? { from: range.to, to: range.from } : range;

const toDate = (key: string) => {
  if (!key) return undefined;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const fullDay = (key: string) =>
  key ? toDate(key)!.toLocaleDateString(numberLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function CustomRange({ from, to, active, onApply }: { from: string; to: string; active: boolean; onApply: (range: Range) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>(undefined);

  function change(next: boolean) {
    if (next) {
      const fallback = presetRange('last-30');
      setDraft({ from: toDate(from || fallback.from), to: toDate(to || fallback.to) });
    }
    setOpen(next);
  }

  const ready = Boolean(draft?.from && draft?.to);

  return (
    <PopoverRoot open={open} onOpenChange={change}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active
              ? 'border-gold/60 bg-gold-soft text-gold-ink'
              : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
          )}
        >
          <CalendarDays className="size-3.5" strokeWidth={1.5} />
          {active && from && to ? `${shortDay(from)} – ${shortDay(to)}` : 'Custom'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-auto p-3">
        <Calendar
          mode="range"
          numberOfMonths={1}
          defaultMonth={draft?.from}
          selected={draft}
          onSelect={setDraft}
          weekStartsOn={1}
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="text-xs tabular-nums text-muted-foreground">
            {fullDay(draft?.from ? isoDay(draft.from) : '')} → {fullDay(draft?.to ? isoDay(draft.to) : '')}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!ready}
              onClick={() => {
                if (!draft?.from || !draft?.to) return;
                onApply(ordered({ from: isoDay(draft.from), to: isoDay(draft.to) }));
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

export function DateRange({
  from,
  to,
  onChange,
  label = 'Period',
  allowAll = false,
  hideLabel = false,
  presets = QUICK_RANGES,
}: {
  from: string;
  to: string;
  onChange: (range: Range) => void;
  label?: string;
  allowAll?: boolean;
  hideLabel?: boolean;
  presets?: string[];
}) {
  const active = presetKey(from, to);
  const shown = presets.map((key) => PRESETS.find((p) => p.key === key)).filter((p): p is Preset => !!p);
  const custom = active === undefined || (active !== 'all' && !presets.includes(active));

  return (
    <div className="block">
      {!hideLabel && <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={label}
          className="inline-flex h-9 max-w-full items-stretch overflow-x-auto rounded-md border border-border bg-card p-0.5 shadow-xs"
        >
          {shown.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.range(new Date()))}
              aria-pressed={active === p.key}
              title={p.label}
              className={`whitespace-nowrap rounded px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active === p.key
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {p.short}
            </button>
          ))}
          {allowAll && (
            <button
              type="button"
              onClick={() => onChange({ from: '', to: '' })}
              aria-pressed={active === 'all'}
              className={`whitespace-nowrap rounded px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              All
            </button>
          )}
        </div>
        <CustomRange from={from} to={to} active={custom} onApply={onChange} />
      </div>
    </div>
  );
}
