'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import {
  Badge, Card, ErrorBox, Loading, PageHeader, Spinner, StatCard, Table, Td, Th, EmptyRow,
  type StatDetailGroup,
} from '@/components/ui';
import { DateRange, PRESETS, presetLabel, presetRange, type Range } from '@/components/DateRange';
import { Thumb } from '@/components/SearchSelect';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import {
  AgeingChart, ChannelDonut, OrdersCustomersChart, SalesTrendChart, TopProductsChart,
  type AgeingBucket, type Granularity, type SeriesPoint, type TopProduct,
} from '@/components/DashboardCharts';

const PERIOD_KEY = 'osmekos.dashboard.period';

function savedRange(): Range {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PERIOD_KEY) ?? 'null');
    if (saved?.preset) return presetRange(saved.preset);
    if (typeof saved?.from === 'string' && typeof saved?.to === 'string') return { from: saved.from, to: saved.to };
  } catch {
  }
  return presetRange('last-30');
}

function rememberRange(range: Range) {
  try {
    const today = new Date();
    const preset = !range.from && !range.to
      ? 'all'
      : PRESETS.find((p) => {
          const r = p.range(today);
          return r.from === range.from && r.to === range.to;
        })?.key;
    window.localStorage.setItem(PERIOD_KEY, JSON.stringify(preset ? { preset } : range));
  } catch {
  }
}

type Dashboard = {
  tiles: {
    totalRevenue: number;
    orderCount: number;
    unfulfilled: number;
    openPoValue: number;
    openPoCount: number;
    productCount: number;
    reorderAlertCount: number;
    averageOrderValue: number;
    customerLifetimeValue: number;
    payingCustomers: number;
    returnRateByValue: number;
    returnRateByOrder: number;
    returnedValue: number;
    returnCount: number;
    returnedOrderCount: number;
    cancelledOrders: number;
    newCustomers?: number;
    purchases?: number;
    billCount?: number;
    unitsSold?: number;
  };
  margin?: Margin;
  period?: { from: string | null; to: string | null; granularity: Granularity; seriesFrom: string; seriesTo: string };
  months: { month: string; revenue: number; orders: number; newCustomers: number }[];
  series?: SeriesPoint[];
  topProducts?: TopProduct[];
  ageing?: { receivables: AgeingBucket[]; payables: AgeingBucket[] };
  monthOnMonth: {
    month: string;
    revenue: number;
    orders: number;
    newCustomers: number;
    previousMonth: string | null;
    previousRevenue: number | null;
    previousOrders: number | null;
    revenueChange: number | null;
    ordersChange: number | null;
    newCustomersChange: number | null;
  } | null;
  payables: { total: number; overdue: number; overdueCount: number };
  reorderAlerts: {
    id: string; name: string; sku: string | null; reorderPoint: number; available: number;
    imageUrl?: string | null;
  }[];
  recentOrders: {
    id: string; orderNumber: string; placedAt: string; orderType: string; grandTotal: string;
    paymentStatus: string; fulfillmentStatus: string; deliveryMethod: string;
    customer: { firstName: string | null; lastName: string | null } | null;
  }[];
  recentPurchaseOrders: {
    id: string; poNumber: string; poDate: string; status: string; grandTotal: string;
    vendor: { displayName: string } | null;
  }[];
  channelSplit: {
    type: string; orders: number; revenue: number; percent: number;
    averageOrderValue?: number; units?: number;
  }[];
  breakdowns?: {
    revenue: {
      byPayment: { status: string; orders: number; value: number }[];
      subtotal: number;
      discount: number;
      shipping: number;
      codCharges?: number;
      tax: number;
      cgst: number;
      sgst: number;
      igst: number;
      cancelledOrders: number;
    };
    unfulfilled: {
      byType: { type: string; orders: number; value: number }[];
      byPayment: { status: string; orders: number; value: number }[];
      partiallyFulfilled: number;
      oldest: { id: string; orderNumber: string; placedAt: string } | null;
    };
    openPurchaseOrders: {
      byStatus: { status: string; count: number; value: number }[];
      byBilled: { status: string; count: number; value: number }[];
      tax: number;
      thisMonth: { value: number; count: number };
      lastMonth: { value: number; count: number };
    };
    customers: {
      byType: { type: string; customers: number; average: number; total: number }[];
      repeatCustomers: number;
    };
    products: {
      byStatus: { status: string; count: number }[];
      variants: number;
      outOfStock: number;
    };
  };
};

type MarginFigures = { sales: number; cost: number; profit: number; percent: number | null };

type Margin = MarginFigures & {
  salesWithoutCost: number;
  itemsWithoutCost: number;
  byChannel: (MarginFigures & { type: string })[];
};

const CHANNELS = ['D2C', 'B2B'] as const;

const PO_STATUS_LABEL: Record<string, string> = { ISSUED: 'Issued', PARTIALLY_RECEIVED: 'Partly received' };
const PRODUCT_LABEL: Record<string, string> = { ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived' };
const CHANNEL_LABEL: Record<string, string> = { B2B: 'B2B (business)', D2C: 'D2C (consumer)' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const average = (total: number, count: number | null | undefined) => (count ? total / count : 0);
const quantity = (n: number | undefined) => (n ?? 0).toLocaleString(numberLocale());
const percentText = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

function tileDetails(data: Dashboard) {
  const b = data.breakdowns;
  const mom = data.monthOnMonth;
  const channels = data.channelSplit;
  const byOrder = <T extends { orders: number; value: number }>(list: T[], name: (x: T) => string) =>
    list.map((x) => ({ label: name(x), note: plural(x.orders, 'order'), value: money(x.value) }));

  const monthRows = (value: (revenue: number, orders: number) => React.ReactNode) =>
    mom
      ? [
          { label: `This month · ${monthLabel(mom.month)}`, note: plural(mom.orders, 'order'), value: value(mom.revenue, mom.orders) },
          ...(mom.previousMonth && mom.previousRevenue !== null && mom.previousOrders !== null
            ? [
                {
                  label: `Last month · ${monthLabel(mom.previousMonth)}`,
                  note: plural(mom.previousOrders, 'order'),
                  value: value(mom.previousRevenue, mom.previousOrders),
                },
              ]
            : []),
        ]
      : [];

  const revenue: StatDetailGroup[] = [
    {
      heading: 'By channel',
      rows: channels.map((c) => ({
        label: CHANNEL_LABEL[c.type] ?? c.type,
        note: `${c.percent}%`,
        value: money(c.revenue),
      })),
    },
  ];

  const unfulfilled: StatDetailGroup[] = b
    ? [
        { heading: 'By channel', rows: byOrder(b.unfulfilled.byType, (t) => CHANNEL_LABEL[t.type] ?? t.type) },
        {
          heading: 'Waiting longest',
          rows: b.unfulfilled.oldest
            ? [
                {
                  label: (
                    <Link href={`/admin/orders/${b.unfulfilled.oldest.id}`} className="text-gold-ink hover:underline">
                      {b.unfulfilled.oldest.orderNumber}
                    </Link>
                  ),
                  value: daysAgo(b.unfulfilled.oldest.placedAt),
                },
              ]
            : [],
        },
      ]
    : [];

  const openPos: StatDetailGroup[] = b
    ? [
        {
          heading: 'Status',
          rows: b.openPurchaseOrders.byStatus.map((s) => ({
            label: PO_STATUS_LABEL[s.status] ?? s.status,
            note: plural(s.count, 'PO'),
            value: money(s.value),
          })),
        },
      ]
    : [];

  const aov: StatDetailGroup[] = [
    {
      heading: 'By channel',
      rows: channels.map((c) => ({
        label: CHANNEL_LABEL[c.type] ?? c.type,
        note: plural(c.orders, 'order'),
        value: money(average(c.revenue, c.orders)),
      })),
    },
    { heading: 'Month on month', rows: monthRows((r, o) => money(average(r, o))) },
  ];

  const clv: StatDetailGroup[] = b
    ? [
        {
          heading: 'By customer type',
          rows: b.customers.byType.map((c) => ({
            label: CHANNEL_LABEL[c.type] ?? c.type,
            note: plural(c.customers, 'customer'),
            value: money(c.average),
          })),
        },
        {
          heading: 'Loyalty',
          rows: [
            {
              label: 'Came back to buy again',
              note: data.tiles.payingCustomers
                ? `${Math.round((b.customers.repeatCustomers / data.tiles.payingCustomers) * 100)}%`
                : undefined,
              value: plural(b.customers.repeatCustomers, 'customer'),
            },
          ],
        },
      ]
    : [];

  const products: StatDetailGroup[] = b
    ? [
        {
          heading: 'Status',
          rows: b.products.byStatus.map((s) => ({ label: PRODUCT_LABEL[s.status] ?? s.status, value: s.count })),
        },
        {
          heading: 'Stock',
          rows: b.products.outOfStock > 0 ? [{ label: 'Out of stock', value: b.products.outOfStock }] : [],
        },
      ]
    : [];

  const units: StatDetailGroup[] = [
    {
      heading: 'By channel',
      rows: channels.map((c) => ({
        label: CHANNEL_LABEL[c.type] ?? c.type,
        note: plural(c.orders, 'order'),
        value: quantity(c.units),
      })),
    },
  ];

  const margin: StatDetailGroup[] = data.margin
    ? [
        {
          heading: 'By channel',
          rows: data.margin.byChannel.map((m) => ({
            label: CHANNEL_LABEL[m.type] ?? m.type,
            note: percentText(m.percent),
            value: money(m.profit),
          })),
        },
        {
          heading: 'Left out',
          rows:
            data.margin.salesWithoutCost > 0
              ? [
                  {
                    label: 'Sales with no cost price',
                    note: data.margin.itemsWithoutCost > 0 ? plural(data.margin.itemsWithoutCost, 'item') : undefined,
                    value: money(data.margin.salesWithoutCost),
                  },
                ]
              : [],
        },
      ]
    : [];

  return { revenue, unfulfilled, openPos, aov, clv, products, units, margin };
}

function ChannelCompare({ data, periodLabel }: { data: Dashboard; periodLabel: string }) {
  const byType = new Map(data.channelSplit.map((c) => [c.type, c]));
  const marginByType = new Map((data.margin?.byChannel ?? []).map((m) => [m.type, m]));
  const margin = data.margin;
  const countedOrders = data.channelSplit.reduce((n, c) => n + c.orders, 0);

  const rows: { label: string; value: (type: string) => React.ReactNode; total: React.ReactNode }[] = [
    {
      label: 'Revenue',
      value: (t) => money(byType.get(t)?.revenue ?? 0),
      total: money(data.tiles.totalRevenue),
    },
    { label: 'Orders', value: (t) => quantity(byType.get(t)?.orders), total: quantity(countedOrders) },
    {
      label: 'Average order',
      value: (t) => {
        const c = byType.get(t);
        return money(c?.averageOrderValue ?? average(c?.revenue ?? 0, c?.orders));
      },
      total: money(data.tiles.averageOrderValue),
    },
    { label: 'Units sold', value: (t) => quantity(byType.get(t)?.units), total: quantity(data.tiles.unitsSold) },
    ...(margin
      ? [
          {
            label: 'Profit',
            value: (t: string) => money(marginByType.get(t)?.profit ?? 0),
            total: money(margin.profit),
          },
          {
            label: 'Margin',
            value: (t: string) => percentText(marginByType.get(t)?.percent),
            total: percentText(margin.percent),
          },
        ]
      : []),
  ];

  const cell = 'text-right text-xs font-medium tabular-nums text-foreground sm:text-sm';

  return (
    <Card title="D2C vs B2B">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <span />
        {CHANNELS.map((t) => (
          <span key={t} className="caps-label text-right">
            {t}
          </span>
        ))}
        <span className="caps-label hidden text-right sm:block">All</span>
        {rows.map((row) => (
          <Fragment key={row.label}>
            <span className="min-w-0 truncate text-xs text-muted-foreground">{row.label}</span>
            {CHANNELS.map((t) => (
              <span key={t} className={cell}>
                {row.value(t)}
              </span>
            ))}
            <span className={`${cell} hidden sm:block`}>{row.total}</span>
          </Fragment>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {periodLabel}. Cancelled orders are left out.
        {margin && ' Profit is product sales before GST, minus what each item costs us today.'}
        {margin && margin.salesWithoutCost > 0 &&
          ` ${money(margin.salesWithoutCost)} of sales is not counted because the item has no cost price.`}
      </p>
    </Card>
  );
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(numberLocale(), { month: 'short', year: 'numeric' });
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[11px] text-muted-foreground">no prior month</span>;
  }
  const up = value >= 0;
  return (
    <span
      className={`text-[11px] font-medium ${
        up ? 'text-success' : 'text-destructive'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>(() => (typeof window === 'undefined' ? presetRange('last-30') : savedRange()));

  const load = useCallback(async (period: Range) => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get<{ data: Dashboard }>('/dashboard', { from: period.from, to: period.to });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(range), 0);
    return () => clearTimeout(t);
  }, [load, range]);

  function changeRange(next: Range) {
    setRange(next);
    rememberRange(next);
  }

  if (loading) return <Loading />;
  if (error && !data) return <ErrorBox message={error} onRetry={() => load(range)} />;
  if (!data) return null;

  const allTime = !range.from && !range.to;
  const periodLabel = presetLabel(range.from, range.to) ?? `${shortDate(range.from)} to ${shortDate(range.to)}`;
  const seriesLabel = allTime ? 'Last 12 months' : periodLabel;
  const topLabel = allTime ? 'Last 90 days' : periodLabel;

  const { tiles, payables, reorderAlerts, recentOrders, recentPurchaseOrders, channelSplit } = data;
  const { monthOnMonth: mom } = data;
  const details = tileDetails(data);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Osmekos Essentials Pvt. Ltd. · OsmeKos"
        actions={
          <div className="flex items-end gap-2">
            {refreshing && <Spinner />}
            <DateRange allowAll label="Showing" from={range.from} to={range.to} onChange={changeRange} />
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={() => load(range)} />
        </div>
      )}

      <NeedsAttention />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={money(tiles.totalRevenue)}
          sub={`${tiles.orderCount} orders · ${periodLabel}`}
          tone="blue"
          details={details.revenue}
        />
        <StatCard
          label="Unfulfilled Orders"
          value={tiles.unfulfilled}
          sub="waiting to ship right now"
          tone={tiles.unfulfilled > 0 ? 'amber' : 'green'}
          details={details.unfulfilled}
          align="right"
        />
        <StatCard
          label="Open Purchase Orders"
          value={money(tiles.openPoValue)}
          sub={`${tiles.openPoCount} issued · right now`}
          tone="purple"
          details={details.openPos}
        />
        <StatCard
          label="Average Order Value"
          value={money(tiles.averageOrderValue)}
          sub={`${periodLabel} · cancelled left out`}
          tone="green"
          details={details.aov}
          align="right"
        />
        <StatCard
          label="Customer Lifetime Value"
          value={money(tiles.customerLifetimeValue)}
          sub={`all time, over ${tiles.payingCustomers} buying customer${tiles.payingCustomers === 1 ? '' : 's'}`}
          tone="purple"
          details={details.clv}
        />
        <StatCard
          label="Products"
          value={tiles.productCount}
          sub={
            tiles.reorderAlertCount > 0
              ? `${tiles.reorderAlertCount} reorder alert(s)`
              : 'no reorder alerts'
          }
          tone={tiles.reorderAlertCount > 0 ? 'red' : 'slate'}
          details={details.products}
          align="right"
        />
        <StatCard
          label="Units Sold"
          value={quantity(tiles.unitsSold)}
          sub={`${periodLabel} · cancelled left out`}
          tone="blue"
          details={details.units}
        />
        {data.margin && (
          <StatCard
            label="Margin"
            value={percentText(data.margin.percent)}
            sub={`${money(data.margin.profit)} profit · ${periodLabel}`}
            tone={data.margin.profit < 0 ? 'red' : data.margin.sales > 0 ? 'green' : 'slate'}
            details={details.margin}
            align="right"
          />
        )}
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <SalesTrendChart
          series={data.series ?? []}
          granularity={data.period?.granularity ?? 'month'}
          periodLabel={seriesLabel}
        />
        <ChannelDonut channels={channelSplit} periodLabel={periodLabel} />
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <OrdersCustomersChart
          series={data.series ?? []}
          granularity={data.period?.granularity ?? 'month'}
          periodLabel={seriesLabel}
        />
        <TopProductsChart products={data.topProducts ?? []} periodLabel={topLabel} />
        <AgeingChart
          receivables={data.ageing?.receivables ?? []}
          payables={data.ageing?.payables ?? []}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <ChannelCompare data={data} periodLabel={periodLabel} />

          <Card
            title="Recent Orders"
            padded={false}
            action={
              <Link href="/admin/orders" className="text-xs font-medium text-gold-ink hover:underline">
                View all
              </Link>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  <Th>Total</Th>
                  <Th>Payment</Th>
                  <Th>Fulfillment</Th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && <EmptyRow colSpan={7} message="No orders yet" />}
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/60">
                    <Td>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs text-muted-foreground">{shortDate(o.placedAt)}</Td>
                    <Td>
                      {[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || '—'}
                    </Td>
                    <Td>
                      <Badge tone={o.orderType === 'B2B' ? 'purple' : 'gray'}>{o.orderType}</Badge>
                    </Td>
                    <Td className="font-medium">{money(o.grandTotal)}</Td>
                    <Td>
                      <Badge status={o.paymentStatus}>{o.paymentStatus.replaceAll('_', ' ')}</Badge>
                    </Td>
                    <Td>
                      <Badge status={o.fulfillmentStatus}>
                        {o.fulfillmentStatus.replaceAll('_', ' ')}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card
            title="Active Purchase Orders"
            padded={false}
            action={
              <Link
                href="/admin/purchase-orders"
                className="text-xs font-medium text-gold-ink hover:underline"
              >
                View all
              </Link>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>PO #</Th>
                  <Th>Date</Th>
                  <Th>Vendor</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recentPurchaseOrders.length === 0 && (
                  <EmptyRow colSpan={5} message="No purchase orders yet" />
                )}
                {recentPurchaseOrders.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/60">
                    <Td>
                      <Link
                        href={`/admin/purchase-orders/${p.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {p.poNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs text-muted-foreground">{shortDate(p.poDate)}</Td>
                    <Td>{p.vendor?.displayName ?? '—'}</Td>
                    <Td>
                      <Badge status={p.status}>{p.status.replaceAll('_', ' ')}</Badge>
                    </Td>
                    <Td className="font-medium">{money(p.grandTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Reorder Alerts">
            {reorderAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything is above its reorder point.</p>
            ) : (
              <div className="space-y-3">
                {reorderAlerts.map((i) => (
                  <div
                    key={i.id}
                    className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <Thumb url={i.imageUrl} label={i.name} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {i.name}
                        </div>
                        <div className="mt-0.5 text-xs text-warning">
                          {i.available} available · reorder at {i.reorderPoint}
                          {i.sku && <span className="text-warning/70"> · {i.sku}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Vendor Payables">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total outstanding</span>
                <span className="font-semibold">{money(payables.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overdue</span>
                <span className={payables.overdue > 0 ? 'font-semibold text-destructive' : ''}>
                  {money(payables.overdue)}
                  {payables.overdueCount > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">({payables.overdueCount})</span>
                  )}
                </span>
              </div>
            </div>
            <Link
              href="/admin/bills"
              className="mt-3 block text-xs font-medium text-gold-ink hover:underline"
            >
              View bills
            </Link>
          </Card>

          <Card title={mom ? `This month — ${monthLabel(mom.month)}` : 'This month'}>
            {!mom ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {[
                    { label: 'Revenue', value: money(mom.revenue), change: mom.revenueChange },
                    { label: 'Orders', value: String(mom.orders), change: mom.ordersChange },
                    { label: 'New customers', value: String(mom.newCustomers), change: mom.newCustomersChange },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {row.value}
                        </span>
                        <Delta value={row.change} />
                      </span>
                    </div>
                  ))}
                </div>

                {mom.previousMonth && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Compared with {monthLabel(mom.previousMonth)}. Cancelled orders are excluded
                    from both months.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card title={`Returns & cancellations · ${periodLabel}`}>
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Return rate by value
                </span>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {tiles.returnRateByValue}%
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Return rate by order
                </span>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {tiles.returnRateByOrder}%
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
                <span className="text-xs text-muted-foreground">Returned</span>
                <span className="text-sm tabular-nums text-foreground">
                  {money(tiles.returnedValue)}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    over {tiles.returnCount} return{tiles.returnCount === 1 ? '' : 's'}
                  </span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted-foreground">Cancelled orders</span>
                <span className="text-sm tabular-nums text-foreground">
                  {tiles.cancelledOrders}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              By value is how much of what you sold came back; by order is how often an order
              produces a return at all. Rejected returns are excluded — those goods never came
              back. Cancelled orders are not returns and are counted separately.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
