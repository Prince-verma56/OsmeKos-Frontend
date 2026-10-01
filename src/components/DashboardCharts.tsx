'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, Pie, PieChart, XAxis, YAxis,
} from 'recharts';
import { money, numberLocale } from '@/lib/api';
import {
  CHART_COLORS, ChartContainer, ChartEmpty, ChartLegend, ChartLegendContent, ChartTooltip,
  ChartTooltipContent, compactAmount, type ChartConfig,
} from '@/components/ui/chart';

export type Granularity = 'day' | 'week' | 'month';
export type SeriesPoint = { key: string; revenue: number; orders: number; purchases: number; newCustomers: number };
export type ChannelSlice = { type: string; orders: number; revenue: number; percent: number };
export type TopProduct = { name: string; units: number; revenue: number };
export type AgeingBucket = { bucket: string; amount: number };

const dateOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};

export function tickLabel(key: string, granularity: Granularity) {
  const d = dateOf(key);
  return granularity === 'month'
    ? d.toLocaleDateString(numberLocale(), { month: 'short' })
    : d.toLocaleDateString(numberLocale(), { day: 'numeric', month: 'short' });
}

export function pointLabel(key: string, granularity: Granularity) {
  const d = dateOf(key);
  if (granularity === 'month') return d.toLocaleDateString(numberLocale(), { month: 'long', year: 'numeric' });
  if (granularity === 'week') return `Week of ${d.toLocaleDateString(numberLocale(), { day: 'numeric', month: 'short' })}`;
  return d.toLocaleDateString(numberLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

const moneyValue = (value: number) => money(value);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

const salesConfig = {
  revenue: { label: 'Sales', ...CHART_COLORS.teal },
  purchases: { label: 'Purchases', ...CHART_COLORS.amber },
} satisfies ChartConfig;

export function SalesTrendChart({
  series,
  granularity,
  periodLabel,
}: {
  series: SeriesPoint[];
  granularity: Granularity;
  periodLabel: string;
}) {
  const sales = series.reduce((n, p) => n + p.revenue, 0);
  const purchases = series.reduce((n, p) => n + p.purchases, 0);
  const orders = series.reduce((n, p) => n + p.orders, 0);
  const every = granularity === 'day' ? 'day' : granularity;

  return (
    <ChartCard
      title="Sales and purchases"
      subtitle={`${money(sales)} from ${plural(orders, 'order')} · ${money(purchases)} billed by vendors · ${periodLabel}, by ${every}`}
      className="lg:col-span-2"
    >
      {sales === 0 && purchases === 0 ? (
        <ChartEmpty message="No sales or purchases in this period" className="aspect-auto h-[260px]" />
      ) : (
        <ChartContainer config={salesConfig} className="aspect-auto h-[260px]">
          <AreaChart data={series} margin={{ left: 4, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillPurchases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-purchases)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-purchases)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="key"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
              tickFormatter={(v: string) => tickLabel(v, granularity)}
            />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactAmount(v)} />
            <ChartTooltip
              cursor={{ strokeDasharray: '4 4' }}
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) => {
                    const count = Number(payload[0]?.payload?.orders ?? 0);
                    return `${pointLabel(String(label), granularity)} · ${plural(count, 'order')}`;
                  }}
                  valueFormatter={moneyValue}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="purchases"
              type="monotone"
              stroke="var(--color-purchases)"
              strokeWidth={2}
              fill="url(#fillPurchases)"
              dot={series.length <= 12 ? { r: 2.5 } : false}
            />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2.5}
              fill="url(#fillRevenue)"
              dot={series.length <= 12 ? { r: 3 } : false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

const CHANNEL_NAMES: Record<string, string> = { B2B: 'B2B (business)', D2C: 'D2C (consumer)' };
const channelConfig = {
  B2B: { label: 'B2B (business)', ...CHART_COLORS.purple },
  D2C: { label: 'D2C (consumer)', ...CHART_COLORS.teal },
} satisfies ChartConfig;

export function ChannelDonut({ channels, periodLabel }: { channels: ChannelSlice[]; periodLabel: string }) {
  const total = channels.reduce((n, c) => n + c.revenue, 0);
  const orders = channels.reduce((n, c) => n + c.orders, 0);
  const data = channels.map((c) => ({ ...c, fill: `var(--color-${c.type})` }));

  return (
    <ChartCard title="Sales by channel" subtitle={`${periodLabel} · cancelled orders left out`}>
      {total === 0 ? (
        <ChartEmpty message="No sales in this period" className="aspect-auto h-[200px]" />
      ) : (
        <>
          <div className="relative">
            <ChartContainer config={channelConfig} className="mx-auto aspect-square h-[200px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="type" valueFormatter={moneyValue} />} />
                <Pie
                  data={data}
                  dataKey="revenue"
                  nameKey="type"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={channels.length > 1 ? 3 : 0}
                  strokeWidth={0}
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {compactAmount(total)}
              </span>
              <span className="text-[11px] text-muted-foreground">{plural(orders, 'order')}</span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {channels.map((c) => (
              <div key={c.type} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className={`h-2.5 w-2.5 rounded-[2px] ${
                      c.type === 'B2B' ? 'bg-gold' : 'bg-primary'
                    }`}
                  />
                  {CHANNEL_NAMES[c.type] ?? c.type}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{money(c.revenue)}</span>
                  {' · '}
                  {c.percent}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}

const ordersConfig = {
  orders: { label: 'Orders', ...CHART_COLORS.sky },
  newCustomers: { label: 'New customers', ...CHART_COLORS.purple },
} satisfies ChartConfig;

export function OrdersCustomersChart({
  series,
  granularity,
  periodLabel,
}: {
  series: SeriesPoint[];
  granularity: Granularity;
  periodLabel: string;
}) {
  const orders = series.reduce((n, p) => n + p.orders, 0);
  const customers = series.reduce((n, p) => n + p.newCustomers, 0);
  return (
    <ChartCard
      title="Orders and new customers"
      subtitle={`${plural(orders, 'order')} · ${plural(customers, 'new customer')} · ${periodLabel}`}
    >
      {orders === 0 && customers === 0 ? (
        <ChartEmpty message="No orders or new customers in this period" className="aspect-auto h-[220px]" />
      ) : (
        <ChartContainer config={ordersConfig} className="aspect-auto h-[220px]">
          <ComposedChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="key"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={(v: string) => tickLabel(v, granularity)}
            />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(label) => pointLabel(String(label), granularity)} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line
              dataKey="newCustomers"
              type="monotone"
              stroke="var(--color-newCustomers)"
              strokeWidth={2}
              dot={series.length <= 16 ? { r: 2.5 } : false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

const topConfig = { revenue: { label: 'Sales', ...CHART_COLORS.teal } } satisfies ChartConfig;

export function TopProductsChart({ products, periodLabel }: { products: TopProduct[]; periodLabel: string }) {
  const data = products.map((p) => ({ ...p, short: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name }));
  return (
    <ChartCard title="Top products" subtitle={`By sales · ${periodLabel}`}>
      {data.length === 0 ? (
        <ChartEmpty message="Nothing sold in this period" className="aspect-auto h-[220px]" />
      ) : (
        <ChartContainer config={topConfig} className="aspect-auto h-[220px]">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => compactAmount(v)} />
            <YAxis type="category" dataKey="short" tickLine={false} axisLine={false} width={116} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const p = payload[0]?.payload as TopProduct | undefined;
                    return p ? `${p.name} · ${plural(p.units, 'unit')}` : '';
                  }}
                  valueFormatter={moneyValue}
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

const ageingConfig = {
  receivables: { label: 'Customers owe you', ...CHART_COLORS.teal },
  payables: { label: 'You owe vendors', ...CHART_COLORS.rose },
} satisfies ChartConfig;

export function AgeingChart({ receivables, payables }: { receivables: AgeingBucket[]; payables: AgeingBucket[] }) {
  const data = receivables.map((r, i) => ({
    bucket: r.bucket,
    receivables: r.amount,
    payables: payables[i]?.amount ?? 0,
  }));
  const owed = receivables.reduce((n, b) => n + b.amount, 0);
  const owing = payables.reduce((n, b) => n + b.amount, 0);
  return (
    <ChartCard title="Money due right now" subtitle={`${money(owed)} to collect · ${money(owing)} to pay`}>
      {owed === 0 && owing === 0 ? (
        <ChartEmpty message="Nothing outstanding" className="aspect-auto h-[220px]" />
      ) : (
        <ChartContainer config={ageingConfig} className="aspect-auto h-[220px]">
          <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactAmount(v)} />
            <ChartTooltip content={<ChartTooltipContent valueFormatter={moneyValue} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="receivables" fill="var(--color-receivables)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="payables" fill="var(--color-payables)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}
