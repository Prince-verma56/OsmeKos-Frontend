'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, money, dateTime, errorMessage } from '@/lib/api';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Loading, PageHeader,
  StatCard, Table, Td, Th,
} from '@/components/ui';
import { Thumb } from '@/components/SearchSelect';
import { PageCrumb } from '@/lib/crumbs';

type Detail = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  reorderPoint: string | null;
  valuationMethod: string;
  trackInventory: boolean;
  stock: { onHand: number; committed: number; unavailable: number; available: number; incoming: number };
  locations: {
    locationId: string;
    onHand: string;
    committed: string;
    unavailable: string;
    incoming: string;
    available: number;
    binLocation: string | null;
    location: { id: string; name: string; code: string };
  }[];
  lots: {
    id: string;
    lotNo: string | null;
    batchNo: string | null;
    expiryDate: string | null;
    quantityRemaining: string;
    unitCost: string;
    receivedAt: string;
  }[];
  imageUrls?: string[];
  imageUrl?: string | null;
  productVariants: {
    id: string;
    title: string;
    sku: string | null;
    price: string;
    imageUrl?: string | null;
    product: { id: string; title: string; handle: string };
  }[];
  recentMovements: {
    id: string;
    movementType: string;
    quantityDelta: string;
    balanceAfter: string;
    reason: string | null;
    occurredAt: string;
  }[];
};

const TONE: Record<string, 'green' | 'red' | 'blue' | 'gray' | 'amber'> = {
  OPENING_STOCK: 'blue',
  PURCHASE_RECEIVE: 'green',
  SALE: 'red',
  RETURN: 'green',
  ADJUSTMENT: 'amber',
  TRANSFER_IN: 'blue',
  TRANSFER_OUT: 'blue',
  RESERVATION: 'gray',
  RELEASE: 'gray',
};

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Detail }>(`/inventory/${id}`);
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

  if (loading) return <Loading />;
  if (!d) return <ErrorBox message={error || 'Item not found'} onRetry={load} />;

  const reorder = d.reorderPoint === null ? null : Number(d.reorderPoint);
  const low = reorder !== null && d.stock.available <= reorder;

  return (
    <>
      <PageCrumb label={d.name} />

      <PageHeader
        title={d.name}
        subtitle={`${d.sku ?? 'no SKU'} · valued ${d.valuationMethod}`}
        actions={
          <>
            <Link href={`/admin/items/${d.id}`}>
              <Button>Edit item</Button>
            </Link>
            <Link href="/admin/inventory/adjustments/new">
              <Button variant="primary">Adjust stock</Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="On hand" value={d.stock.onHand} sub="physically present" />
        <StatCard label="Committed" value={d.stock.committed} tone="amber" sub="reserved by orders" />
        <StatCard label="Unavailable" value={d.stock.unavailable} tone="red" sub="damaged / on hold" />
        <StatCard
          label="Available"
          value={d.stock.available}
          tone={low ? 'red' : 'green'}
          sub={reorder !== null ? `reorder at ${reorder}` : 'sellable'}
        />
        <StatCard label="Incoming" value={d.stock.incoming} tone="purple" sub="on issued POs" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Stock by location" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Location</Th>
                  <Th className="text-right">Unavailable</Th>
                  <Th className="text-right">Committed</Th>
                  <Th className="text-right">Available</Th>
                  <Th className="text-right">On hand</Th>
                  <Th className="text-right">Incoming</Th>
                </tr>
              </thead>
              <tbody>
                {d.locations.length === 0 && <EmptyRow colSpan={6} message="No stock anywhere yet" />}
                {d.locations.map((l) => (
                  <tr key={l.locationId}>
                    <Td>
                      <span className="font-medium text-foreground">
                        {l.location.code}
                      </span>
                      <div className="text-xs text-muted-foreground">{l.location.name}</div>
                    </Td>
                    <Td className="text-right">{Number(l.unavailable)}</Td>
                    <Td className="text-right">{Number(l.committed)}</Td>
                    <Td className="text-right font-medium">{l.available}</Td>
                    <Td className="text-right">{Number(l.onHand)}</Td>
                    <Td className="text-right">{Number(l.incoming)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="px-4 py-2.5 text-xs text-muted-foreground">
              Available = on hand − committed − unavailable, derived at read time so it can never
              drift out of sync.
            </p>
          </Card>

          <Card title="Recent movements" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Movement</Th>
                  <Th className="text-right">Change</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {d.recentMovements.length === 0 && <EmptyRow colSpan={5} message="No movements yet" />}
                {d.recentMovements.map((m) => {
                  const delta = Number(m.quantityDelta);
                  return (
                    <tr key={m.id}>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">
                        {dateTime(m.occurredAt)}
                      </Td>
                      <Td>
                        <Badge tone={TONE[m.movementType] ?? 'gray'}>
                          {m.movementType.replaceAll('_', ' ')}
                        </Badge>
                      </Td>
                      <Td
                        className={`text-right font-medium ${
                          delta > 0
                            ? 'text-success'
                            : 'text-destructive'
                        }`}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </Td>
                      <Td className="text-right">{Number(m.balanceAfter)}</Td>
                      <Td className="text-xs text-muted-foreground">{m.reason ?? '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="px-4 py-2.5">
              <Link
                href={`/admin/items/${d.id}`}
                className="text-xs font-medium text-gold-ink hover:underline"
              >
                View full ledger
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {d.lots.length > 0 && (
            <Card title={`Batches in stock (${d.lots.length})`}>
              <div className="space-y-2">
                {d.lots.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-foreground">
                        {l.batchNo ?? l.lotNo ?? 'Unbatched'}
                      </span>
                      <span>{Number(l.quantityRemaining)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {money(l.unitCost)} / unit
                      {l.expiryDate && ` · expires ${dateTime(l.expiryDate).split(',')[0]}`}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Consumed oldest-expiry first under FIFO.
              </p>
            </Card>
          )}

          {d.productVariants.length > 0 && (
            <Card title="Sold as">
              <div className="space-y-2 text-sm">
                {d.productVariants.map((v) => (
                  <div key={v.id} className="flex items-start gap-2.5">
                    <Thumb url={v.imageUrl} label={v.product.title} />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${v.product.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {v.product.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {v.title} · {money(v.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {d.productVariants.length === 0 && (
            <Card title="Sold as">
              <p className="text-sm text-muted-foreground">
                No product variant is linked to this item, so it is warehouse-only stock.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
