'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { api, money } from '@/lib/api';
import {
  CHART_COLORS, ChartContainer, ChartTooltip, ChartTooltipContent, compactAmount, type ChartConfig,
} from '@/components/ui/chart';
import { Card, Select } from './ui';

export type SalesPoint = {
  month: string;
  label: string;
  quantity: number;
  revenue: number;
};

function MonthBars({
  points,
  dataKey,
  title,
  tone,
  money: isMoney,
}: {
  points: SalesPoint[];
  dataKey: 'quantity' | 'revenue';
  title: string;
  tone: keyof typeof CHART_COLORS;
  money: boolean;
}) {
  const config = { [dataKey]: { label: title, ...CHART_COLORS[tone] } } satisfies ChartConfig;
  const total = points.reduce((n, p) => n + p[dataKey], 0);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {isMoney ? money(total) : total} over {points.length} months
        </span>
      </div>
      <ChartContainer config={config} className="aspect-auto h-[170px]">
        <BarChart data={points} margin={{ left: isMoney ? 4 : -16, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={8}
            tickFormatter={(v: string) => v.split(' ')[0]}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={isMoney ? 52 : 40}
            tickFormatter={(v: number) => (isMoney ? compactAmount(v) : String(v))}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent valueFormatter={(v) => (isMoney ? money(v) : v.toLocaleString())} />
            }
          />
          <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

type SummaryLabels = {
  title?: string;
  quantityLabel?: string;
  revenueLabel?: string;
  unitsCaption?: string;
  totalCaption?: string;
  emptyMessage?: string;
};

export function LoadedSalesSummary({ endpoint, ...labels }: { endpoint: string } & SummaryLabels) {
  const [months, setMonths] = useState(12);
  const [summary, setSummary] = useState<{
    key: string;
    points: SalesPoint[];
    totalQuantity: number;
    totalRevenue: number;
  } | null>(null);
  const [failedKey, setFailedKey] = useState('');
  const key = `${endpoint}|${months}`;

  useEffect(() => {
    let live = true;
    api
      .get<{ data: SalesPoint[]; meta: { totalQuantity: number; totalRevenue: number } }>(endpoint, { months })
      .then((res) => {
        if (live) {
          setSummary({ key: `${endpoint}|${months}`, points: res.data, ...res.meta });
        }
      })
      .catch(() => {
        if (live) setFailedKey(`${endpoint}|${months}`);
      });
    return () => {
      live = false;
    };
  }, [endpoint, months]);

  if (failedKey === key) return null;
  if (!summary) {
    return (
      <Card title={labels.title ?? 'Sales order summary'}>
        <div className="h-[180px] animate-pulse rounded-md bg-muted" />
      </Card>
    );
  }
  return (
    <SalesSummary
      {...labels}
      points={summary.points}
      totalQuantity={summary.totalQuantity}
      totalRevenue={summary.totalRevenue}
      months={months}
      onMonthsChange={setMonths}
    />
  );
}

export function SalesSummary({
  points,
  totalQuantity,
  totalRevenue,
  months,
  onMonthsChange,
  title = 'Sales order summary',
  quantityLabel = 'Quantity sold',
  revenueLabel = 'Revenue',
  unitsCaption = 'units sold',
  totalCaption = 'total sales',
  emptyMessage = 'No sales in this period. Cancelled orders are excluded.',
}: {
  points: SalesPoint[];
  totalQuantity: number;
  totalRevenue: number;
  months: number;
  onMonthsChange: (m: number) => void;
  title?: string;
  quantityLabel?: string;
  revenueLabel?: string;
  unitsCaption?: string;
  totalCaption?: string;
  emptyMessage?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const empty = totalQuantity === 0 && totalRevenue === 0;

  return (
    <Card
      title={title}
      action={
        <div className="flex gap-2">
          <Select
            value={String(months)}
            onChange={(e) => onMonthsChange(Number(e.target.value))}
            className="text-xs"
            aria-label="Period"
          >
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="24">Last 24 months</option>
          </Select>
          <Select
            value={view}
            onChange={(e) => setView(e.target.value as 'chart' | 'table')}
            className="text-xs"
            aria-label="Show as"
          >
            <option value="chart">Chart</option>
            <option value="table">Table</option>
          </Select>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-6">
        <div>
          <div className="text-xl font-semibold tabular-nums text-foreground">
            {totalQuantity}
          </div>
          <div className="text-xs text-muted-foreground">{unitsCaption}</div>
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums text-foreground">
            {money(totalRevenue)}
          </div>
          <div className="text-xs text-muted-foreground">{totalCaption}</div>
        </div>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : view === 'chart' ? (
        <div className="space-y-5">
          <MonthBars points={points} dataKey="quantity" title={quantityLabel} tone="sky" money={false} />
          <MonthBars points={points} dataKey="revenue" title={revenueLabel} tone="teal" money />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">
                  Month
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">
                  {quantityLabel}
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground">
                  {revenueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month}>
                  <td className="px-2 py-1 text-foreground">{p.label}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.quantity}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{money(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Months with nothing in them show as zero, so gaps in the bars are real.
      </p>
    </Card>
  );
}
