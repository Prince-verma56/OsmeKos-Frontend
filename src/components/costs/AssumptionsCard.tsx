'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api, money, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Button, Card, ErrorBox, Input, Spinner } from '@/components/ui';
import type { Assumptions, OpexRow } from './types';

const blank = (): OpexRow => ({ name: '', amount: 0, percentOfPrice: null });

export function AssumptionsCard({
  assumptions,
  canWrite,
  onSaved,
}: {
  assumptions: Assumptions;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<OpexRow[]>(assumptions.opex);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (i: number, patch: Partial<OpexRow>) =>
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put('/costs/assumptions', {
        opex: rows
          .filter((r) => r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            amount: Number(r.amount) || 0,
            percentOfPrice: r.percentOfPrice === null || r.percentOfPrice === undefined ? null : Number(r.percentOfPrice),
          })),
      });
      toast.success('Running costs saved');
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Card
        title="Running costs, company wide"
        action={
          canWrite ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRows(assumptions.opex.length ? assumptions.opex : [blank()]);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null
        }
      >
        {assumptions.opex.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing set yet, so margins below are gross of shipping, fees and advertising.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assumptions.opex.map((o) => (
              <span
                key={o.name}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground"
              >
                {o.name}{' '}
                <span className="text-muted-foreground">
                  {o.percentOfPrice != null ? `${o.percentOfPrice}% of price` : money(o.amount)}
                </span>
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          These apply to every product unless a product has its own, which you set from its row below.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Running costs, company wide">
      <div className="space-y-3">
        {error && <ErrorBox message={error} />}

        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 sm:flex-nowrap">
              <Input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="What it is, e.g. Shipping"
                aria-label={`Cost ${i + 1} name`}
                className="min-w-0 flex-1 basis-40"
              />
              <div className="relative w-28 shrink-0">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => update(i, { amount: Number(e.target.value) })}
                  placeholder="0.00"
                  aria-label={`Cost ${i + 1} flat amount`}
                  className="w-28 pl-6 text-right"
                />
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ₹
                </span>
              </div>
              <div className="relative w-24 shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={row.percentOfPrice ?? ''}
                  onChange={(e) =>
                    update(i, {
                      percentOfPrice: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="—"
                  aria-label={`Cost ${i + 1} percent of price`}
                  className="w-24 pr-7 text-right"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setRows((list) => list.filter((_, idx) => idx !== i))}
                aria-label="Remove cost"
              >
                <X strokeWidth={1.5} />
              </Button>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Use the rupee box for a fixed cost, the percent box for one that grows with the price, or both
          together, the way a gateway charges 2% and a few rupees.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setRows((list) => [...list, blank()])}>
            <Plus /> Add a cost
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save} disabled={saving}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
