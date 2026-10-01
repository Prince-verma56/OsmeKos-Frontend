'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, money, dateTime, shortDate, errorMessage, type Paged } from '@/lib/api';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';
import { CardList, RecordCard, CardAction } from '@/components/CardList';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import { Thumb } from '@/components/SearchSelect';
import {
  Popover, PopoverBody, PopoverFoot, PopoverHead, PopoverRow,
} from '@/components/Popover';
import type { Column } from '@/lib/export';
import { DateRange, type Range } from '@/components/DateRange';

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName?: string | null;
  email: string | null;
  phone: string | null;
  customerType?: string;
  totalOrders?: number;
  totalSpent?: string;
};

type Order = {
  id: string;
  orderNumber: string;
  referenceNumber?: string | null;
  isDraft: boolean;
  orderType: 'D2C' | 'B2B';
  replacementForId?: string | null;
  isFreeReplacement?: boolean;
  replacementFor?: { id: string; orderNumber: string } | null;
  sourceInvoice?: { id: string; invoiceNumber: string; status: string } | null;
  customer: Customer | null;
  customerSnapshot: { firstName?: string; lastName?: string; phone?: string; email?: string } | null;
  grandTotal: string;
  balanceDue: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  paymentMethod: string;
  deliveryMethod: string;
  confirmationStatus: string;
  confirmationExpiresAt: string | null;
  placedAt: string | null;
  createdAt: string;
  tags: string[];
  shippingAddress: Record<string, string | null | undefined> | null;
  lines: {
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
    variantTitle?: string | null;
    unitPrice?: string;
    imageUrl?: string | null;
  }[];
  fulfillments?: {
    id: string;
    fulfillmentNumber: string;
    status: string;
    trackingCompany: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    awbNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  }[];
  _count?: { lines: number; invoices: number; replacements?: number };
};

type Meta = Paged<Order>['meta'] & {
  tiles: {
    totalOrders: number; pendingPayment: number; unfulfilled: number; inTransit: number;
    delivered: number; cancelled: number; drafts: number; abandoned: number;
  };
  tabs: { all: number; d2c: number; b2b: number; draft: number; abandoned: number };
};

const SHIPMENT_STATE: Record<string, string> = {
  PENDING: 'Awaiting pickup',
  OPEN: 'In progress',
  SUCCESS: 'Fulfilled',
  CANCELLED: 'Cancelled',
};

const TABS = [
  ['all', 'All'],
  ['d2c', 'D2C'],
  ['b2b', 'B2B'],
  ['draft', 'Drafts'],
  ['abandoned', 'Abandoned'],
] as const;

function Dot({ done, title }: { done: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`inline-block h-2 w-2 rounded-full ${
        done ? 'bg-primary' : 'bg-border'
      }`}
    />
  );
}

const customerName = (o: Order) => {
  const c = o.customer ?? o.customerSnapshot ?? null;
  if (!c) return 'Guest';
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || c.phone || c.email || 'Guest';
};

function hoursLeft(o: Order) {
  if (o.confirmationStatus !== 'PENDING' || !o.confirmationExpiresAt) return null;
  const ms = new Date(o.confirmationExpiresAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.round(ms / 3_600_000);
}

const SORTABLE: Record<string, string> = {
  Order: 'orderNumber',
  Date: 'placedAt',
  Total: 'grandTotal',
};

export function OrdersView({ only }: { only?: 'b2b' }) {
  const [rows, setRows] = useState<Order[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useSearchParams();
  const [tab, setTab] = useState<string>(() => {
    if (only) return only;
    const asked = params.get('type') ?? '';
    return TABS.some(([k]) => k === asked) ? asked : 'all';
  });
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState(() => {
    const asked = params.get('status') ?? '';
    return ['OPEN', 'CLOSED', 'CANCELLED', 'DRAFT'].includes(asked) ? asked : '';
  });
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState(() => {
    const asked = params.get('fulfillment') ?? '';
    return /^[A-Z_]+$/.test(asked) ? asked : '';
  });
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('placedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [range, setRange] = useState<Range>({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Order>>('/orders', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        type: tab,
        search: search || undefined,
        orderStatus: orderStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        fulfillmentStatus: fulfillmentStatus || undefined,
        deliveryMethod: deliveryMethod || undefined,
        sortBy,
        sortOrder,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, tab, search, orderStatus, paymentStatus, fulfillmentStatus, deliveryMethod, sortBy, sortOrder, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function toggleSort(label: string) {
    const field = SORTABLE[label];
    if (!field) return;
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  }

  const header = (label: string, className = '') => {
    const field = SORTABLE[label];
    if (!field) return <Th className={className}>{label}</Th>;
    const active = sortBy === field;
    return (
      <Th className={className}>
        <button
          type="button"
          onClick={() => toggleSort(label)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {label}
          <span className={active ? '' : 'text-muted-foreground/60'}>
            {active ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </button>
      </Th>
    );
  };

  const tiles = meta?.tiles;
  const abandoned = tab === 'abandoned';

  function exportSpec() {
    const columns: Column<Order>[] = [
      { header: 'Order', value: (r) => r.orderNumber, width: 70 },
      { header: 'Reference', value: (r) => r.referenceNumber ?? '' },
      { header: 'Date', value: (r) => shortDate(r.placedAt ?? r.createdAt) },
      { header: 'Customer', value: (r) => customerName(r), width: 140 },
      { header: 'Type', value: (r) => r.orderType },
      { header: 'Total', value: (r) => Number(r.grandTotal), money: true },
      { header: 'Balance due', value: (r) => Number(r.balanceDue), money: true },
      { header: 'Order status', value: (r) => r.orderStatus },
      { header: 'Payment', value: (r) => r.paymentStatus },
      { header: 'Fulfilment', value: (r) => r.fulfillmentStatus },
      { header: 'Delivery', value: (r) => r.deliveryStatus },
    ];
    return {
      title: 'Orders',
      subtitle: `${TABS.find(([k]) => k === tab)?.[1] ?? 'All'} · ${sel.count || rows.length} order(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Balance due is the order total less payments recorded against it. A cancelled order ' +
        'keeps its figures for the record but is not owed.',
      orientation: 'landscape' as const,
    };
  }
  return (
    <>
      <PageHeader
        title={only === 'b2b' ? 'B2B orders' : 'Orders'}
        subtitle={
          only === 'b2b'
            ? 'Orders placed by salons, stockists and other business accounts'
            : 'D2C and B2B orders, drafts and abandoned checkouts'
        }
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            {!only && (
              <Link href="/admin/orders/new/d2c">
                <Button variant="primary">+ D2C order</Button>
              </Link>
            )}
            {only === 'b2b' && (
              <Link href="/admin/orders/new/b2b">
                <Button variant="primary">+ B2B order</Button>
              </Link>
            )}
          </div>
        }
      />

      {tiles && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-8">
          <StatCard label="Total orders" value={tiles.totalOrders} />
          <StatCard label="Payment pending" value={tiles.pendingPayment} tone="amber" />
          <StatCard label="Unfulfilled" value={tiles.unfulfilled} tone="red" />
          <StatCard label="In transit" value={tiles.inTransit} tone="blue" />
          <StatCard label="Delivered" value={tiles.delivered} tone="green" />
          <StatCard label="Cancelled" value={tiles.cancelled} tone="slate" />
          <StatCard label="Draft orders" value={tiles.drafts} tone="amber" />
          <StatCard label="Abandoned" value={tiles.abandoned} tone="purple" />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="order"
        endpoint="/orders/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className={`flex flex-wrap gap-1 border-b border-border px-3 pt-3 ${only ? 'hidden' : ''}`}>
          {TABS.map(([key, label]) => {
            const count = meta?.tabs?.[key as keyof Meta['tabs']];
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setPage(1);
                }}
                className={`rounded-t-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {count !== undefined && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search order number, customer or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={(next) => { setRange(next); setPage(1); }} />
          <Select
            value={orderStatus}
            onChange={(e) => {
              setOrderStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any order status</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="DRAFT">Draft</option>
          </Select>
          <Select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any payment</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
          <Select
            value={fulfillmentStatus}
            onChange={(e) => {
              setFulfillmentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any fulfilment</option>
            <option value="UNFULFILLED">Unfulfilled</option>
            <option value="PARTIALLY_FULFILLED">Partially fulfilled</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="RESTOCKED">Restocked</option>
          </Select>
          <Select
            value={deliveryMethod}
            onChange={(e) => {
              setDeliveryMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any delivery</option>
            <option value="PREPAID">Prepaid</option>
            <option value="COD">COD</option>
            <option value="B2B_TRANSPORT">B2B transport</option>
            <option value="SELF_PICKUP">Self pickup</option>
          </Select>
          {(search || orderStatus || paymentStatus || fulfillmentStatus || deliveryMethod) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setOrderStatus('');
                setPaymentStatus('');
                setFulfillmentStatus('');
                setDeliveryMethod('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBox message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty={abandoned ? 'No abandoned checkouts' : 'No orders match those filters'}>
              {rows.map((o) => {
                const left = hoursLeft(o);
                const items = o._count?.lines ?? o.lines?.length ?? 0;
                const dest = o.shippingAddress;
                const cancelled = o.orderStatus === 'CANCELLED';
                return (
                  <RecordCard
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    title={o.orderNumber}
                    strike={cancelled}
                    amount={money(o.grandTotal)}
                    date={o.placedAt ? shortDate(o.placedAt) : shortDate(o.createdAt)}
                    note={Number(o.balanceDue) > 0 ? `${money(o.balanceDue)} due` : undefined}
                    primary={customerName(o)}
                    secondary={
                      [
                        o.customer?.phone ?? o.customer?.email,
                        dest?.city
                          ? `${dest.city}${dest.stateCode ? ', ' + dest.stateCode : ''}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                    alert={left !== null ? `COD: ${left}h to confirm` : undefined}
                    footer={`${items} item${items === 1 ? '' : 's'}${
                      o.deliveryMethod === 'COD' ? ' · COD' : ''
                    }`}
                    select={
                      <SelectBox checked={sel.isSelected(o.id)} onChange={() => sel.toggle(o.id)} />
                    }
                    badges={
                      <>
                        <Badge tone={o.orderType === 'B2B' ? 'purple' : 'gray'}>{o.orderType}</Badge>
                        {o.isDraft && <Badge tone="amber">Draft</Badge>}
                        {o.sourceInvoice && <Badge tone="gray">From {o.sourceInvoice.invoiceNumber}</Badge>}
                        {o.replacementForId && (
                          <Badge tone="blue">{o.isFreeReplacement ? 'Free replacement' : 'Replacement'}</Badge>
                        )}
                        {(o._count?.replacements ?? 0) > 0 && <Badge tone="blue">Replaced</Badge>}
                        <Badge status={o.paymentStatus}>
                          {o.paymentStatus.replaceAll('_', ' ')}
                        </Badge>
                        {cancelled ? (
                          <Badge tone="red">Cancelled</Badge>
                        ) : (
                          <Badge status={o.deliveryStatus}>
                            {o.deliveryStatus.replaceAll('_', ' ')}
                          </Badge>
                        )}
                      </>
                    }
                    actions={
                      <>
                        {o.confirmationStatus === 'PENDING' && (
                          <CardAction href={`/admin/orders/${o.id}`} variant="success">
                            Confirm
                          </CardAction>
                        )}
                        <CardAction href={`/admin/orders/${o.id}`}>View</CardAction>
                      </>
                    }
                  />
                );
              })}
            </CardList>

            <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th className="w-8">
                    <SelectAllBox
                      checked={sel.allOnPage}
                      indeterminate={sel.someOnPage}
                      onChange={sel.toggleAll}
                    />
                  </Th>
                  {header('Order')}
                  <Th>Reference#</Th>
                  {header('Date')}
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  {header('Total', 'text-right')}
                  <Th className="text-center">Invoiced</Th>
                  <Th className="text-center">Paid</Th>
                  <Th className="text-center">Packed</Th>
                  <Th className="text-center">Shipped</Th>
                  <Th>Payment status</Th>
                  <Th>Fulfillment status</Th>
                  <Th>Items</Th>
                  <Th>Delivery status</Th>
                  <Th>Delivery method</Th>
                  <Th>Tags</Th>
                  <Th>Destination</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow
                    colSpan={19}
                    message={abandoned ? 'No abandoned checkouts' : 'No orders match those filters'}
                  />
                )}
                {rows.map((o) => {
                  const left = hoursLeft(o);
                  const items = o._count?.lines ?? o.lines?.length ?? 0;
                  const dest = o.shippingAddress;
                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-muted/60  ${
                        o.orderStatus === 'CANCELLED' ? 'voided-row' : ''
                      }`}
                    >
                      <Td>
                        <SelectBox
                          checked={sel.isSelected(o.id)}
                          onChange={() => sel.toggle(o.id)}
                        />
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono font-medium text-gold-ink hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                        {o.isDraft && <div className="mt-0.5"><Badge tone="amber">Draft</Badge></div>}
                        {o.sourceInvoice && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            From invoice {o.sourceInvoice.invoiceNumber}
                          </div>
                        )}
                        {o.replacementForId && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {o.isFreeReplacement ? 'Free replacement' : 'Replacement'} for{' '}
                            {o.replacementFor?.orderNumber ?? 'another order'}
                          </div>
                        )}
                        {(o._count?.replacements ?? 0) > 0 && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Replaced ({o._count?.replacements})
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">
                        {o.referenceNumber ?? '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">
                        {o.placedAt ? dateTime(o.placedAt) : dateTime(o.createdAt)}
                      </Td>
                      <Td>
                        <Popover
                          disabled={!o.customer}
                          label={
                            <span className="block">
                              <span className="block whitespace-nowrap text-foreground">
                                {customerName(o)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {o.customer?.phone ?? o.customer?.email ?? '—'}
                              </span>
                            </span>
                          }
                        >
                          <PopoverHead icon="customers">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {customerName(o)}
                              </span>
                              <Badge tone={o.customer?.customerType === 'B2B' ? 'purple' : 'gray'}>
                                {o.customer?.customerType ?? o.orderType}
                              </Badge>
                            </div>
                          </PopoverHead>
                          <PopoverBody>
                            <div className="space-y-2">
                              <PopoverRow icon="orders">
                                <span className="text-sm text-foreground">
                                  {o.customer?.totalOrders ?? 0} order
                                  {(o.customer?.totalOrders ?? 0) === 1 ? '' : 's'}
                                </span>
                              </PopoverRow>
                              {o.customer?.totalSpent && (
                                <PopoverRow icon="rupee">
                                  <span className="text-sm text-foreground">
                                    {money(o.customer.totalSpent)} lifetime
                                  </span>
                                </PopoverRow>
                              )}
                              {dest?.city && (
                                <PopoverRow icon="pin">
                                  <span className="text-sm text-foreground">
                                    {[dest.city, dest.state, dest.pincode]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </span>
                                </PopoverRow>
                              )}
                              <PopoverRow icon="mail">
                                {o.customer?.email ? (
                                  <a
                                    href={`mailto:${o.customer.email}`}
                                    className="block break-all text-sm text-gold-ink hover:underline"
                                  >
                                    {o.customer.email}
                                  </a>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    No email on file
                                  </span>
                                )}
                              </PopoverRow>
                              {o.customer?.phone && (
                                <PopoverRow icon="phone">
                                  <a
                                    href={`tel:${o.customer.phone}`}
                                    className="text-sm text-gold-ink hover:underline"
                                  >
                                    {o.customer.phone}
                                  </a>
                                </PopoverRow>
                              )}
                            </div>
                          </PopoverBody>
                          {o.customer && (
                            <PopoverFoot>
                              <Link href={`/admin/customers/${o.customer.id}`} className="block">
                                <Button size="sm" className="w-full justify-center">
                                  View customer
                                </Button>
                              </Link>
                            </PopoverFoot>
                          )}
                        </Popover>
                      </Td>
                      <Td>
                        <Badge tone={o.orderType === 'B2B' ? 'purple' : 'gray'}>{o.orderType}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-right font-medium">
                        {money(o.grandTotal)}
                        {Number(o.balanceDue) > 0 && (
                          <div className="text-xs font-normal text-warning">
                            {money(o.balanceDue)} due
                          </div>
                        )}
                      </Td>
                      <Td className="text-center">
                        <Dot
                          done={(o._count?.invoices ?? 0) > 0}
                          title={
                            o._count?.invoices
                              ? `${o._count.invoices} invoice(s)`
                              : 'Not invoiced'
                          }
                        />
                      </Td>
                      <Td className="text-center">
                        <Dot
                          done={o.paymentStatus === 'PAID'}
                          title={o.paymentStatus.replaceAll('_', ' ')}
                        />
                      </Td>
                      <Td className="text-center">
                        <Dot
                          done={o.fulfillmentStatus !== 'UNFULFILLED'}
                          title={o.fulfillmentStatus.replaceAll('_', ' ')}
                        />
                      </Td>
                      <Td className="text-center">
                        <Dot
                          done={o.deliveryStatus !== 'NOT_SHIPPED'}
                          title={o.deliveryStatus.replaceAll('_', ' ')}
                        />
                      </Td>
                      <Td>
                        <Badge status={o.paymentStatus}>
                          {o.paymentStatus.replaceAll('_', ' ')}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge status={o.fulfillmentStatus}>
                          {o.fulfillmentStatus.replaceAll('_', ' ')}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">
                        <Popover
                          disabled={!o.lines?.length}
                          label={
                            <span className="text-gold-ink">
                              {items} item{items === 1 ? '' : 's'}
                            </span>
                          }
                        >
                          <PopoverHead icon="box">
                            <div className="flex items-center justify-between gap-2">
                              <Badge status={o.fulfillmentStatus}>
                                {o.fulfillmentStatus.replaceAll('_', ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {money(o.grandTotal)}
                              </span>
                            </div>
                          </PopoverHead>
                          <PopoverBody>
                            <ul className="space-y-2.5">
                              {(o.lines ?? []).map((l) => (
                                <li key={l.id} className="flex items-start gap-2.5">
                                  <Thumb url={l.imageUrl} label={l.name} />
                                  <div className="min-w-0 flex-1">
                                    <Link
                                      href={`/admin/orders/${o.id}`}
                                      className="block truncate text-sm text-gold-ink hover:underline"
                                    >
                                      {l.name}
                                    </Link>
                                    {l.variantTitle && (
                                      <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                        {l.variantTitle}
                                      </span>
                                    )}
                                    {l.sku && (
                                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                                        {l.sku}
                                      </div>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="text-xs text-muted-foreground">
                                      × {l.quantity}
                                    </div>
                                    {l.unitPrice && (
                                      <div className="text-[11px] text-muted-foreground">
                                        {money(l.unitPrice)}
                                      </div>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </PopoverBody>
                          <PopoverFoot>
                            <Link href={`/admin/orders/${o.id}`} className="block">
                              <Button size="sm" className="w-full justify-center">
                                Open order
                              </Button>
                            </Link>
                          </PopoverFoot>
                        </Popover>
                      </Td>
                      <Td>
                        {o.orderStatus === 'CANCELLED' ? (
                          <Badge tone="red">Cancelled</Badge>
                        ) : (
                          <Popover
                            disabled={!o.fulfillments?.length}
                            label={
                              <Badge status={o.deliveryStatus}>
                                {o.deliveryStatus.replaceAll('_', ' ')}
                              </Badge>
                            }
                          >
                            {(o.fulfillments ?? []).map((f) => (
                              <div key={f.id}>
                                <PopoverHead icon="truck">
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge status={f.status}>
                                      {SHIPMENT_STATE[f.status] ?? f.status.replaceAll('_', ' ')}
                                    </Badge>
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {f.fulfillmentNumber}
                                    </span>
                                  </div>
                                </PopoverHead>
                                <PopoverBody>
                                  <div className="space-y-2">
                                    {(f.deliveredAt || f.shippedAt) && (
                                      <PopoverRow icon="clock">
                                        <span className="text-sm text-foreground">
                                          {f.deliveredAt
                                            ? `Delivered ${shortDate(f.deliveredAt)}`
                                            : `Shipped ${shortDate(f.shippedAt as string)}`}
                                        </span>
                                      </PopoverRow>
                                    )}
                                    {f.trackingNumber || f.awbNumber ? (
                                      <PopoverRow icon={f.trackingUrl ? 'external' : 'eway'}>
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                          {f.trackingCompany ?? 'Courier'}
                                        </div>
                                        {f.trackingUrl ? (
                                          <a
                                            href={f.trackingUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="break-all font-mono text-sm text-gold-ink hover:underline"
                                          >
                                            {f.trackingNumber ?? f.awbNumber}
                                          </a>
                                        ) : (
                                          <span className="break-all font-mono text-sm text-foreground">
                                            {f.trackingNumber ?? f.awbNumber}
                                          </span>
                                        )}
                                      </PopoverRow>
                                    ) : (
                                      <PopoverRow icon="alert">
                                        <span className="text-sm text-muted-foreground">
                                          No tracking number on this shipment yet.
                                        </span>
                                      </PopoverRow>
                                    )}
                                  </div>
                                </PopoverBody>
                              </div>
                            ))}
                          </Popover>
                        )}
                        {left !== null && (
                          <div className="mt-0.5 whitespace-nowrap text-xs text-warning">
                            COD: {left}h to confirm
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs">
                        {o.deliveryMethod === 'COD'
                          ? 'Cash on Delivery (COD)'
                          : o.deliveryMethod.replaceAll('_', ' ').toLowerCase()}
                        <div className="text-muted-foreground">{o.paymentMethod}</div>
                      </Td>
                      <Td>
                        {o.tags.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {o.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs">
                        {dest?.city ? (
                          <Popover
                            align="right"
                            label={`${dest.city}${
                              dest.stateCode || dest.state
                                ? ', ' + (dest.stateCode ?? dest.state)
                                : ''
                            }`}
                          >
                            <PopoverHead icon="pin">
                              <span className="text-sm font-medium text-foreground">
                                Shipping address
                              </span>
                            </PopoverHead>
                            <PopoverBody>
                              <address className="not-italic text-sm leading-relaxed text-foreground">
                                {[
                                  [dest.firstName, dest.lastName].filter(Boolean).join(' '),
                                  dest.company,
                                  dest.line1,
                                  dest.line2,
                                  [dest.pincode, dest.city].filter(Boolean).join(' '),
                                  dest.state,
                                  dest.country,
                                ]
                                  .filter(Boolean)
                                  .map((line, i) => (
                                    <span key={i} className="block">
                                      {line}
                                    </span>
                                  ))}
                              </address>
                              {dest.phone && (
                                <PopoverRow icon="phone" className="mt-2">
                                  <a
                                    href={`tel:${dest.phone}`}
                                    className="text-sm text-gold-ink hover:underline"
                                  >
                                    {dest.phone}
                                  </a>
                                </PopoverRow>
                              )}
                            </PopoverBody>
                            <PopoverFoot>
                              <Link href={`/admin/orders/${o.id}`} className="block">
                                <Button size="sm" className="w-full justify-center">
                                  Open order
                                </Button>
                              </Link>
                            </PopoverFoot>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex gap-1.5 whitespace-nowrap">
                          <Link href={`/admin/orders/${o.id}`}>
                            <Button size="sm">View</Button>
                          </Link>
                          {o.confirmationStatus === 'PENDING' && (
                            <Link href={`/admin/orders/${o.id}`}>
                              <Button size="sm" variant="success">Confirm</Button>
                            </Link>
                          )}
                          {!o.isDraft &&
                            o.orderStatus !== 'CANCELLED' &&
                            o.fulfillmentStatus !== 'FULFILLED' && (
                              <Link href={`/admin/orders/${o.id}`}>
                                <Button size="sm" variant="primary">Fulfil</Button>
                              </Link>
                            )}
                          {o.isDraft && (
                            <Link href={`/admin/orders/${o.id}`}>
                              <Button size="sm" variant="primary">Convert</Button>
                            </Link>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            </div>

            {meta && (
              <Pagination
                pageSize={pageSize}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPage={setPage}
              />
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Payment, fulfilment and delivery are three independent axes — an order can be paid but
        unfulfilled, or shipped but unpaid on COD.
      </p>
    </>
  );
}

export default function OrdersPage() {
  return <OrdersView />;
}
