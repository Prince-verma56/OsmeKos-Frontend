'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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

type GroupBy = 'vendor' | 'item' | 'month';

type Row = {
  id: string | null;
  name: string;
  sku?: string | null;
  unit?: string | null;
  gstin?: string | null;
  spend: number;
  tax: number;
  returned: number;
  netSpend: number;
  quantity: number;
  outstanding: number;
  billCount: number;
  creditCount: number;
};

type Meta = {
  period: { from: string; to: string };
  groupBy: GroupBy;
  totals: {
    grossSpend: number; returned: number; netSpend: number; tax: number;
    quantity: number; outstanding: number; billCount: number; creditCount: number;
    rowCount: number; averageBill: number; reverseChargeTax: number;
  };
};

const GROUPS: { key: GroupBy; label: string; note: string }[] = [
  { key: 'vendor', label: 'Vendor', note: 'Where the money goes' },
  { key: 'item', label: 'Item', note: 'What you actually buy' },
  { key: 'month', label: 'Month', note: 'Which way the spend runs' },
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

export default function PurchasesReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [groupBy, setGroupBy] = useState<GroupBy>('vendor');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Row[]; meta: Meta }>('/reports/purchases', {
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
  const peak = rows.reduce((n, r) => Math.max(n, r.netSpend), 0);

  function exportSpec() {
    const heading = GROUPS.find((g) => g.key === groupBy)!.label;
    const columns: Column<Row>[] = [
      { header: heading, value: (r) => label(r), width: 170 },
      ...(byItem
        ? [
            { header: 'SKU', value: (r: Row) => r.sku ?? '' },
            { header: 'Quantity', value: (r: Row) => r.quantity, align: 'right' as const },
          ]
        : [
            { header: 'Bills', value: (r: Row) => r.billCount, align: 'right' as const },
            { header: 'Outstanding', value: (r: Row) => r.outstanding, money: true },
          ]),
      { header: 'Spend', value: (r) => r.spend, money: true },
      { header: 'Returned', value: (r) => r.returned, money: true },
      { header: 'Net spend', value: (r) => r.netSpend, money: true },
      { header: 'Input GST', value: (r) => r.tax, money: true },
    ];
    return {
      title: `Purchases by ${heading}`,
      subtitle: `${shortDate(from)} to ${shortDate(to)}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total',
        ...(byItem
          ? ['', t?.quantity ?? 0]
          : [t?.billCount ?? 0, t?.outstanding ?? 0]),
        t?.grossSpend ?? 0,
        t?.returned ?? 0,
        t?.netSpend ?? 0,
        t?.tax ?? 0,
      ],
      footnote:
        'Spend is the taxable value, excluding GST — input tax is reclaimable, so counting it as ' +
        'cost would overstate what the goods cost you. Built from bills net of vendor credits, ' +
        'because a purchase order is an intention while a bill is a debt.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>

      <PageHeader
        title="Purchases"
        subtitle="What you bought, from whom, and what is still owed on it"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Net Spend"
            value={money(t.netSpend)}
            sub="taxable value, after credits"
          />
          <StatCard
            label="Input GST"
            value={money(t.tax)}
            sub="reclaimable against what you charged"
            tone="green"
          />
          <StatCard
            label="Still Owed"
            value={money(t.outstanding)}
            sub={`across ${t.billCount} bill(s)`}
            tone={t.outstanding > 0 ? 'amber' : 'slate'}
          />
          <StatCard
            label="Average Bill"
            value={money(t.averageBill)}
            sub={t.creditCount > 0 ? `${t.creditCount} vendor credit(s)` : 'no credits this period'}
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {byMonth ? 'Spend over time' : `Top ${GROUPS.find((g) => g.key === groupBy)?.label.toLowerCase()}s by spend`}
          </h3>
          {byMonth ? (
            <TrendChart
              points={rows.map((r) => ({ label: monthLabel(r.name), value: r.netSpend }))}
              label="Net spend by month"
            />
          ) : (
            <RankChart
              points={rows.map((r) => ({ label: label(r), value: r.netSpend }))}
              tone="blue"
              valueLabel="Net spend"
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
          <Table minWidth="920px">
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
                  <>
                    <Th className="text-right">BILLS</Th>
                    <Th className="text-right">OUTSTANDING</Th>
                  </>
                )}
                <Th className="text-right">SPEND</Th>
                <Th className="text-right">RETURNED</Th>
                <Th className="text-right">NET SPEND</Th>
                <Th className="text-right">INPUT GST</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={byItem ? 8 : 9}
                  message={`Nothing billed between ${shortDate(from)} and ${shortDate(to)}`}
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
                    {r.id && groupBy === 'vendor' ? (
                      <Link
                        href={`/admin/vendors/${r.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {label(r)}
                      </Link>
                    ) : (
                      <span className="font-medium">{label(r)}</span>
                    )}
                    {r.sku && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                        {r.sku}
                      </span>
                    )}
                    {r.gstin && (
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {r.gstin}
                      </span>
                    )}
                  </Td>
                  {byItem ? (
                    <Td className="text-right text-muted-foreground">
                      {Number(r.quantity).toLocaleString(numberLocale())}
                      {r.unit ? ` ${r.unit}` : ''}
                    </Td>
                  ) : (
                    <>
                      <Td className="text-right text-muted-foreground">
                        {r.billCount}
                      </Td>
                      <Td className="text-right">
                        {r.outstanding ? (
                          <span className="text-warning">
                            {money(r.outstanding)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </Td>
                    </>
                  )}
                  <Td className="text-right">{money(r.spend)}</Td>
                  <Td className="text-right">
                    {r.returned ? (
                      <span className="text-warning">−{money(r.returned)}</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </Td>
                  <Td className="text-right font-semibold">{money(r.netSpend)}</Td>
                  <Td className="text-right text-muted-foreground">{money(r.tax)}</Td>
                  <Td>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: peak > 0 ? `${Math.max(2, (r.netSpend / peak) * 100)}%` : '0%' }}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
              {t && rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  {byItem ? (
                    <Td className="text-right">{Number(t.quantity).toLocaleString(numberLocale())}</Td>
                  ) : (
                    <>
                      <Td className="text-right">{t.billCount}</Td>
                      <Td className="text-right">{money(t.outstanding)}</Td>
                    </>
                  )}
                  <Td className="text-right">{money(t.grossSpend)}</Td>
                  <Td className="text-right">{t.returned ? `−${money(t.returned)}` : '—'}</Td>
                  <Td className="text-right">{money(t.netSpend)}</Td>
                  <Td className="text-right">{money(t.tax)}</Td>
                  <Td />
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>

      {t && t.reverseChargeTax > 0 && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {money(t.reverseChargeTax)} of the input GST above sits on reverse-charge bills. You pay
          that tax yourself rather than to the supplier, so it is not reclaimable in the ordinary
          way — it is shown separately on the GST return.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Built from bills, net of vendor credits — a purchase order is an intention and can be
        cancelled, while a bill is a debt that exists. Spend is the taxable value; input GST is
        reclaimable against what you charged, so counting it as cost would overstate what the goods
        cost you.
      </p>
    </>
  );
}
