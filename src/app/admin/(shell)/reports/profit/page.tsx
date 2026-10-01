'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { TrendChart, RankChart } from '@/components/ReportChart';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import {
  EmptyRow, ErrorBox, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { DateRange } from '@/components/DateRange';

type GroupBy = 'item' | 'customer' | 'month';

type Row = {
  id: string | null;
  name: string;
  sku?: string | null;
  unit?: string | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number;
  returnedRevenue: number;
  quantity: number;
  unitProfit: number;
  invoiceCount: number;
  missingCost: boolean;
};

type Meta = {
  period: { from: string; to: string };
  groupBy: GroupBy;
  costBasis: string;
  totals: {
    revenue: number; cost: number; grossProfit: number; marginPercent: number;
    returned: number; quantity: number; rowCount: number;
    invoiceCount: number; creditCount: number; withoutCost: number;
    bestName: string | null; bestProfit: number; lossMakers: number;
  };
};

const GROUPS: { key: GroupBy; label: string; note: string }[] = [
  { key: 'item', label: 'Item', note: 'What actually earns' },
  { key: 'customer', label: 'Customer', note: 'Who is worth keeping' },
  { key: 'month', label: 'Month', note: 'Whether margin is holding' },
];

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
};
const monthEnd = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(numberLocale(), {
    month: 'short',
    year: 'numeric',
  });
};

function marginTone(pct: number): string {
  if (pct < 0) return 'text-destructive';
  if (pct < 15) return 'text-warning';
  if (pct >= 40) return 'text-success';
  return 'text-foreground';
}

export default function ProfitReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [groupBy, setGroupBy] = useState<GroupBy>('item');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Row[]; meta: Meta }>('/reports/profit', {
        groupBy,
        from,
        to,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [groupBy, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const sel = useRowSelection(rows);

  const t = meta?.totals;
  const byItem = groupBy === 'item';
  const byMonth = groupBy === 'month';
  const label = (r: Row) => (byMonth ? monthLabel(r.name) : r.name);

  const peak = rows.reduce((n, r) => Math.max(n, Math.abs(r.grossProfit)), 0);

  function exportSpec() {
    const heading = GROUPS.find((g) => g.key === groupBy)!.label;
    const columns: Column<Row>[] = [
      { header: heading, value: (r) => label(r), width: 170 },
      ...(byItem
        ? [
            { header: 'SKU', value: (r: Row) => r.sku ?? '' },
            { header: 'Qty sold', value: (r: Row) => r.quantity, align: 'right' as const },
          ]
        : []),
      { header: 'Revenue', value: (r) => r.revenue, money: true },
      { header: 'Cost of goods', value: (r) => r.cost, money: true },
      { header: 'Gross profit', value: (r) => r.grossProfit, money: true },
      { header: 'Margin %', value: (r) => r.marginPercent, align: 'right' },
      ...(byItem
        ? [{ header: 'Profit per unit', value: (r: Row) => r.unitProfit, money: true }]
        : []),
    ];
    return {
      title: `Profit by ${heading}`,
      subtitle: `${shortDate(from)} to ${shortDate(to)}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total',
        ...(byItem ? ['', t?.quantity ?? 0] : []),
        t?.revenue ?? 0,
        t?.cost ?? 0,
        t?.grossProfit ?? 0,
        t?.marginPercent ?? 0,
        ...(byItem ? [''] : []),
      ],
      footnote:
        'Cost of goods is the item’s CURRENT cost price. No sale records what it cost on the ' +
        'day, so changing an item’s cost moves margin on sales already made. Revenue excludes ' +
        'GST and is net of credit notes.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>

      <PageHeader
        title="Profit & Margin"
        subtitle="What you actually made, after what the goods cost you"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Gross Profit"
            value={money(t.grossProfit)}
            sub={`${t.marginPercent}% margin`}
            tone={t.grossProfit < 0 ? 'red' : 'green'}
          />
          <StatCard
            label="Revenue"
            value={money(t.revenue)}
            sub="excluding GST, net of credits"
          />
          <StatCard
            label="Cost of Goods"
            value={money(t.cost)}
            sub="what the stock cost you"
          />
          <StatCard
            label="Best Performer"
            value={money(t.bestProfit)}
            sub={t.bestName ? String(t.bestName).slice(0, 34) : 'nothing sold yet'}
            tone="green"
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {byMonth ? 'Gross profit over time' : 'Where the profit comes from'}
            </h3>
            {byMonth ? (
              <TrendChart
                points={rows.map((r) => ({ label: monthLabel(r.name), value: r.grossProfit }))}
                label="Gross profit by month"
              />
            ) : (
              <RankChart
                points={rows.map((r) => ({ label: label(r), value: r.grossProfit }))}
                tone="emerald"
                valueLabel="Gross profit"
              />
            )}

          </div>

          <div className="rounded-lg border border-border bg-card p-4">

            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">

              Margin %

            </h3>

            <RankChart

              points={rows.map((r) => ({ label: label(r), value: r.marginPercent }))}

              format={(n) => `${n.toFixed(1)}%`}

              tone="blue"

              valueLabel="Margin"

            />

            <p className="mt-3 text-[11px] text-muted-foreground">

              A big earner on a thin margin is a different problem from a small one on a fat margin —

              which is why both are here.

            </p>

          </div>

        </div>

      )}


      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRange
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
            }}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Group by
            </span>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="w-40"
            >
              {GROUPS.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </Select>
          </label>
          <p className="ml-auto pb-1 text-right text-xs text-muted-foreground">
            {GROUPS.find((g) => g.key === groupBy)?.note}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />
        {loading ? (
          <Loading />
        ) : (
          <Table minWidth="980px">
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllBox
                    allSelected={sel.allSelected}
                    someSelected={sel.someSelected}
                    onToggle={sel.toggleAll}
                  />
                </Th>
                <Th>{GROUPS.find((g) => g.key === groupBy)?.label.toUpperCase()}</Th>
                {byItem && <Th className="text-right">QTY SOLD</Th>}
                <Th className="text-right">REVENUE</Th>
                <Th className="text-right">COST OF GOODS</Th>
                <Th className="text-right">GROSS PROFIT</Th>
                <Th className="text-right">MARGIN</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={byItem ? 8 : 7}
                  message={`Nothing sold between ${shortDate(from)} and ${shortDate(to)}`}
                />
              )}
              {rows.map((r, i) => (
                <tr key={r.id ?? `${r.name}-${i}`} className="hover:bg-muted/60">
                  <Td>
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, i))}
                      onToggle={() => sel.toggle(sel.idOf(r, i))}
                    />
                  </Td>
                  <Td>
                    <span className="font-medium">{label(r)}</span>
                    {r.sku && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                        {r.sku}
                      </span>
                    )}
                    {r.missingCost && (
                      <span className="block text-[11px] text-warning">
                        no cost price — margin overstated
                      </span>
                    )}
                  </Td>
                  {byItem && (
                    <Td className="text-right text-muted-foreground">
                      {Number(r.quantity).toLocaleString(numberLocale())}
                      {r.unit ? ` ${r.unit}` : ''}
                    </Td>
                  )}
                  <Td className="text-right">{money(r.revenue)}</Td>
                  <Td className="text-right text-muted-foreground">
                    {money(r.cost)}
                  </Td>
                  <Td
                    className={`text-right font-semibold ${
                      r.grossProfit < 0 ? 'text-destructive' : ''
                    }`}
                  >
                    {money(r.grossProfit)}
                    {byItem && r.quantity > 0 && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {money(r.unitProfit)} / unit
                      </span>
                    )}
                  </Td>
                  <Td className={`text-right font-semibold ${marginTone(r.marginPercent)}`}>
                    {r.marginPercent}%
                  </Td>
                  <Td>
                    <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          r.grossProfit < 0 ? 'bg-destructive/70' : 'bg-success/70'
                        }`}
                        style={{
                          width: peak > 0
                            ? `${Math.max(2, (Math.abs(r.grossProfit) / peak) * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
              {t && rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  {byItem && (
                    <Td className="text-right">
                      {Number(t.quantity).toLocaleString(numberLocale())}
                    </Td>
                  )}
                  <Td className="text-right">{money(t.revenue)}</Td>
                  <Td className="text-right">{money(t.cost)}</Td>
                  <Td
                    className={`text-right ${
                      t.grossProfit < 0 ? 'text-destructive' : ''
                    }`}
                  >
                    {money(t.grossProfit)}
                  </Td>
                  <Td className={`text-right ${marginTone(t.marginPercent)}`}>
                    {t.marginPercent}%
                  </Td>
                  <Td />
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>

      {t && t.lossMakers > 0 && (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t.lossMakers} row(s) sold at a loss — the goods cost more than they fetched.
        </p>
      )}

      {t && t.withoutCost > 0 && (
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t.withoutCost} row(s) include an item with no cost price, counted as costing nothing.
          Their margin is overstated until a cost is set on the item.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Cost of goods is the item&rsquo;s <strong>current</strong> cost price — no sale records what
        it cost on the day it shipped, so changing an item&rsquo;s cost moves the margin on sales
        already made. Revenue excludes GST and is net of credit notes.
      </p>
    </>
  );
}
