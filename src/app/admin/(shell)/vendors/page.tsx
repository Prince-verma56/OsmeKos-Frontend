'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Store, Trash2 } from 'lucide-react';
import { api, money, errorMessage, type Paged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useListParams } from '@/lib/useListParams';
import { Badge, Button, Input, PageHeader, Select } from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import { ConfirmModal } from '@/components/Modal';
import { DataTable, type DataColumn } from '@/components/DataTable';
import type { Column } from '@/lib/export';

type Vendor = {
  id: string;
  displayName: string;
  companyName: string | null;
  vendorType: 'MANUFACTURER' | 'LABEL_PRINTER' | 'OTHER';
  email: string | null;
  workPhone: string | null;
  mobile: string | null;
  gstTreatment: string;
  gstin: string | null;
  sourceOfSupplyState: string | null;
  isMsme: boolean;
  paymentTerms: string;
  payablesBalance: string | null;
  unusedCredits: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

const TYPE_LABEL: Record<Vendor['vendorType'], string> = {
  MANUFACTURER: 'Manufacturer',
  LABEL_PRINTER: 'Label printer',
  OTHER: 'Other',
};

const DEFAULTS = {
  page: '1',
  limit: '20',
  search: '',
  status: '',
  vendorType: '',
  isMsme: '',
  hasOutstanding: '',
  sortBy: '',
  sortOrder: '',
};

type BulkResult = { deleted: string[]; refused: { id: string; reason: string }[] };

export default function VendorsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
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
    queryKey: ['vendors', values],
    queryFn: () =>
      api.get<Paged<Vendor>>('/vendors', {
        page,
        limit,
        search: values.search || undefined,
        status: values.status || undefined,
        vendorType: values.vendorType || undefined,
        isMsme: values.isMsme || undefined,
        hasOutstanding: values.hasOutstanding || undefined,
        sortBy: values.sortBy || undefined,
        sortOrder: values.sortOrder || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.data;
  const [deleting, setDeleting] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  async function bulkDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await api.post<{ data: BulkResult }>('/vendors/bulk-delete', { ids: deleting.ids });
      const { deleted, refused } = res.data;
      if (deleted.length) toast.success(`${deleted.length} vendor${deleted.length === 1 ? '' : 's'} deleted`);
      if (refused.length) toast.error(`${refused.length} could not be deleted — ${refused[0].reason}`);
      deleting.clear();
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<DataColumn<Vendor>[]>(
    () => [
      {
        id: 'displayName',
        label: 'Name',
        enableHiding: false,
        header: 'Name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/admin/vendors/${row.original.id}`} className="font-medium text-foreground hover:text-gold-ink hover:underline">
              {row.original.displayName}
            </Link>
            {row.original.companyName && row.original.companyName !== row.original.displayName && (
              <div className="truncate text-xs text-muted-foreground">{row.original.companyName}</div>
            )}
          </div>
        ),
      },
      {
        id: 'vendorType',
        label: 'Type',
        header: 'Type',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-sm">{TYPE_LABEL[row.original.vendorType] ?? row.original.vendorType}</span>
            {row.original.isMsme && <Badge tone="gold" dot={false}>MSME</Badge>}
          </span>
        ),
      },
      {
        id: 'contact',
        label: 'Contact',
        header: 'Contact',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-xs">
            <div className="text-foreground/90">{row.original.email ?? '—'}</div>
            <div className="text-muted-foreground">{row.original.workPhone ?? row.original.mobile ?? ''}</div>
          </div>
        ),
      },
      {
        id: 'gstin',
        label: 'GSTIN',
        header: 'GSTIN',
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.gstin ?? '—'}</span>,
      },
      {
        id: 'sourceOfSupplyState',
        label: 'Source of supply',
        header: 'Supplies from',
        enableSorting: false,
        cell: ({ row }) => <span className="text-xs">{row.original.sourceOfSupplyState ?? '—'}</span>,
      },
      {
        id: 'payablesBalance',
        label: 'Payables',
        header: 'Payables',
        align: 'right',
        cell: ({ row }) => {
          const due = Number(row.original.payablesBalance ?? 0);
          return <span className={due > 0 ? 'font-medium text-warning' : 'text-muted-foreground'}>{money(due)}</span>;
        },
      },
      {
        id: 'unusedCredits',
        label: 'Unused credits',
        header: 'Unused credits',
        align: 'right',
        enableSorting: false,
        cell: ({ row }) => money(row.original.unusedCredits ?? 0),
      },
      {
        id: 'status',
        label: 'Status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <Badge status={row.original.status}>{row.original.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
        ),
      },
    ],
    []
  );

  function exportSpec() {
    const exportColumns: Column<Vendor>[] = [
      { header: 'Vendor', value: (r) => r.displayName, width: 150 },
      { header: 'Company', value: (r) => r.companyName ?? '' },
      { header: 'Type', value: (r) => TYPE_LABEL[r.vendorType] ?? r.vendorType },
      { header: 'GSTIN', value: (r) => r.gstin ?? '' },
      { header: 'GST treatment', value: (r) => r.gstTreatment },
      { header: 'Source state', value: (r) => r.sourceOfSupplyState ?? '' },
      { header: 'MSME', value: (r) => (r.isMsme ? 'Yes' : 'No') },
      { header: 'Email', value: (r) => r.email ?? '', width: 140 },
      { header: 'Phone', value: (r) => r.mobile ?? r.workPhone ?? '' },
      { header: 'Payment terms', value: (r) => r.paymentTerms },
      { header: 'Payables', value: (r) => Number(r.payablesBalance ?? 0), money: true },
      { header: 'Unused credits', value: (r) => Number(r.unusedCredits ?? 0), money: true },
      { header: 'Status', value: (r) => r.status },
    ];
    return {
      title: 'Vendors',
      subtitle: `${rows?.length ?? 0} vendor(s) on this page`,
      columns: exportColumns,
      rows: rows ?? [],
      footnote:
        'Payables is what is still owed on open bills. The source state decides whether a purchase carries IGST or CGST+SGST.',
      orientation: 'landscape' as const,
    };
  }

  const clearFilters = () => {
    setSearch('');
    list.reset();
  };

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="The factory, label printer and anyone else you buy from"
        actions={
          <>
            <ExportMenu spec={exportSpec} disabled={!rows?.length} />
            {can('vendors:write') && (
              <Button asChild variant="primary">
                <Link href="/admin/vendors/new">
                  <Plus /> New vendor
                </Link>
              </Button>
            )}
          </>
        }
      />

      <DataTable
        viewKey="vendors"
        columns={columns}
        data={rows}
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
        onClearFilters={clearFilters}
        views={{ query: list.query, apply: list.apply }}
        selectable={can('vendors:delete')}
        bulkActions={(ids, clear) => (
          <Button size="sm" variant="danger" onClick={() => setDeleting({ ids, clear })}>
            <Trash2 /> Delete
          </Button>
        )}
        empty={{
          icon: <Store />,
          title: 'No vendors yet',
          description: 'Add the factory that fills your products and the printer that makes your labels.',
          action: can('vendors:write') ? (
            <Button asChild variant="primary">
              <Link href="/admin/vendors/new">
                <Plus /> Add a vendor
              </Link>
            </Button>
          ) : undefined,
        }}
        toolbar={
          <>
            <Input
              placeholder="Search name, email or GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
              aria-label="Search vendors"
            />
            <Select value={values.vendorType} onChange={(e) => set({ vendorType: e.target.value })} aria-label="Vendor type" className="w-auto">
              <option value="">Any type</option>
              <option value="MANUFACTURER">Manufacturers</option>
              <option value="LABEL_PRINTER">Label printers</option>
              <option value="OTHER">Other</option>
            </Select>
            <Select value={values.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status" className="w-auto">
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            <Select value={values.hasOutstanding} onChange={(e) => set({ hasOutstanding: e.target.value })} aria-label="Balance" className="w-auto">
              <option value="">Any balance</option>
              <option value="true">Has payables</option>
              <option value="false">Settled</option>
            </Select>
            <Select value={values.isMsme} onChange={(e) => set({ isMsme: e.target.value })} aria-label="MSME" className="w-auto">
              <option value="">MSME: any</option>
              <option value="true">MSME only</option>
              <option value="false">Non-MSME</option>
            </Select>
          </>
        }
        mobileCard={(v, select) => (
          <div className="flex items-start gap-3">
            {select && <div className="pt-0.5">{select}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/vendors/${v.id}`} className="truncate font-medium text-foreground">
                  {v.displayName}
                </Link>
                <span className={Number(v.payablesBalance ?? 0) > 0 ? 'shrink-0 text-sm font-medium tabular-nums text-warning' : 'shrink-0 text-sm tabular-nums text-muted-foreground'}>
                  {money(v.payablesBalance ?? 0)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{TYPE_LABEL[v.vendorType] ?? v.vendorType}</span>
                {v.email && <span className="truncate">{v.email}</span>}
                <Badge status={v.status}>{v.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={bulkDelete}
        busy={busy}
        title={`Delete ${deleting?.ids.length ?? 0} vendor${deleting?.ids.length === 1 ? '' : 's'}?`}
        message="Vendors that already have purchase orders, bills or payments are kept — only unused ones are removed."
        confirmLabel="Delete"
      />
    </>
  );
}
