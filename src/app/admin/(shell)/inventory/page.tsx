'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import { Thumb } from '@/components/SearchSelect';

import { CardList, RecordCard } from '@/components/CardList';
type Variant = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  imageUrl: string | null;
  productId: string;
  productTitle: string;
  productSku: string | null;
  productStatus: string;
  packSize?: number;
};

type Row = {
  rowId: string;
  variant: Variant | null;
  packsAvailable?: number | null;
  sharesStockWith: number;
  needsItemLink?: boolean;
  isBundle?: boolean;
  components?: { componentVariantId: string; productTitle: string; title: string; quantity: number; available: number | null; canMake: number | null }[];
  id: string | null;
  name: string;
  sku: string | null;
  unit: string;
  itemCategory: string;
  reorderPoint: string | null;
  onHand: number;
  committed: number;
  unavailable: number;
  pendingQc?: number;
  toLabel?: number;
  available: number;
  incoming: number;
  imageUrls?: string[];
  imageUrl?: string | null;
  isLowStock: boolean;
  isOutOfStock: boolean;
  locations: { locationId: string; available: number; location: { code: string } }[];
};

type Meta = Paged<Row>['meta'] & {
  totals: {
    totalItems: number;
    totalUnits: number;
    unavailable: number;
    committed: number;
    available: number;
    incoming: number;
  };
};

type Location = { id: string; name: string; code: string };

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const params = useSearchParams();
  const [stockStatus, setStockStatus] = useState(() => {
    const asked = params.get('stock') ?? '';
    return asked === 'low_stock' || asked === 'out_of_stock' ? asked : '';
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    api
      .get<Paged<Location>>('/locations', { limit: 50 })
      .then((r) => setLocations(r.data))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Row>>('/inventory', {
        page,
        limit: pageSize,
        search: search || undefined,
        locationId: locationId || undefined,
        stockStatus: stockStatus || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, locationId, stockStatus, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = meta?.totals;

  function exportSpec() {
    const columns: Column<Row>[] = [
      { header: 'Variant', value: (r) => r.variant?.title ?? r.name, width: 180 },
      { header: 'Product', value: (r) => r.variant?.productTitle ?? '', width: 150 },
      { header: 'SKU', value: (r) => r.sku ?? r.variant?.sku ?? '' },
      { header: 'Unit', value: (r) => r.unit },
      { header: 'Category', value: (r) => r.itemCategory },
      { header: 'On hand', value: (r) => r.onHand, align: 'right' as const },
      { header: 'Committed', value: (r) => r.committed, align: 'right' as const },
      { header: 'Unavailable', value: (r) => r.unavailable, align: 'right' as const },
      { header: 'Available', value: (r) => r.available, align: 'right' as const },
      { header: 'Incoming', value: (r) => r.incoming, align: 'right' as const },
      { header: 'Reorder at', value: (r) => Number(r.reorderPoint ?? 0), align: 'right' as const },
      { header: 'Locations', value: (r) => r.locations.map((l) => l.location.code).join(', ') },
      {
        header: 'Flag',
        value: (r) => (r.isOutOfStock ? 'Out of stock' : r.isLowStock ? 'Low' : ''),
      },
    ];
    return {
      title: 'Inventory',
      subtitle: `${rows.length} variant(s) as at export`,
      columns,
      rows,
      footnote:
        'Available is on hand less committed and unavailable, computed at read time rather than ' +
        'stored, so it can never drift from its parts. Variants that share an item share its stock.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every sellable variant, with the stock of the item behind it"
        actions={
          <>
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            <Link href="/admin/inventory/adjustments">
              <Button>Adjustments</Button>
            </Link>
            <Link href="/admin/inventory/adjustments/new">
              <Button variant="primary">+ New adjustment</Button>
            </Link>
          </>
        }
      />

      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Items tracked" value={totals.totalItems} />
          <StatCard label="Total units" value={totals.totalUnits} tone="blue" />
          <StatCard label="Committed" value={totals.committed} tone="amber" />
          <StatCard label="Available" value={totals.available} tone="green" />
          <StatCard label="Incoming" value={totals.incoming} tone="purple" />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search by item name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code}
              </option>
            ))}
          </Select>
          <Select
            value={stockStatus}
            onChange={(e) => {
              setStockStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any stock level</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
          </Select>
          {(search || locationId || stockStatus) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setLocationId('');
                setStockStatus('');
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
            <CardList empty="Nothing matches those filters">
              {rows.map((r) => (
                <RecordCard
                  key={r.rowId}
                  mono={false}
                  href={
                    r.variant
                      ? `/products/${r.variant.productId}/variants/${r.variant.id}`
                      : r.id
                        ? `/inventory/${r.id}`
                        : undefined
                  }
                  title={r.variant?.productTitle ?? r.name ?? 'Untitled'}
                  amount={
                    r.isOutOfStock ? (
                      <span className="text-destructive">Out of stock</span>
                    ) : (
                      <span className={r.isLowStock ? 'text-warning' : ''}>
                        {r.packsAvailable != null
                          ? `${r.packsAvailable} packs (${r.available} singles)`
                          : `${r.available} avail.`}
                      </span>
                    )
                  }
                  date={r.variant?.title ?? undefined}
                  primary={
                    r.isBundle ? (
                      <span>Combo · {r.available} can be packed</span>
                    ) : r.needsItemLink || !r.id ? (
                      <span className="text-warning">
                        No stock item — link one
                      </span>
                    ) : (
                      r.name
                    )
                  }
                  secondary={
                    <span className="font-mono">{r.variant?.sku ?? r.sku ?? '—'}</span>
                  }
                  alert={
                    r.sharesStockWith > 0
                      ? `Shares stock with ${r.sharesStockWith} other variant${
                          r.sharesStockWith === 1 ? '' : 's'
                        }`
                      : undefined
                  }
                  footer={r.isBundle ? (r.components ?? []).map((c) => `${c.productTitle} ×${c.quantity}: ${c.available ?? '—'}`).join(' · ') : [
                    `${r.onHand} on hand`,
                    r.committed > 0 ? `${r.committed} committed` : null,
                    r.unavailable > 0 ? `${r.unavailable} unavailable${r.pendingQc ? ` (${r.pendingQc} waiting for QC)` : ''}${r.toLabel ? ` (${r.toLabel} to label)` : ''}` : null,
                    r.incoming > 0 ? `${r.incoming} incoming` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  thumb={
                    <Thumb
                      url={r.imageUrl ?? r.imageUrls?.[0]}
                      label={r.variant?.productTitle ?? r.name ?? '?'}
                    />
                  }
                  badges={
                    r.locations.length > 0 ? (
                      <>
                        {r.locations.map((l) => (
                          <Badge key={l.locationId}>
                            {l.location.code} {l.available}
                          </Badge>
                        ))}
                      </>
                    ) : undefined
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Product / variant</Th>
                  <Th>SKU</Th>
                  <Th>Stock item</Th>
                  <Th className="text-right">Unavailable</Th>
                  <Th className="text-right">Committed</Th>
                  <Th className="text-right">Available</Th>
                  <Th className="text-right">On hand</Th>
                  <Th className="text-right">Incoming</Th>
                  <Th>Locations</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={9} message="Nothing matches those filters" />}
                {rows.map((r) => (
                  <tr key={r.rowId} className="hover:bg-muted/60">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Thumb
                          url={r.imageUrl ?? r.imageUrls?.[0]}
                          label={r.variant?.productTitle ?? r.name ?? '?'}
                        />
                        <div className="min-w-36">
                          {r.variant ? (
                            <>
                              <Link
                                href={`/admin/products/${r.variant.productId}/variants/${r.variant.id}`}
                                className="font-medium text-gold-ink hover:underline"
                              >
                                {r.variant.productTitle}
                              </Link>
                              <div className="truncate text-xs text-muted-foreground">
                                {r.variant.title}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Not sold as a product
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {r.variant?.sku ?? r.sku ?? '—'}
                      {r.variant?.productSku && (
                        <div className="text-muted-foreground">
                          product {r.variant.productSku}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {r.isBundle ? (
                        <div className="min-w-0">
                          <Link href={`/admin/products/${r.variant?.productId ?? ''}?tab=combo`} className="text-gold-ink hover:underline">
                            Combo — packed from
                          </Link>
                          <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                            {(r.components ?? []).length === 0 && <li className="text-warning">Nothing inside yet</li>}
                            {(r.components ?? []).map((c) => (
                              <li key={c.componentVariantId}>
                                {c.productTitle}
                                {c.title && c.title !== 'Default' ? ` (${c.title})` : ''} ×{c.quantity}
                                <span className="tabular-nums"> · {c.available ?? '—'} in stock</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : r.needsItemLink || !r.id ? (
                        <Link
                          href={`/admin/products/${r.variant?.productId ?? ''}`}
                          className="text-warning hover:underline"
                        >
                          No stock item — link one
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2.5">
                          <Thumb url={r.imageUrls?.[0]} label={r.name ?? '?'} />
                          <div className="min-w-36">
                            <Link
                              href={`/admin/inventory/${r.id}`}
                              className="text-gold-ink hover:underline"
                            >
                              {r.name}
                            </Link>
                            <div className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                              {r.sku ?? '—'}
                            </div>
                            {r.sharesStockWith > 0 && (
                              <div className="text-xs text-warning">
                                shared with {r.sharesStockWith} other variant
                                {r.sharesStockWith === 1 ? '' : 's'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Td>
                    <Td className="text-right">
                      {r.isBundle ? '—' : r.unavailable > 0 ? (
                        <span className="inline-flex flex-col items-end">
                          <span className="font-medium text-destructive">{r.unavailable}</span>
                          {r.pendingQc ? (
                            <span className="whitespace-nowrap text-xs text-warning">{r.pendingQc} waiting for QC</span>
                          ) : null}
                          {r.toLabel ? (
                            <span className="whitespace-nowrap text-xs text-warning">{r.toLabel} to label</span>
                          ) : null}
                        </span>
                      ) : (
                        0
                      )}
                    </Td>
                    <Td className="text-right">
                      {r.isBundle ? '—' : r.committed > 0 ? (
                        <span className="font-medium text-warning">
                          {r.committed}
                        </span>
                      ) : (
                        0
                      )}
                    </Td>
                    <Td className="text-right font-medium">
                      {r.isOutOfStock ? (
                        <Badge tone="red">Out of stock</Badge>
                      ) : r.isLowStock ? (
                        <span className="text-warning">{r.available}</span>
                      ) : (
                        r.available
                      )}
                      {r.packsAvailable != null && !r.isOutOfStock && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          = {r.packsAvailable} pack{r.packsAvailable === 1 ? '' : 's'} of {r.variant?.packSize}
                        </div>
                      )}
                    </Td>
                    <Td className="text-right">{r.isBundle ? '—' : r.onHand}</Td>
                    <Td className="text-right">{r.isBundle ? '—' : r.incoming || '—'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {r.locations.map((l) => (
                          <Badge key={l.locationId}>
                            {l.location.code} {l.available}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                  </tr>
                ))}
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
    </>
  );
}
