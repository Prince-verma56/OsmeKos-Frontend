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

type GroupBy = 'customer' | 'item' | 'month';

type Row = {
  id: string | null;
  name: string;
  sku?: string | null;
  unit?: string | null;
  sales: number;
  tax: number;
  returned: number;
  netSales: number;
  quantity: number;
  invoiceCount: number;
  creditCount: number;
};

type Meta = {
  period: { from: string; to: string };
  groupBy: GroupBy;
  totals: {
    grossSales: number;
    returned: number;
    netSales: number;
    tax: number;
    quantity: number;
    invoiceCount: number;
    creditCount: number;
    rowCount: number;
    averageInvoice: number;
  };
};

const GROUPS: { key: GroupBy; label: string; note: string }[] = [
  { key: 'customer', label: 'Customer', note: 'Who buys the most' },
  { key: 'item', label: 'Item', note: 'What actually sells' },
  { key: 'month', label: 'Month', note: 'Which way the trend runs' },
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

export default function SalesReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [groupBy, setGroupBy] = useState<GroupBy>('customer');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Row[]; meta: Meta }>('/reports/sales', {
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

  const peak = rows.reduce((n, r) => Math.max(n, r.netSales), 0);

  function exportSpec() {
    const heading = GROUPS.find((g) => g.key === groupBy)!.label;
    const columns: Column<Row>[] = [
      { header: heading, value: (r) => label(r), width: 170 },
      ...(byItem
        ? [
            { header: 'SKU', value: (r: Row) => r.sku ?? '' },
            { header: 'Quantity', value: (r: Row) => r.quantity, align: 'right' as const },
          ]
        : [{ header: 'Invoices', value: (r: Row) => r.invoiceCount, align: 'right' as const }]),
      { header: 'Sales', value: (r) => r.sales, money: true },
      { header: 'Returned', value: (r) => r.returned, money: true },
      { header: 'Net sales', value: (r) => r.netSales, money: true },
      { header: 'GST', value: (r) => r.tax, money: true },
    ];
    return {
      title: `Sales by ${heading}`,
      subtitle: `${shortDate(from)} to ${shortDate(to)}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total',
        byItem ? '' : (t?.invoiceCount ?? 0),
        ...(byItem ? [t?.quantity ?? 0] : []),
        t?.grossSales ?? 0,
        t?.returned ?? 0,
        t?.netSales ?? 0,
        t?.tax ?? 0,
      ],
      footnote:
        'Sales are the taxable value, excluding GST — tax collected is money held for the ' +
        'government, not income. Built from invoices net of credit notes, because an order can ' +
        'still be cancelled.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>

      <PageHeader
        title="Sales"
        subtitle="What sold, to whom, and how much of it stuck"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Net Sales"
            value={money(t.netSales)}
            sub="taxable value, after returns"
            tone="green"
          />
          <StatCard
            label="Returned"
            value={money(t.returned)}
            sub={`${t.creditCount} credit note(s)`}
            tone={t.returned > 0 ? 'amber' : 'slate'}
          />
          <StatCard
            label="GST Collected"
            value={money(t.tax)}
            sub="held for the government, not income"
          />
          <StatCard
            label="Average Invoice"
            value={money(t.averageInvoice)}
            sub={`across ${t.invoiceCount} invoice(s)`}
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {byMonth ? 'Net sales over time' : `Top ${GROUPS.find((g) => g.key === groupBy)?.label.toLowerCase()}s by net sales`}
          </h3>
          {byMonth ? (
            <TrendChart
              points={rows.map((r) => ({ label: monthLabel(r.name), value: r.netSales }))}
              label="Net sales by month"
            />
          ) : (
            <RankChart
              points={rows.map((r) => ({ label: label(r), value: r.netSales }))}
              tone="emerald"
              valueLabel="Net sales"
            />
          )}

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
              className="w-44"
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
          <Table minWidth="900px">
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
                {byItem ? (
                  <Th className="text-right">QTY</Th>
                ) : (
                  <Th className="text-right">INVOICES</Th>
                )}
                <Th className="text-right">SALES</Th>
                <Th className="text-right">RETURNED</Th>
                <Th className="text-right">NET SALES</Th>
                <Th className="text-right">GST</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={8}
                  message={`Nothing invoiced between ${shortDate(from)} and ${shortDate(to)}`}
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
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    {byItem
                      ? `${Number(r.quantity).toLocaleString(numberLocale())}${r.unit ? ` ${r.unit}` : ''}`
                      : r.invoiceCount}
                  </Td>
                  <Td className="text-right">{money(r.sales)}</Td>
                  <Td className="text-right">
                    {r.returned ? (
                      <span className="text-warning">−{money(r.returned)}</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </Td>
                  <Td className="text-right font-semibold">{money(r.netSales)}</Td>
                  <Td className="text-right text-muted-foreground">{money(r.tax)}</Td>
                  <Td>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-success/70"
                        style={{ width: peak > 0 ? `${Math.max(2, (r.netSales / peak) * 100)}%` : '0%' }}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
              {t && rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  <Td className="text-right">
                    {byItem ? Number(t.quantity).toLocaleString(numberLocale()) : t.invoiceCount}
                  </Td>
                  <Td className="text-right">{money(t.grossSales)}</Td>
                  <Td className="text-right">{t.returned ? `−${money(t.returned)}` : '—'}</Td>
                  <Td className="text-right">{money(t.netSales)}</Td>
                  <Td className="text-right">{money(t.tax)}</Td>
                  <Td />
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Built from invoices, net of credit notes — an order can still be cancelled, so counting one
        as revenue would overstate every figure here. Sales are the taxable value; the GST column is
        money held for the government, not income.
      </p>
    </>
  );
}
