'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Gift, Plus } from 'lucide-react';
import { api, errorMessage, money, type Paged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListParams } from '@/lib/useListParams';
import { productStatusLabel } from '@/lib/labels';
import { Badge, Button, Input, PageHeader, Select } from '@/components/ui';
import { DataTable, type DataColumn } from '@/components/DataTable';

type Combo = {
  id: string;
  title: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  priceMin: number | null;
  priceMax: number | null;
  mrpMin: number | null;
  variants: { id: string; title: string; price: string; available: number; componentCount: number }[];
  updatedAt: string;
};

const DEFAULTS = { page: '1', limit: '20', search: '', status: '', sortBy: '', sortOrder: '' };

export default function BundlesPage() {
  const { can } = useAuth();
  const list = useListParams(DEFAULTS);
  const { values, set } = list;
  const page = Number(values.page) || 1;
  const limit = Number(values.limit) || 20;
  const [search, setSearch] = useState(values.search);

  useEffect(() => {
    if (search === values.search) return;
    const t = setTimeout(() => set({ search }), 300);
    return () => clearTimeout(t);
  }, [search, values.search, set]);

  const query = useQuery({
    queryKey: ['bundles', values],
    queryFn: () =>
      api.get<Paged<Combo>>('/products', {
        kind: 'BUNDLE',
        page,
        limit,
        search: values.search || undefined,
        status: values.status || undefined,
        sortBy: values.sortBy || undefined,
        sortOrder: values.sortOrder || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<DataColumn<Combo>[]>(
    () => [
      {
        id: 'title',
        label: 'Combo',
        header: 'Combo',
        enableHiding: false,
        cell: ({ row }) => (
          <Link href={`/admin/products/${row.original.id}?tab=combo`} className="font-medium text-foreground hover:text-gold-ink hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      {
        id: 'contents',
        label: 'Contents',
        header: 'Contents',
        enableSorting: false,
        cell: ({ row }) => {
          const parts = row.original.variants.reduce((n, v) => n + v.componentCount, 0);
          return parts ? <span className="text-sm">{parts} product{parts === 1 ? '' : 's'}</span> : <Badge tone="amber">Nothing inside yet</Badge>;
        },
      },
      {
        id: 'available',
        label: 'Can be packed',
        header: 'Can be packed',
        align: 'right',
        enableSorting: false,
        cell: ({ row }) => {
          const n = row.original.variants.reduce((sum, v) => sum + (v.available ?? 0), 0);
          return <span className={n > 0 ? 'font-medium text-foreground' : 'text-warning'}>{n}</span>;
        },
      },
      {
        id: 'price',
        label: 'Price',
        header: 'Price',
        align: 'right',
        enableSorting: false,
        cell: ({ row }) => (row.original.priceMin != null ? money(row.original.priceMin) : '—'),
      },
      {
        id: 'mrp',
        label: 'MRP',
        header: 'MRP',
        align: 'right',
        enableSorting: false,
        cell: ({ row }) => (row.original.mrpMin != null ? money(row.original.mrpMin) : '—'),
      },
      {
        id: 'status',
        label: 'Status',
        header: 'Status',
        cell: ({ row }) => <Badge status={row.original.status}>{productStatusLabel(row.original.status)}</Badge>,
      },
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Combos & gift sets"
        subtitle="Sets sold at their own price and packed from products you already stock"
        actions={
          can('products:write') && (
            <Button asChild variant="primary">
              <Link href="/admin/bundles/new">
                <Plus /> New combo
              </Link>
            </Button>
          )
        }
      />

      <DataTable
        viewKey="bundles"
        columns={columns}
        data={query.data?.data}
        getRowId={(r) => r.id}
        total={query.data?.meta.total ?? 0}
        page={page}
        pageSize={limit}
        onPageChange={(p) => set({ page: String(p) }, { resetPage: false })}
        onPageSizeChange={(n) => set({ limit: String(n) })}
        sortBy={values.sortBy}
        sortOrder={values.sortOrder}
        onSortChange={(sortBy, sortOrder) => set({ sortBy, sortOrder })}
        loading={query.isFetching}
        error={query.error ? errorMessage(query.error) : undefined}
        onRetry={() => query.refetch()}
        filtered={list.filtered}
        onClearFilters={() => {
          setSearch('');
          list.reset();
        }}
        views={{ query: list.query, apply: list.apply }}
        empty={{
          icon: <Gift />,
          title: 'No combos yet',
          description: 'Put products together into a gift set with its own price. Stock comes from the products inside.',
          action: can('products:write') ? (
            <Button asChild variant="primary">
              <Link href="/admin/bundles/new">
                <Plus /> Create a combo
              </Link>
            </Button>
          ) : undefined,
        }}
        toolbar={
          <>
            <Input placeholder="Search combos…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" aria-label="Search combos" />
            <Select value={values.status} onChange={(e) => set({ status: e.target.value })} className="w-auto" aria-label="Status">
              <option value="">Any status</option>
              <option value="ACTIVE">Ready to sell</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </>
        }
        mobileCard={(c) => (
          <Link href={`/admin/products/${c.id}?tab=combo`} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{c.title}</span>
              <span className="text-xs text-muted-foreground">{c.variants.reduce((n, v) => n + (v.available ?? 0), 0)} can be packed</span>
            </span>
            <Badge status={c.status}>{productStatusLabel(c.status)}</Badge>
          </Link>
        )}
      />
    </>
  );
}
