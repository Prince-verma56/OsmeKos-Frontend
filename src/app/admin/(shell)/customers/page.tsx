'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';

import { CardList, RecordCard } from '@/components/CardList';
type Customer = {
  id: string;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  workPhone: string | null;
  customerType: 'D2C' | 'B2B';
  isGuest: boolean;
  status: string;
  totalOrders: number;
  totalSpent: string;
  lastOrderAt: string | null;
  b2bAccount: {
    id: string;
    companyName: string;
    gstin: string | null;
    gstTreatment: string;
  } | null;
};

const GST_LABEL: Record<string, string> = {
  REGISTERED_REGULAR: 'Registered Business - Regular',
  REGISTERED_COMPOSITION: 'Registered Business - Composition',
  UNREGISTERED: 'Unregistered Business',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'SEZ',
};

const nameOf = (c: Customer) =>
  c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.phone || '—';

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Paged<Customer>['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Customer>>('/customers', {
        page,
        limit: pageSize,
        search: search || undefined,
        customerType: customerType || undefined,
        status: status || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, customerType, status, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const filtering = !!(search || customerType || status);
  const businesses = rows.filter((r) => r.customerType === 'B2B').length;
  const spend = rows.reduce((n, r) => n + Number(r.totalSpent), 0);

  function exportSpec() {
    const columns: Column<Customer>[] = [
      { header: 'Name', value: (r) => r.displayName ?? '', width: 150 },
      { header: 'Type', value: (r) => r.customerType },
      { header: 'Company', value: (r) => r.b2bAccount?.companyName ?? '' },
      { header: 'GSTIN', value: (r) => r.b2bAccount?.gstin ?? '' },
      { header: 'Email', value: (r) => r.email ?? '', width: 140 },
      { header: 'Phone', value: (r) => r.phone ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Orders', value: (r) => r.totalOrders, align: 'right' as const },
      { header: 'Total spent', value: (r) => Number(r.totalSpent), money: true },
      { header: 'Last order', value: (r) => (r.lastOrderAt ? shortDate(r.lastOrderAt) : 'Never') },
    ];
    return {
      title: 'Customers',
      subtitle: `${sel.count || rows.length} customer(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Total spent is the lifetime value of delivered and invoiced orders. Guests appear once ' +
        'per checkout identity, not per order.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone who buys from us — individuals and the people who buy for a company"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            <Link href="/admin/customers/new">
              <Button variant="primary">+ New</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Customers" value={String(meta?.total ?? 0)} sub="matching this view" />
        <StatCard label="Businesses" value={String(businesses)} sub="on this page" tone="blue" />
        <StatCard label="Spend" value={money(spend)} sub="lifetime, on this page" tone="green" />
      </div>

      <BulkBar
        count={sel.count}
        noun="customer"
        endpoint="/customers/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search name, company, email or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={customerType}
            onChange={(e) => {
              setCustomerType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="B2B">B2B — Business</option>
            <option value="D2C">D2C — Individual</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </Select>
          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setCustomerType('');
                setStatus('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty="No customers match those filters">
              {rows.map((c) => (
                <RecordCard
                  key={c.id}
                  href={`/admin/customers/${c.id}`}
                  mono={false}
                  title={nameOf(c)}
                  amount={money(c.totalSpent)}
                  date={c.b2bAccount?.companyName ?? undefined}
                  note={c.lastOrderAt ? `last ${shortDate(c.lastOrderAt)}` : undefined}
                  primary={c.email ?? c.workPhone ?? c.phone ?? '—'}
                  secondary={c.email ? (c.workPhone ?? c.phone ?? undefined) : undefined}
                  footer={`${c.totalOrders} order${c.totalOrders === 1 ? '' : 's'} · ${
                    c.b2bAccount
                      ? (GST_LABEL[c.b2bAccount.gstTreatment] ?? c.b2bAccount.gstTreatment)
                      : 'Consumer'
                  }`}
                  select={
                    <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                  }
                  badges={
                    <>
                      <Badge tone={c.customerType === 'B2B' ? 'blue' : 'gray'}>
                        {c.customerType === 'B2B' ? 'B2B' : 'D2C'}
                      </Badge>
                      {c.isGuest && <Badge tone="gray">Guest</Badge>}
                      {c.status !== 'ACTIVE' && <Badge status={c.status}>{c.status}</Badge>}
                    </>
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="1080px">
              <thead>
                <tr>
                  <Th className="w-8">
                    <SelectAllBox
                      checked={sel.allOnPage}
                      indeterminate={sel.someOnPage}
                      onChange={sel.toggleAll}
                    />
                  </Th>
                  <Th>NAME</Th>
                  <Th>TYPE</Th>
                  <Th>COMPANY NAME</Th>
                  <Th>EMAIL</Th>
                  <Th>WORK PHONE</Th>
                  <Th>GST TREATMENT</Th>
                  <Th className="text-right">ORDERS</Th>
                  <Th className="text-right">SPEND</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={9} message="No customers match those filters" />
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {nameOf(c)}
                      </Link>
                      {c.isGuest && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          guest
                        </span>
                      )}
                      {c.status !== 'ACTIVE' && (
                        <Badge status={c.status}>{c.status}</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={c.customerType === 'B2B' ? 'blue' : 'gray'}>
                        {c.customerType === 'B2B' ? 'B2B' : 'D2C'}
                      </Badge>
                    </Td>
                    <Td className="text-xs">{c.b2bAccount?.companyName ?? '—'}</Td>
                    <Td className="text-xs">{c.email ?? '—'}</Td>
                    <Td className="text-xs">{c.workPhone ?? c.phone ?? '—'}</Td>
                    <Td className="text-xs">
                      {c.b2bAccount
                        ? (GST_LABEL[c.b2bAccount.gstTreatment] ?? c.b2bAccount.gstTreatment)
                        : 'Consumer'}
                    </Td>
                    <Td className="text-right">{c.totalOrders}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(c.totalSpent)}
                      {c.lastOrderAt && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          last {shortDate(c.lastOrderAt)}
                        </span>
                      )}
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
