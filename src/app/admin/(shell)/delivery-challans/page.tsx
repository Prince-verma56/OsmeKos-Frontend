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
import { DateRange, type Range } from '@/components/DateRange';
type Challan = {
  id: string;
  challanNumber: string;
  challanType: string;
  challanDate: string;
  referenceNumber: string | null;
  status: string;
  invoiceStatus: 'NOT_INVOICED' | 'INVOICED';
  grandTotal: string;
  stockMoved: boolean;
  customer: { id: string; displayName: string | null } | null;
  order: { id: string; orderNumber: string } | null;
  location: { id: string; name: string } | null;
};

type Meta = Paged<Challan>['meta'] & {
  counts: Record<string, number>;
  totals: { value: number };
};

type Customer = { id: string; displayName: string | null };

export const CHALLAN_TYPE_LABEL: Record<string, string> = {
  JOB_WORK: 'Job Work',
  SUPPLY_ON_APPROVAL: 'Supply on Approval',
  SAMPLES_MARKETING: 'Samples & Marketing',
  STOCK_TRANSFER: 'Stock Transfer',
  OTHERS: 'Others',
};

const VIEWS = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'OPEN', label: 'Open' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'RETURNED', label: 'Returned' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const;

export default function DeliveryChallansPage() {
  const [rows, setRows] = useState<Challan[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [challanType, setChallanType] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Paged<Customer>>('/customers', { limit: 100 })
      .then((r) => {
        if (!cancelled) setCustomers(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [range, setRange] = useState<Range>({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Challan>>('/delivery-challans', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        customerId: customerId || undefined,
        challanType: challanType || undefined,
        invoiceStatus: invoiceStatus || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, customerId, challanType, invoiceStatus, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const counts = meta?.counts;
  const filtering = !!(search || status || customerId || challanType || invoiceStatus);

  function exportSpec() {
    const columns: Column<Challan>[] = [
      { header: 'Challan', value: (r) => r.challanNumber, width: 100 },
      { header: 'Date', value: (r) => shortDate(r.challanDate) },
      { header: 'Type', value: (r) => CHALLAN_TYPE_LABEL[r.challanType] ?? r.challanType },
      { header: 'Customer', value: (r) => r.customer?.displayName ?? '', width: 150 },
      { header: 'Order', value: (r) => r.order?.orderNumber ?? '' },
      { header: 'From', value: (r) => r.location?.name ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Invoiced', value: (r) => (r.invoiceStatus === 'INVOICED' ? 'Yes' : 'No') },
      { header: 'Stock moved', value: (r) => (r.stockMoved ? 'Yes' : 'No') },
      { header: 'Value', value: (r) => Number(r.grandTotal), money: true },
    ];
    return {
      title: 'Delivery challans',
      subtitle: `${sel.count || rows.length} challan(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'A challan moves goods without an invoice under Rule 55(1). Stock moved says whether the ' +
        'quantities have already left the shelf.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Delivery Challans"
        subtitle="Goods travelling without a tax invoice — job work, supply on approval, or ahead of the bill"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/delivery-challans/new">
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

      {meta && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={filtering ? 'Value, this filter' : 'Total Value Dispatched'}
            value={money(meta.totals.value)}
            sub={`${meta.total} challan(s)`}
          />
          <StatCard label="Open" value={String(counts?.OPEN ?? 0)} sub="goods on the road" />
          <StatCard
            label="Delivered"
            value={String(counts?.DELIVERED ?? 0)}
            sub="arrived, not yet returned"
          />
          <StatCard
            label="Returned"
            value={String(counts?.RETURNED ?? 0)}
            sub="stock released"
            tone="green"
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="challan"
        endpoint="/delivery-challans/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-5 border-b border-border px-4">
          {VIEWS.map((v) => {
            const active = status === v.key;
            const n = counts?.[v.key || 'ALL'];
            return (
              <button
                key={v.label}
                onClick={() => {
                  setStatus(v.key);
                  setPage(1);
                }}
                className={`relative -mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                  active
                    ? 'border-border font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {v.label}
                {n !== undefined && n > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search challan, reference, e-way bill or customer…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={(next) => { setRange(next); setPage(1); }} />
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName ?? 'Customer'}</option>
            ))}
          </Select>
          <Select
            value={challanType}
            onChange={(e) => {
              setChallanType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {Object.entries(CHALLAN_TYPE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
          <Select
            value={invoiceStatus}
            onChange={(e) => {
              setInvoiceStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any invoice status</option>
            <option value="NOT_INVOICED">Not invoiced</option>
            <option value="INVOICED">Invoiced</option>
          </Select>
          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setCustomerId('');
                setChallanType('');
                setInvoiceStatus('');
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
            <CardList empty="No delivery challans match those filters">
              {rows.map((c) => (
                <RecordCard
                  key={c.id}
                  href={`/admin/delivery-challans/${c.id}`}
                  title={c.challanNumber}
                  amount={money(c.grandTotal)}
                  date={shortDate(c.challanDate)}
                  primary={c.customer?.displayName ?? '—'}
                  secondary={
                    c.order ? `Order ${c.order.orderNumber}` : (c.referenceNumber ?? undefined)
                  }
                  alert={c.stockMoved ? 'Goods are off the shelf against this challan' : undefined}
                  footer={CHALLAN_TYPE_LABEL[c.challanType] ?? c.challanType}
                  select={
                    <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                  }
                  badges={
                    <>
                      <Badge status={c.status}>{c.status}</Badge>
                      {c.invoiceStatus === 'INVOICED' ? (
                        <Badge tone="green">Invoiced</Badge>
                      ) : (
                        <Badge tone="gray">Not invoiced</Badge>
                      )}
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
                  <Th>DATE</Th>
                  <Th>CHALLAN#</Th>
                  <Th>REFERENCE#</Th>
                  <Th>CUSTOMER NAME</Th>
                  <Th>TYPE</Th>
                  <Th>STATUS</Th>
                  <Th>INVOICE STATUS</Th>
                  <Th className="text-right">AMOUNT</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={9} message="No delivery challans match those filters" />
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(c.challanDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/delivery-challans/${c.id}`}
                        className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                      >
                        {c.challanNumber}
                      </Link>
                      {c.stockMoved && (
                        <span
                          className="ml-1.5 text-[11px] text-warning"
                          title="Goods are off the shelf against this challan"
                        >
                          holding stock
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {c.order ? (
                        <Link
                          href={`/admin/orders/${c.order.id}`}
                          className="text-gold-ink hover:underline"
                        >
                          {c.order.orderNumber}
                        </Link>
                      ) : (
                        (c.referenceNumber ?? '—')
                      )}
                    </Td>
                    <Td>{c.customer?.displayName ?? '—'}</Td>
                    <Td className="text-xs">
                      {CHALLAN_TYPE_LABEL[c.challanType] ?? c.challanType}
                    </Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                    <Td>
                      {c.invoiceStatus === 'INVOICED' ? (
                        <Badge tone="green">Invoiced</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not invoiced
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(c.grandTotal)}
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
