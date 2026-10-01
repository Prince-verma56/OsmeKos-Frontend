'use client';

import { productStatusLabel } from '@/lib/labels';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, type Paged } from '@/lib/api';
import { categoryLabel, sortForPicker } from '@/lib/categories';
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

import { CardList, RecordCard } from '@/components/CardList';
type Category = { id: string; name: string; parentId: string | null; path: string | null };

type Product = {
  id: string;
  title: string;
  handle: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  productType: string | null;
  brand: string | null;
  tags: string[];
  hasVariants: boolean;
  trackInventory: boolean;
  updatedAt: string;
  category: { id: string; name: string } | null;
  variantCount: number;
  priceMin: number | null;
  priceMax: number | null;
  mrpMin?: number | null;
  mrpMax?: number | null;
  offMrpMin?: number | null;
  offMrpMax?: number | null;
  collections: { id: string; title: string }[];
  media?: { url: string }[];
};

type Meta = Paged<Product>['meta'] & {
  counts: { ALL: number; ACTIVE: number; DRAFT: number; ARCHIVED: number };
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Ready to sell' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ARCHIVED', label: 'Archived' },
] as const;

function mrpLabel(p: Product) {
  if (p.mrpMin == null || p.mrpMax == null) return '—';
  if (p.mrpMin === p.mrpMax) return money(p.mrpMin);
  return `${money(p.mrpMin)} – ${money(p.mrpMax)}`;
}

function offMrpLabel(p: Product) {
  if (p.offMrpMin == null || p.offMrpMax == null) return null;
  const one = (n: number) => (n < 0 ? `${-n}% above` : n === 0 ? 'at MRP' : `${n}%`);
  const text = p.offMrpMin === p.offMrpMax ? one(p.offMrpMin) : `${one(p.offMrpMin)} – ${one(p.offMrpMax)}`;
  return { text, above: p.offMrpMin < 0 };
}

function priceLabel(p: Product) {
  if (p.priceMin === null) return '—';
  if (p.priceMin === p.priceMax) return money(p.priceMin);
  return `${money(p.priceMin)} – ${money(p.priceMax)}`;
}

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [productType, setProductType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [facets, setFacets] = useState<{ productTypes: string[]; brands: string[] }>({
    productTypes: [],
    brands: [],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Product>>('/products', {
        page,
        limit: pageSize,
        status: status || undefined,
        kind: 'STANDARD',
        search: search || undefined,
        productType: productType || undefined,
        categoryId: categoryId || undefined,
        brand: brand || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, status, search, productType, categoryId, brand, pageSize]);

  useEffect(() => {
    api
      .get<{ data: Category[] }>('/categories')
      .then((r) => setCategories(r.data))
      .catch(() => {});
    api
      .get<{ data: { productTypes: string[]; brands: string[] } }>('/products/facets')
      .then((r) => setFacets(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const counts = meta?.counts;

  function exportSpec() {
    const columns: Column<Product>[] = [
      { header: 'Product', value: (r) => r.title, width: 180 },
      { header: 'Handle', value: (r) => r.handle },
      { header: 'Status', value: (r) => productStatusLabel(r.status) },
      { header: 'Brand', value: (r) => r.brand ?? '' },
      { header: 'Type', value: (r) => r.productType ?? '' },
      { header: 'Category', value: (r) => r.category?.name ?? '' },
      { header: 'Collections', value: (r) => r.collections.map((c) => c.title).join(', ') },
      { header: 'Variants', value: (r) => r.variantCount, align: 'right' as const },
      { header: 'Price from', value: (r) => r.priceMin ?? 0, money: true },
      { header: 'Price to', value: (r) => r.priceMax ?? 0, money: true },
    ];
    return {
      title: 'Products',
      subtitle: `${sel.count || rows.length} product(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'A product is the storefront listing. Stock lives against items, not products, so ' +
        'quantities are on the Items and Inventory reports instead.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage products, variants and collections"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/products/new">
    <Button variant="primary">+ Add product</Button>
  </Link>
          </div>
        }
      />

      <BulkBar
        count={sel.count}
        noun="product"
        endpoint="/products/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex gap-5 border-b border-border px-4">
          {TABS.map((t) => {
            const n = counts
              ? t.key === ''
                ? counts.ALL
                : counts[t.key as 'ACTIVE' | 'DRAFT' | 'ARCHIVED']
              : undefined;
            const active = status === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setStatus(t.key);
                  setPage(1);
                }}
                className={`relative -mb-px border-b-2 py-2.5 text-sm transition-colors ${
                  active
                    ? 'border-border font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {n !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search by title or handle…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={productType}
            onChange={(e) => {
              setProductType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All product types</option>
            {facets.productTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All vendors</option>
            {facets.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {sortForPicker(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(categories, c)}
              </option>
            ))}
          </Select>
          {(search || status || productType || categoryId || brand) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setProductType('');
                setCategoryId('');
                setBrand('');
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
            <CardList empty="No products match those filters">
              {rows.map((p) => (
                <RecordCard
                  key={p.id}
                  href={`/admin/products/${p.id}`}
                  mono={false}
                  title={p.title}
                  amount={priceLabel(p)}
                  date={p.handle}
                  primary={`${p.variantCount} variant${p.variantCount === 1 ? '' : 's'}${
                    p.trackInventory ? '' : ' · untracked'
                  }`}
                  secondary={
                    [p.productType, p.category?.name ?? 'Uncategorised', p.brand]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  footer={`Updated ${shortDate(p.updatedAt)}`}
                  thumb={<Thumb url={p.media?.[0]?.url} label={p.title} />}
                  select={
                    <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                  }
                  badges={
                    <>
                      <Badge status={p.status}>{productStatusLabel(p.status)}</Badge>
                      {p.collections.slice(0, 2).map((c) => (
                        <Badge key={c.id} tone="blue">
                          {c.title}
                        </Badge>
                      ))}
                      {p.collections.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{p.collections.length - 2}
                        </span>
                      )}
                    </>
                  }
                />
              ))}
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
                  <Th>Product</Th>
                  <Th>Status</Th>
                  <Th>MRP</Th>
                  <Th>Selling price</Th>
                  <Th>Off MRP</Th>
                  <Th>Variants</Th>
                  <Th>Product type</Th>
                  <Th>Category</Th>
                  <Th>Vendor</Th>
                  <Th>Collections</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={12} message="No products match those filters" />}
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Thumb url={p.media?.[0]?.url} label={p.title} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="font-medium text-gold-ink hover:underline"
                          >
                            {p.title}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.handle}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge status={p.status}>{productStatusLabel(p.status)}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{mrpLabel(p)}</Td>
                    <Td className="whitespace-nowrap font-medium">{priceLabel(p)}</Td>
                    <Td className={`whitespace-nowrap text-xs ${offMrpLabel(p)?.above ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {offMrpLabel(p)?.text ?? '—'}
                    </Td>
                    <Td>
                      {p.variantCount}
                      {!p.trackInventory && (
                        <span className="ml-1 text-xs text-muted-foreground">· untracked</span>
                      )}
                    </Td>
                    <Td>{p.productType ?? '—'}</Td>
                    <Td>
                      {p.category ? (
                        p.category.name
                      ) : (
                        <span className="text-muted-foreground">Uncategorised</span>
                      )}
                    </Td>
                    <Td>
                      {p.brand ?? <span className="text-muted-foreground">—</span>}
                    </Td>
                    <Td>
                      {p.collections.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.collections.slice(0, 2).map((c) => (
                            <Badge key={c.id} tone="blue">
                              {c.title}
                            </Badge>
                          ))}
                          {p.collections.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{p.collections.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(p.updatedAt)}
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
