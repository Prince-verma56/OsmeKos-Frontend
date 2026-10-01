'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { KeyActive } from '@/lib/labels';
import { Button, Input } from '../ui';

export function KeyActivesEditor({ value, onChange }: { value: KeyActive[]; onChange: (next: KeyActive[]) => void }) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };
  const update = (i: number, patch: Partial<KeyActive>) => onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No key actives yet. Add the ingredients printed on the front label, in the same order.
        </p>
      )}
      <ol className="space-y-1.5">
        {value.map((row, i) => (
          <li
            key={i}
            draggable
            onDragStart={(e) => {
              dragFrom.current = i;
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom.current !== null) move(dragFrom.current, i);
              dragFrom.current = null;
              setOver(null);
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setOver(null);
            }}
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-1.5 transition-colors sm:flex-nowrap',
              over === i && 'border-gold bg-gold-soft'
            )}
          >
            <span className="flex cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing" aria-hidden>
              <GripVertical className="size-4" strokeWidth={1.5} />
            </span>
            <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <Input
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Ingredient, e.g. Niacinamide"
              aria-label={`Key active ${i + 1} name`}
              className="min-w-0 flex-1 basis-40"
            />
            <Input
              value={row.short ?? ''}
              onChange={(e) => update(i, { short: e.target.value })}
              placeholder="What it does, e.g. Deeply hydrates"
              aria-label={`Key active ${i + 1} benefit`}
              maxLength={60}
              className="min-w-0 flex-1 basis-40"
            />
            <div className="relative ml-auto w-24 shrink-0">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={row.percent}
                onChange={(e) => update(i, { percent: e.target.value })}
                placeholder="—"
                aria-label={`Key active ${i + 1} percent`}
                className="w-24 pr-7 text-right"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon-sm" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => move(i, i + 1)} disabled={i === value.length - 1} aria-label="Move down">
                <ArrowDown strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label="Remove">
                <X strokeWidth={1.5} />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button size="sm" onClick={() => onChange([...value, { name: '', percent: '', short: '' }])} disabled={value.length >= 20}>
        <Plus /> Add key active
      </Button>
    </div>
  );
}
