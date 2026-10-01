'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, Table, Td, Th,
} from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';
import { Thumb } from '@/components/SearchSelect';
import { sizeLabel } from '@/lib/items';

import { CardList, RecordCard } from '@/components/CardList';
type Item = {
  id: string;
  name: string;
  sku: string | null;
  type: 'GOODS' | 'SERVICE';
  itemCategory: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOOD' | 'CONSUMABLE';
  unit: string;
  hsnCode: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  sellingPrice: string | null;
  costPrice: string | null;
  mrp?: string | null;
  reorderPoint: string | null;
  trackInventory: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  stock: { onHand: number; committed: number; available: number; incoming: number; locationCount: number };
  imageUrls?: string[];
  itemKind?: { id: string; name: string } | null;
  parentItemId?: string | null;
  _count?: { childItems: number };
};

const CATEGORY_LABEL: Record<string, string> = {
  RAW_MATERIAL: 'Raw material',
  PACKAGING: 'Packaging',
  FINISHED_GOOD: 'Finished good',
  CONSUMABLE: 'Consumable',
};

export default function ItemsPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Paged<Item>['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [type, setType] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [children, setChildren] = useState<Record<string, Item[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Item>>('/items', {
        page,
        limit: pageSize,
        search: search || undefined,
        itemCategory: itemCategory || undefined,
        type: type || undefined,
        lowStock: lowStock ? 'true' : undefined,
        topLevelOnly: 'true',
      });
      setRows(res.data);
      setMeta(res.meta);
      setOpenRows({});
      setChildren({});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, itemCategory, type, lowStock, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function exportSpec() {
    const columns: Column<Item>[] = [
      { header: 'Item', value: (r) => r.name, width: 180 },
      { header: 'SKU', value: (r) => r.sku ?? '' },
      { header: 'Size', value: (r) => sizeLabel(r) ?? '' },
      { header: 'Type', value: (r) => r.type },
      { header: 'Category', value: (r) => r.itemCategory },
      { header: 'Unit', value: (r) => r.unit },
      { header: 'HSN', value: (r) => r.hsnCode ?? '' },
      { header: 'Selling price', value: (r) => Number(r.sellingPrice ?? 0), money: true },
      { header: 'Cost price', value: (r) => Number(r.costPrice ?? 0), money: true },
      { header: 'On hand', value: (r) => r.stock.onHand, align: 'right' as const },
      { header: 'Committed', value: (r) => r.stock.committed, align: 'right' as const },
      { header: 'Available', value: (r) => r.stock.available, align: 'right' as const },
      { header: 'Incoming', value: (r) => r.stock.incoming, align: 'right' as const },
      { header: 'Reorder at', value: (r) => Number(r.reorderPoint ?? 0), align: 'right' as const },
      { header: 'Status', value: (r) => r.status },
    ];
    return {
      title: 'Items',
      subtitle: `${sel.count || rows.length} item(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Available is on hand less committed and unavailable — it is never stored, always ' +
        'derived, so it cannot drift from its parts.',
      orientation: 'landscape' as const,
    };
  }

  const toggleChildren = async (i: Item) => {
    const open = !openRows[i.id];
    setOpenRows((o) => ({ ...o, [i.id]: open }));
    if (!open || children[i.id]) return;
    try {
      const res = await api.get<Paged<Item>>('/items', { parentItemId: i.id, limit: 100 });
      setChildren((c) => ({ ...c, [i.id]: res.data }));
    } catch {
      setChildren((c) => ({ ...c, [i.id]: [] }));
    }
  };

  const itemRow = (i: Item, nested = false) => {
                  const reorder = i.reorderPoint === null ? null : Number(i.reorderPoint);
                  const low = reorder !== null && i.stock.available <= reorder;
                  return (
                    <tr key={i.id} className={nested ? 'bg-muted/30 hover:bg-muted/50' : 'hover:bg-muted/60'}>
                      <Td>
                        {!nested && <SelectBox checked={sel.isSelected(i.id)} onChange={() => sel.toggle(i.id)} />}
                      </Td>
                      <Td>
                        <div className={`flex min-w-56 items-center gap-2.5 ${nested ? 'pl-6' : ''}`}>
                          {(i._count?.childItems ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleChildren(i)}
                              aria-expanded={!!openRows[i.id]}
                              aria-label={openRows[i.id] ? `Hide what is under ${i.name}` : `Show what is under ${i.name}`}
                              className="-ml-1 shrink-0 rounded px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {openRows[i.id] ? '▾' : '▸'}
                            </button>
                          ) : (
                            !nested && <span className="w-3 shrink-0" aria-hidden />
                          )}
                          <Thumb url={i.imageUrls?.[0]} label={i.name} />
                          <Link
                            href={`/admin/items/${i.id}`}
                            className="min-w-0 font-medium text-gold-ink hover:underline"
                          >
                            {i.name}
                          </Link>
                          {(i._count?.childItems ?? 0) > 0 && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {i._count?.childItems} under it
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-xs">{i.sku ?? '—'}</Td>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">{sizeLabel(i) ?? '—'}</Td>
                      <Td>
                        <Badge tone={i.type === 'SERVICE' ? 'blue' : 'gray'}>
                          {i.type === 'SERVICE' ? 'Service' : CATEGORY_LABEL[i.itemCategory]}
                        </Badge>
                      </Td>
                      <Td>{i.unit}</Td>
                      <Td className="text-right">
                        {i.trackInventory ? (
                          i.stock.onHand
                        ) : (
                          <span className="text-xs text-muted-foreground">not tracked</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {i.trackInventory ? (
                          <span className={low ? 'font-medium text-destructive' : ''}>
                            {i.stock.available}
                          </span>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="text-right text-muted-foreground">
                        {reorder ?? '—'}
                      </Td>
                      <Td className="text-right">{i.mrp ? money(i.mrp) : '—'}</Td>
                      <Td className="text-right">{i.sellingPrice ? money(i.sellingPrice) : '—'}</Td>
                      <Td className="text-right">{i.costPrice ? money(i.costPrice) : '—'}</Td>
                      <Td>
                        <Badge status={i.status}>{i.status}</Badge>
                      </Td>
                    </tr>
                  );
  };

  return (
    <>
      <PageHeader
        title="Items"
        subtitle="Every stock-keeping entity: raw materials, packaging and finished goods"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/items/new">
    <Button variant="primary">+ New item</Button>
  </Link>
          </div>
        }
      />

      <BulkBar
        count={sel.count}
        noun="item"
        endpoint="/items/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            placeholder="Search by name, SKU or HSN…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={itemCategory}
            onChange={(e) => {
              setItemCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Goods &amp; services</option>
            <option value="GOODS">Goods</option>
            <option value="SERVICE">Services</option>
          </Select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(e) => {
                setLowStock(e.target.checked);
                setPage(1);
              }}
              className="rounded border-border"
            />
            Low stock only
          </label>
          {(search || itemCategory || type || lowStock) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setItemCategory('');
                setType('');
                setLowStock(false);
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
            <CardList empty="No items match those filters">
              {rows.map((i) => {
                const reorder = i.reorderPoint === null ? null : Number(i.reorderPoint);
                const low = reorder !== null && i.stock.available <= reorder;
                return (
                  <RecordCard
                    key={i.id}
                    href={`/admin/items/${i.id}`}
                    mono={false}
                    title={i.name}
                    amount={i.sellingPrice ? money(i.sellingPrice) : undefined}
                    date={i.sku ?? undefined}
                    primary={
                      i.trackInventory ? (
                        <span className={low ? 'font-medium text-destructive' : ''}>
                          {i.stock.available} available
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not tracked</span>
                      )
                    }
                    secondary={
                      [
                        sizeLabel(i),
                        i.trackInventory
                          ? `${i.stock.onHand} on hand · ${i.unit}${
                              reorder !== null ? ` · reorder at ${reorder}` : ''
                            }`
                          : i.unit,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                    footer={i.costPrice ? `Cost ${money(i.costPrice)}` : undefined}
                    thumb={<Thumb url={i.imageUrls?.[0]} label={i.name} />}
                    select={
                      <SelectBox checked={sel.isSelected(i.id)} onChange={() => sel.toggle(i.id)} />
                    }
                    badges={
                      <>
                        <Badge tone={i.type === 'SERVICE' ? 'blue' : 'gray'}>
                          {i.type === 'SERVICE' ? 'Service' : CATEGORY_LABEL[i.itemCategory]}
                        </Badge>
                        <Badge status={i.status}>{i.status}</Badge>
                        {low && <Badge tone="red">Low stock</Badge>}
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
                  <Th>Item</Th>
                  <Th>SKU</Th>
                  <Th>Size</Th>
                  <Th>Category</Th>
                  <Th>Unit</Th>
                  <Th className="text-right">Stock on hand</Th>
                  <Th className="text-right">Available</Th>
                  <Th className="text-right">Reorder point</Th>
                  <Th className="text-right">MRP</Th>
                  <Th className="text-right">Selling price</Th>
                  <Th className="text-right">Cost</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={13} message="No items match those filters" />}
                {rows.map((i) => (
                  <Fragment key={i.id}>
                    {itemRow(i)}
                    {openRows[i.id] && (children[i.id] ?? []).map((c) => itemRow(c, true))}
                  </Fragment>
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
