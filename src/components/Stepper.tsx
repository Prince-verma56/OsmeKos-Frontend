'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Stepper({
  label,
  value,
  onChange,
  max,
  min = 0,
  tone,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
  min?: number;
  tone?: 'success' | 'destructive';
  hint?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : min));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div
        className={cn(
          'flex h-14 items-stretch overflow-hidden rounded-lg border bg-card',
          tone === 'success' ? 'border-success/40' : tone === 'destructive' ? 'border-destructive/40' : 'border-input'
        )}
      >
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex w-14 shrink-0 items-center justify-center border-r border-border text-foreground hover:bg-muted disabled:opacity-40"
          aria-label={`One less ${label.toLowerCase()}`}
        >
          <Minus className="size-5" strokeWidth={1.5} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 bg-transparent text-center text-2xl font-medium tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex w-14 shrink-0 items-center justify-center border-l border-border text-foreground hover:bg-muted disabled:opacity-40"
          aria-label={`One more ${label.toLowerCase()}`}
        >
          <Plus className="size-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
