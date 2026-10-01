'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { RankChart } from '@/components/ReportChart';
import { CardList, RecordCard } from '@/components/CardList';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import {
  Badge, EmptyRow, ErrorBox, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { DateRange, presetRange } from '@/components/DateRange';

type Kind = 'all' | 'automatic' | 'code';
type DealType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
type Status = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'OFF' | 'DELETED' | 'MISSING';

type Usage = {
  orders: number;
  retailOrders: number;
  businessOrders: number;
  uniqueCustomers: number;
  retailCustomers: number;
  businessCustomers: number;
  discountGiven: number;
  salesValue: number;
  averageOrder: number;
};

type Row = Usage & {
  id: string;
  discountId: string | null;
  name: string;
  code: string | null;
  title: string | null;
  kind: 'AUTOMATIC' | 'CODE';
  type: DealType | null;
  value: number | null;
  status: Status;
  usedCount: number | null;
  usageLimit: number | null;
  isUsedUp: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type Meta = {
  period: { from: string; to: string; timeZone: string };
  filters: { kind: Kind; activeOnly: boolean };
  totals: Usage & {
    ordersWithOffer: number;
    totalOrders: number;
    offerShare: number;
    ordersWithoutOffer: number;
    averageOrderWithout: number;
    offersUsed: number;
    rowCount: number;
  };
  manual: Usage;
};

const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'All offers' },
  { key: 'automatic', label: 'Automatic only' },
  { key: 'code', label: 'Codes only' },
];

const STATUS: Record<Status, { label: string; tone: 'green' | 'blue' | 'red' | 'gray' | 'amber' }> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  SCHEDULED: { label: 'Scheduled', tone: 'blue' },
  EXPIRED: { label: 'Expired', tone: 'red' },
  OFF: { label: 'Switched off', tone: 'gray' },
  DELETED: { label: 'Deleted', tone: 'gray' },
  MISSING: { label: 'Not on file', tone: 'amber' },
};

const count = (n: number) => Number(n).toLocaleString(numberLocale());
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;
const percent = (n: number) =>
  `${Number(n).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })}%`;

function deal(r: Row) {
  if (r.type == null || r.value == null) return '—';
  switch (r.type) {
    case 'PERCENTAGE':
      return `${r.value}% off`;
    case 'FIXED_AMOUNT':
      return `${money(r.value)} off`;
    case 'FREE_SHIPPING':
      return 'Free shipping';
    case 'BUY_X_GET_Y':
      return `Buy ${r.value} get 1`;
  }
}

const kindLabel = (r: Row) => (r.kind === 'AUTOMATIC' ? 'Automatic' : 'Code');

const customerSplit = (u: Usage) => `${count(u.retailCustomers)} retail · ${count(u.businessCustomers)} business`;

function usedText(r: Row) {
  if (r.usedCount == null) return '—';
  return r.usageLimit == null ? `${count(r.usedCount)} used · no limit` : `${count(r.usedCount)} of ${count(r.usageLimit)} used`;
}

const linkOf = (r: Row) => (r.discountId && r.status !== 'DELETED' ? `/discounts/${r.discountId}` : undefined);

function UsageBar({ r }: { r: Row }) {
  if (r.usedCount == null) return <span className="text-muted-foreground/60">—</span>;
  const limited = r.usageLimit != null && r.usageLimit > 0;
  const width = limited ? Math.min(100, (r.usedCount / (r.usageLimit ?? 1)) * 100) : 0;
  return (
    <div className="min-w-24">
      <div className={`text-xs ${r.isUsedUp ? 'font-medium text-warning' : 'text-muted-foreground'}`}>
        {usedText(r)}
      </div>
      {limited && (
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${r.isUsedUp ? 'bg-warning' : 'bg-success/70'}`}
            style={{ width: `${Math.max(2, width)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function OfferName({ r }: { r: Row }) {
  const href = linkOf(r);
  const name = (
    <span className={`font-medium ${r.code ? 'font-mono' : ''} ${href ? 'text-gold-ink hover:underline' : ''}`}>
      {r.name}
    </span>
  );
  return (
    <>
      {href ? <Link href={href}>{name}</Link> : name}
      {r.kind === 'AUTOMATIC' && (
        <Badge tone="blue" className="ml-2">automatic</Badge>
      )}
      {r.code && r.title && (
        <span className="block text-xs text-muted-foreground">{r.title}</span>
      )}
    </>
  );
}

export default function OfferUsageReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState(() => presetRange('last-30'));
  const [kind, setKind] = useState<Kind>('all');
  const [activeOnly, setActiveOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Row[]; meta: Meta }>('/reports/offers', {
        from: range.from,
        to: range.to,
        kind,
        activeOnly,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, kind, activeOnly]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const sel = useRowSelection(rows);

  const t = meta?.totals;
  const manual = meta?.manual;
  const from = meta?.period.from ?? range.from;
  const to = meta?.period.to ?? range.to;
  const given = rows.filter((r) => r.discountGiven > 0);

  function exportSpec() {
    const columns: Column<Row>[] = [
      { header: 'Offer', value: (r) => r.name, width: 150 },
      { header: 'Description', value: (r) => (r.code ? (r.title ?? '') : '') },
      { header: 'Kind', value: (r) => kindLabel(r) },
      { header: 'Deal', value: (r) => deal(r) },
      { header: 'Status', value: (r) => STATUS[r.status].label },
      { header: 'Orders', value: (r) => r.orders, align: 'right' },
      { header: 'Customers', value: (r) => r.uniqueCustomers, align: 'right' },
      { header: 'Retail customers', value: (r) => r.retailCustomers, align: 'right' },
      { header: 'Business customers', value: (r) => r.businessCustomers, align: 'right' },
      { header: 'Discount given', value: (r) => r.discountGiven, money: true },
      { header: 'Order value', value: (r) => r.salesValue, money: true },
      { header: 'Average order', value: (r) => r.averageOrder, money: true },
      { header: 'Times used (all time)', value: (r) => r.usedCount ?? '', align: 'right' },
      { header: 'Usage limit', value: (r) => r.usageLimit ?? '', align: 'right' },
    ];
    return {
      title: 'Offer Usage',
      subtitle: `${shortDate(from)} to ${shortDate(to)}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total', '', '', '', '',
        t?.ordersWithOffer ?? 0,
        t?.uniqueCustomers ?? 0,
        t?.retailCustomers ?? 0,
        t?.businessCustomers ?? 0,
        t?.discountGiven ?? 0,
        t?.salesValue ?? 0,
        t?.ordersWithOffer ? t.averageOrder : '',
        '', '',
      ],
      footnote:
        'Placed orders only. Drafts and cancelled orders are left out. Order value is what the ' +
        `customer pays, after the discount. ${
          manual && manual.orders > 0
            ? `A further ${plural(manual.orders, 'order')} got ${money(manual.discountGiven)} off typed in by hand, with no offer.`
            : ''
        }`,
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Offer usage"
        subtitle="How each discount was used, and what it gave away"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Orders with an offer"
            value={count(t.ordersWithOffer)}
            sub={`out of ${plural(t.totalOrders, 'order')}`}
          />
          <StatCard
            label="Discount given"
            value={money(t.discountGiven)}
            sub={
              manual && manual.discountGiven > 0
                ? `plus ${money(manual.discountGiven)} typed by hand`
                : 'through offers'
            }
            tone="amber"
          />
          <StatCard
            label="Share of orders"
            value={percent(t.offerShare)}
            sub={`${plural(t.ordersWithoutOffer, 'order')} had no offer`}
            tone="blue"
          />
          <StatCard
            label="Average order"
            value={t.ordersWithOffer ? money(t.averageOrder) : '—'}
            sub={
              t.ordersWithoutOffer
                ? `${money(t.averageOrderWithout)} without an offer`
                : 'no orders without an offer'
            }
            tone="green"
          />
        </div>
      )}

      {given.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Where the discount went
          </h3>
          <RankChart
            points={given.map((r) => ({ label: r.name, value: r.discountGiven }))}
            tone="amber"
            valueLabel="Discount given"
          />
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRange from={range.from} to={range.to} onChange={setRange} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Offers
            </span>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="w-44"
            >
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active offers only
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />
        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty={`No offers used between ${shortDate(from)} and ${shortDate(to)}`}>
              {rows.map((r, i) => {
                const s = STATUS[r.status];
                return (
                  <RecordCard
                    key={r.id}
                    href={linkOf(r)}
                    title={r.name}
                    mono={!!r.code}
                    amount={money(r.discountGiven)}
                    date={r.code && r.title ? `${deal(r)} · ${r.title}` : deal(r)}
                    primary={`${plural(r.orders, 'order')} · ${money(r.salesValue)} order value`}
                    secondary={`${plural(r.uniqueCustomers, 'customer')} (${customerSplit(r)}) · average ${money(r.averageOrder)}`}
                    footer={usedText(r)}
                    select={
                      <SelectBox
                        checked={sel.isSelected(sel.idOf(r, i))}
                        onToggle={() => sel.toggle(sel.idOf(r, i))}
                      />
                    }
                    badges={
                      <>
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {r.kind === 'AUTOMATIC' && <Badge tone="blue">automatic</Badge>}
                        {r.isUsedUp && <Badge tone="amber">limit reached</Badge>}
                      </>
                    }
                  />
                );
              })}
            </CardList>

            <div className="hidden md:block">
              <Table minWidth="1120px">
                <thead>
                  <tr>
                    <Th className="w-8">
                      <SelectAllBox
                        allSelected={sel.allSelected}
                        someSelected={sel.someSelected}
                        onToggle={sel.toggleAll}
                      />
                    </Th>
                    <Th>OFFER</Th>
                    <Th>DEAL</Th>
                    <Th className="text-right">ORDERS</Th>
                    <Th className="text-right">CUSTOMERS</Th>
                    <Th className="text-right">DISCOUNT GIVEN</Th>
                    <Th className="text-right">ORDER VALUE</Th>
                    <Th className="text-right">AVERAGE ORDER</Th>
                    <Th>TIMES USED</Th>
                    <Th>STATUS</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <EmptyRow
                      colSpan={10}
                      message={`No offers used between ${shortDate(from)} and ${shortDate(to)}`}
                    />
                  )}
                  {rows.map((r, i) => {
                    const s = STATUS[r.status];
                    return (
                      <tr key={r.id} className="hover:bg-muted/60">
                        <Td>
                          <SelectBox
                            checked={sel.isSelected(sel.idOf(r, i))}
                            onToggle={() => sel.toggle(sel.idOf(r, i))}
                          />
                        </Td>
                        <Td>
                          <OfferName r={r} />
                        </Td>
                        <Td className="whitespace-nowrap">{deal(r)}</Td>
                        <Td className="text-right">{count(r.orders)}</Td>
                        <Td className="text-right">
                          {count(r.uniqueCustomers)}
                          {r.uniqueCustomers > 0 && (
                            <span className="block whitespace-nowrap text-[11px] text-muted-foreground">
                              {customerSplit(r)}
                            </span>
                          )}
                        </Td>
                        <Td className="text-right font-semibold">
                          {r.discountGiven ? money(r.discountGiven) : <span className="font-normal text-muted-foreground/60">—</span>}
                        </Td>
                        <Td className="text-right">{money(r.salesValue)}</Td>
                        <Td className="text-right text-muted-foreground">
                          {r.orders ? money(r.averageOrder) : '—'}
                        </Td>
                        <Td>
                          <UsageBar r={r} />
                        </Td>
                        <Td>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                  {t && rows.length > 0 && (
                    <tr className="border-t-2 border-border font-semibold">
                      <Td />
                      <Td>Total</Td>
                      <Td />
                      <Td className="text-right">{count(t.ordersWithOffer)}</Td>
                      <Td className="text-right">{count(t.uniqueCustomers)}</Td>
                      <Td className="text-right">{money(t.discountGiven)}</Td>
                      <Td className="text-right">{money(t.salesValue)}</Td>
                      <Td className="text-right">{t.ordersWithOffer ? money(t.averageOrder) : '—'}</Td>
                      <Td />
                      <Td />
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>

            {manual && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium text-foreground">Discounts typed in by hand</span>
                {manual.orders > 0 ? (
                  <span className="text-muted-foreground">
                    {plural(manual.orders, 'order')} got{' '}
                    <span className="font-semibold text-foreground">{money(manual.discountGiven)}</span> off
                    with no offer · {money(manual.salesValue)} order value ·{' '}
                    {plural(manual.uniqueCustomers, 'customer')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None in this period</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Counts placed orders only. Drafts and cancelled orders are left out. Order value is what the
        customer pays after the discount. Discount given is the money the offer took off; a free
        shipping offer shows nothing here because the delivery charge it saved is not a discount.
        Times used counts every use so far, not just this period.
      </p>
    </>
  );
}
