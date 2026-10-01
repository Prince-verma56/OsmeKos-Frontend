'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Readiness, ReadinessCheck } from '@/lib/labels';

function CheckList({ checks, tone }: { checks: ReadinessCheck[]; tone: 'warning' | 'muted' }) {
  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li key={c.key} className="flex items-start gap-2 text-sm">
          {c.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.5} aria-label="Done" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" strokeWidth={1.5} aria-label="Not filled yet" />
          )}
          <span className="min-w-0">
            <span className={c.ok ? 'text-muted-foreground' : 'text-foreground'}>{c.label}</span>
            {!c.ok && c.detail && (
              <span className={cn('block text-xs', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')}>{c.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReadinessCard({ readiness, dirty }: { readiness: Readiness | null; dirty?: boolean }) {
  if (!readiness) return null;
  const required = readiness.checks.filter((c) => c.required);
  const optional = readiness.checks.filter((c) => !c.required);
  const done = required.filter((c) => c.ok).length;
  const labelDone = optional.filter((c) => c.ok).length;
  return (
    <div className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="font-display text-[15px] font-medium tracking-wide text-foreground">Ready to sell?</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset',
            readiness.ready ? 'bg-success/10 text-success ring-success/25' : 'bg-warning/10 text-warning ring-warning/25'
          )}
        >
          {done}/{required.length}
        </span>
      </div>
      <div className="px-4 pt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', readiness.ready ? 'bg-success' : 'bg-gold')}
            style={{ width: `${required.length ? (done / required.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {readiness.ready
            ? 'The basics are in place. You can mark it Ready to sell.'
            : 'Tick these off to mark it Ready to sell.'}
          {dirty && ' Save to refresh this list.'}
        </p>
      </div>
      <div className="px-4 py-3">
        <CheckList checks={required} tone="warning" />
      </div>
      {optional.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">For the shop · optional</h3>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {labelDone}/{optional.length}
            </span>
          </div>
          <CheckList checks={optional} tone="muted" />
          <p className="mt-2 text-xs text-muted-foreground">
            {labelDone === optional.length
              ? 'The shop has everything it needs to show this well.'
              : 'Not needed to sell. Fill these in and the product looks right on the shop.'}
          </p>
        </div>
      )}
    </div>
  );
}
