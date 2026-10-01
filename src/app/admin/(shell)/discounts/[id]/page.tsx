'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, money, shortDate, dateTime, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ConfirmModal } from '@/components/Modal';
import { Thumb } from '@/components/SearchSelect';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Loading,
  PageHeader, StatCard, Table, Td, Th,
} from '@/components/ui';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
type AppliesTo = 'ALL' | 'PRODUCTS' | 'COLLECTIONS' | 'VARIANTS' | 'ITEMS';

const TARGET_NOUN: Record<Exclude<AppliesTo, 'ALL'>, string> = {
  PRODUCTS: 'product',
  COLLECTIONS: 'collection',
  VARIANTS: 'variant',
  ITEMS: 'item',
};
type Eligibility = 'ALL' | 'D2C_ONLY' | 'B2B_ONLY' | 'SPECIFIC';

type Detail = {
  id: string;
  code: string | null;
  title: string;
  isAutomatic: boolean;
  type: DiscountType;
  value: string;
  appliesTo: AppliesTo;
  minimumSubtotal: string | null;
  minimumQuantity: number | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  customerEligibility: Eligibility;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  isScheduled: boolean;
  isExhausted: boolean;
  createdAt: string;
  targets: {
    products: { id: string; title: string; media?: { url: string }[] }[];
    collections: { id: string; title: string }[];
    variants?: { id: string; title: string; sku: string | null; imageUrl: string | null; product: { id: string; title: string } }[];
    items?: { id: string; name: string; sku: string | null; imageUrls?: string[] }[];
  };
  eligibleCustomers: {
    id: string;
    displayName: string | null;
    email: string | null;
    customerType: string;
  }[];
  orders: {
    id: string;
    orderNumber: string;
    placedAt: string | null;
    createdAt: string;
    orderType: string;
    orderStatus: string;
    isDraft: boolean;
    discountTotal: string;
    grandTotal: string;
    customer: { id: string; displayName: string | null } | null;
  }[];
  usage: {
    orders: number;
    liveOrders: number;
    draftOrders: number;
    cancelledOrders: number;
    abandonedCarts: number;
    discountGiven: number;
    revenue: number;
    averageOrder: number;
  };
};

const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  ALL: 'Everyone',
  D2C_ONLY: 'D2C customers only',
  B2B_ONLY: 'B2B customers only',
  SPECIFIC: 'Chosen customers',
};

function offer(d: Detail) {
  const n = Number(d.value);
  if (d.type === 'PERCENTAGE') return `${n}% off`;
  if (d.type === 'FIXED_AMOUNT') return `${money(n)} off`;
  if (d.type === 'FREE_SHIPPING') return 'Free shipping';
  return `Buy ${n} get 1`;
}

function state(d: Detail): { label: string; tone: 'green' | 'gray' | 'amber' | 'red' | 'blue'; why: string } {
  if (!d.isActive) return { label: 'Switched off', tone: 'gray', why: 'It will not apply to anything until it is switched back on.' };
  if (d.isExpired) return { label: 'Expired', tone: 'red', why: `It stopped on ${shortDate(d.endsAt)}.` };
  if (d.isScheduled) return { label: 'Scheduled', tone: 'blue', why: `It starts on ${shortDate(d.startsAt)}.` };
  if (d.isExhausted) return { label: 'Used up', tone: 'amber', why: `Its limit of ${d.usageLimit} uses has been reached.` };
  return { label: 'Live', tone: 'green', why: 'It applies to any order that clears its rules.' };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm text-foreground">{children}</span>
    </div>
  );
}

export default function DiscountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<{ data: Detail }>(`/sales/discounts/${id}`);
      setD(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function toggleActive() {
    if (!d) return;
    setBusy(true);
    try {
      await api.patch(`/sales/discounts/${id}`, { isActive: !d.isActive });
      toast.success(d.isActive ? 'Switched off' : 'Switched on');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!d) return;
    setBusy(true);
    try {
      await api.del(`/sales/discounts/${id}`);
      toast.success(`${d.code ?? d.title} deleted`);
      router.push('/admin/discounts');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      setConfirming(false);
    }
  }

  if (loading) return <Loading label="Loading discount…" />;
  if (error && !d) return <ErrorBox message={error} onRetry={load} />;
  if (!d) return null;

  const s = state(d);
  const u = d.usage;
  const targetRows: { id: string; label: string; href: string; imageUrl?: string | null }[] =
    d.appliesTo === 'PRODUCTS'
      ? d.targets.products.map((p) => ({ id: p.id, label: p.title, href: `/admin/products/${p.id}`, imageUrl: p.media?.[0]?.url }))
      : d.appliesTo === 'COLLECTIONS'
        ? d.targets.collections.map((c) => ({ id: c.id, label: c.title, href: `/admin/collections/${c.id}` }))
        : d.appliesTo === 'VARIANTS'
          ? (d.targets.variants ?? []).map((v) => ({
              id: v.id,
              label: `${v.product.title} - ${v.title}`,
              href: `/admin/products/${v.product.id}/variants/${v.id}`,
              imageUrl: v.imageUrl,
            }))
          : (d.targets.items ?? []).map((i) => ({ id: i.id, label: i.name, href: `/admin/items/${i.id}`, imageUrl: i.imageUrls?.[0] }));
  const limitLeft = d.usageLimit != null ? Math.max(d.usageLimit - d.usedCount, 0) : null;

  return (
    <>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin/discounts" className="hover:underline">
          Discounts
        </Link>
        <span>/</span>
        <span className="text-foreground">{d.code ?? d.title}</span>
      </div>

      <PageHeader
        title={d.code ?? d.title}
        subtitle={d.code ? d.title : 'Applies automatically — no code to type'}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={s.tone}>{s.label}</Badge>
            <Button disabled={busy} onClick={toggleActive}>
              {d.isActive ? 'Switch off' : 'Switch on'}
            </Button>
            <Link href={`/admin/discounts?edit=${d.id}`}>
              <Button variant="primary">Edit</Button>
            </Link>
            <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Times used"
          value={d.usedCount}
          sub={limitLeft === null ? 'no limit' : `${limitLeft} of ${d.usageLimit} left`}
        />
        <StatCard
          label="Given away"
          value={money(u.discountGiven)}
          tone="amber"
          sub="on placed orders only"
        />
        <StatCard label="Revenue it brought" value={money(u.revenue)} tone="green" />
        <StatCard
          label="Average order"
          value={money(u.averageOrder)}
          tone="purple"
          sub={u.liveOrders ? `over ${u.liveOrders} order${u.liveOrders === 1 ? '' : 's'}` : 'nothing yet'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title={`Orders that used this (${d.orders.length})`} padded={false}>
            <Table minWidth="640px">
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Taken off</Th>
                  <Th className="text-right">Order total</Th>
                </tr>
              </thead>
              <tbody>
                {d.orders.length === 0 && (
                  <EmptyRow
                    colSpan={6}
                    message="Nobody has used this yet"
                  />
                )}
                {d.orders.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {shortDate(o.placedAt ?? o.createdAt)}
                    </Td>
                    <Td className="text-xs">{o.customer?.displayName ?? 'Guest'}</Td>
                    <Td>
                      <Badge status={o.isDraft ? 'DRAFT' : o.orderStatus}>
                        {o.isDraft ? 'DRAFT' : o.orderStatus}
                      </Badge>
                    </Td>
                    <Td className="text-right">{money(o.discountTotal)}</Td>
                    <Td className="text-right">{money(o.grandTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {u.draftOrders > 0 && (
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                {u.draftOrders} of these {u.draftOrders === 1 ? 'is a draft' : 'are drafts'}, so
                {u.draftOrders === 1 ? ' it has' : ' they have'} not spent a use and
                {u.draftOrders === 1 ? ' is' : ' are'} left out of the figures above. A draft only
                counts once it becomes a real order.
              </p>
            )}
            {u.cancelledOrders > 0 && (
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                {u.cancelledOrders} of these {u.cancelledOrders === 1 ? 'was' : 'were'} cancelled and
                {u.cancelledOrders === 1 ? ' is' : ' are'} left out of the figures above — the money
                never arrived, so counting it would flatter the code.
              </p>
            )}
          </Card>

          {d.appliesTo !== 'ALL' && (
            <Card title={`Only these ${TARGET_NOUN[d.appliesTo]}s (${targetRows.length})`} padded={false}>
              <ul className="divide-y divide-border">
                {targetRows.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 px-4 py-2">
                    {d.appliesTo !== 'COLLECTIONS' && <Thumb url={t.imageUrl ?? undefined} label={t.label} />}
                    <Link href={t.href} className="text-sm text-gold-ink hover:underline">
                      {t.label}
                    </Link>
                  </li>
                ))}
                {targetRows.length === 0 && (
                  <li className="px-4 py-4 text-sm text-warning">
                    Nothing is selected, so this code qualifies for nothing and will always be
                    refused. Edit it to pick what it covers.
                  </li>
                )}
              </ul>
            </Card>
          )}

          {d.customerEligibility === 'SPECIFIC' && (
            <Card title={`Only these customers (${d.eligibleCustomers.length})`} padded={false}>
              <ul className="divide-y divide-border">
                {d.eligibleCustomers.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="text-sm text-gold-ink hover:underline"
                    >
                      {c.displayName ?? c.email}
                    </Link>
                    <Badge tone="gray">{c.customerType}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="The offer">
            <div className="divide-y divide-border">
              <Row label="Gives">{offer(d)}</Row>
              <Row label="Triggered by">
                {d.isAutomatic ? (
                  <Badge tone="blue">automatically</Badge>
                ) : (
                  <span className="font-mono">{d.code}</span>
                )}
              </Row>
              <Row label="Applies to">
                {d.appliesTo === 'ALL'
                  ? 'Everything in the catalogue'
                  : `${targetRows.length} ${TARGET_NOUN[d.appliesTo]}${targetRows.length === 1 ? '' : 's'}`}
              </Row>
              <Row label="Who can use it">
                {d.customerEligibility === 'SPECIFIC'
                  ? `${d.eligibleCustomers.length} customer${d.eligibleCustomers.length === 1 ? '' : 's'}`
                  : ELIGIBILITY_LABEL[d.customerEligibility]}
              </Row>
            </div>
          </Card>

          <Card title="Conditions">
            <div className="divide-y divide-border">
              <Row label="Minimum subtotal">
                {d.minimumSubtotal ? money(d.minimumSubtotal) : 'Any'}
              </Row>
              <Row label="Minimum quantity">{d.minimumQuantity ?? 'Any'}</Row>
              <Row label="Total uses">
                {d.usageLimit == null ? 'Unlimited' : `${d.usedCount} of ${d.usageLimit}`}
              </Row>
              <Row label="Uses per customer">{d.usageLimitPerCustomer ?? 'Unlimited'}</Row>
              <Row label="Runs from">{shortDate(d.startsAt)}</Row>
              <Row label="Runs until">
                {d.endsAt ? shortDate(d.endsAt) : 'No end date'}
              </Row>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Every condition has to clear for the discount to land. A code that reads as live here
              can still be refused for a basket or a customer that does not qualify.
            </p>
          </Card>

          <Card title="Status">
            <div className="divide-y divide-border">
              <Row label="Right now">
                <Badge tone={s.tone}>{s.label}</Badge>
              </Row>
              <Row label="Created">{dateTime(d.createdAt)}</Row>
              {u.abandonedCarts > 0 && (
                <Row label="Abandoned carts">
                  {u.abandonedCarts} still holding it
                </Row>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{s.why}</p>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        busy={busy}
        title="Delete this discount?"
        confirmLabel="Delete"
        message={
          <>
            <span className="font-mono">{d.code ?? d.title}</span> has been used {d.usedCount} time
            {d.usedCount === 1 ? '' : 's'}. The {d.orders.length} order
            {d.orders.length === 1 ? '' : 's'} that used it keep the discount they were given — only
            the code stops working.
          </>
        }
      />
    </>
  );
}
