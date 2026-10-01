'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, money, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Modal } from '@/components/Modal';
import { Button, ErrorBox, Input, Spinner, Table, Td, Th } from '@/components/ui';
import type { Assumptions, MarginRow, OpexRow } from './types';

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');

export function MarginBreakdown({
  row,
  assumptions,
  canWrite,
  onClose,
  onSaved,
}: {
  row: MarginRow;
  assumptions: Assumptions;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<OpexRow[]>(
    row.opexOverridden ? row.opexRows.map(({ name, amount, percentOfPrice }) => ({ name, amount, percentOfPrice })) : assumptions.opex
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (i: number, patch: Partial<OpexRow>) =>
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save(useCompany: boolean) {
    if (!row.itemId) {
      setError('This size is not linked to a stock item, so its costs live with the company ones.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.put(`/costs/items/${row.itemId}/opex`, {
        opex: useCompany
          ? null
          : rows
              .filter((r) => r.name.trim())
              .map((r) => ({
                name: r.name.trim(),
                amount: Number(r.amount) || 0,
                percentOfPrice: r.percentOfPrice == null ? null : Number(r.percentOfPrice),
              })),
      });
      toast.success(useCompany ? 'Back on the company costs' : 'Own running costs saved');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const line = (label: string, amount: number, strong?: boolean, tone?: string) => (
    <tr key={label} className={strong ? 'font-medium' : undefined}>
      <Td className={tone}>{label}</Td>
      <Td className={`text-right tabular-nums ${tone ?? ''}`}>{money(amount)}</Td>
      <Td className="text-right tabular-nums text-muted-foreground">{pct(amount, row.sellingPrice)}</Td>
    </tr>
  );

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={`${row.product} — ${row.variant}`}
      description="Where every rupee of the price goes"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canWrite && row.itemId && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Give it its own running costs
            </Button>
          )}
          {canWrite && row.itemId && row.opexOverridden && !editing && (
            <Button variant="ghost" onClick={() => save(true)} disabled={saving}>
              Use the company costs
            </Button>
          )}
          {editing && (
            <Button variant="primary" onClick={() => save(false)} disabled={saving}>
              {saving && <Spinner className="border-card/40 border-t-card" />}
              Save
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        <Table>
          <thead>
            <tr>
              <Th>Line</Th>
              <Th className="text-right">Per unit</Th>
              <Th className="text-right">Of price</Th>
            </tr>
          </thead>
          <tbody>
            {line('Price the shopper pays', row.sellingPrice, true)}
            {line(`GST at ${row.gstRate}%`, -row.gstCollected)}
            {line('What we keep', row.netRevenue, true)}

            {row.cogsRows.length === 0 && (
              <tr>
                <Td colSpan={3} className="text-xs text-muted-foreground">
                  No cost recorded on the stock item, so the margin below is optimistic.
                </Td>
              </tr>
            )}
            {row.cogsRows.map((c) => line(c.name, -c.amount))}
            {line('Gross profit', row.grossProfit, true, row.grossProfit < 0 ? 'text-destructive' : undefined)}

            {row.opexRows.map((o) =>
              line(o.percentOfPrice ? `${o.name} (${o.percentOfPrice}%${o.amount ? ` + ${money(o.amount)}` : ''})` : o.name, -o.value)
            )}
            {line(
              'Profit per unit',
              row.netProfit,
              true,
              row.netProfit < 0 ? 'text-destructive' : 'text-success'
            )}
          </tbody>
        </Table>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <div className="caps-label text-[10px] text-muted-foreground">Gross margin</div>
            <div className="text-lg font-medium">{row.grossMargin == null ? '—' : `${row.grossMargin}%`}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="caps-label text-[10px] text-muted-foreground">Net margin</div>
            <div className="text-lg font-medium">{row.netMargin == null ? '—' : `${row.netMargin}%`}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="caps-label text-[10px] text-muted-foreground">Break even at</div>
            <div className="text-lg font-medium">
              {row.breakEvenPrice == null ? '—' : money(row.breakEvenPrice)}
            </div>
          </div>
        </div>

        {editing && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">
              Running costs for {row.itemName ?? 'this item'} only. Everything else keeps the company figures.
            </p>
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="What it is"
                  className="min-w-0 flex-1 basis-40"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) => update(i, { amount: Number(e.target.value) })}
                  placeholder="₹"
                  className="w-24 text-right"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={r.percentOfPrice ?? ''}
                  onChange={(e) => update(i, { percentOfPrice: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="%"
                  className="w-20 text-right"
                />
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setRows((l) => [...l, { name: '', amount: 0, percentOfPrice: null }])}>
              Add a cost
            </Button>
          </div>
        )}

        {row.itemId && (
          <p className="text-xs text-muted-foreground">
            Cost comes from{' '}
            <Link href={`/admin/items/${row.itemId}`} className="text-gold-ink hover:underline">
              {row.itemName}
            </Link>
            . Change the vendor price there and this follows.
          </p>
        )}
      </div>
    </Modal>
  );
}
