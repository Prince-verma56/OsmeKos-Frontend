'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money, shortDate, errorMessage, type Paged, numberLocale } from '@/lib/api';
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
type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  referenceNumber: string | null;
  status: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  overdueByDays: number | null;
  customer: { id: string; displayName: string | null } | null;
  order: { id: string; orderNumber: string } | null;
  lines?: { order: { id: string; orderNumber: string } | null }[];
};

const ordersOf = (inv: { order: { id: string; orderNumber: string } | null; lines?: { order: { id: string; orderNumber: string } | null }[] }) => [
  ...new Map(
    [inv.order, ...(inv.lines ?? []).map((l) => l.order)]
      .filter((o): o is { id: string; orderNumber: string } => !!o)
      .map((o) => [o.id, o])
  ).values(),
];

type Meta = Paged<Invoice>['meta'] & {
  counts: Record<string, number>;
  tiles: {
    outstanding: number;
    dueToday: number;
    dueTodayCount: number;
    dueIn30Days: number;
    dueIn30DaysCount: number;
    overdue: number;
    overdueCount: number;
    averageDaysToPay: number | null;
  };
};

type Customer = { id: string; displayName: string | null };

const VIEWS = [
  { key: '', view: '', label: 'All' },
  { key: 'DRAFT', view: '', label: 'Draft' },
  { key: 'SENT', view: '', label: 'Sent' },
  { key: '', view: 'overdue', label: 'Overdue' },
  { key: '', view: 'unpaid', label: 'Unpaid' },
  { key: 'PARTIALLY_PAID', view: '', label: 'Partially Paid' },
  { key: 'PAID', view: '', label: 'Paid' },
  { key: 'VOID', view: '', label: 'Void' },
] as const;

const COUNT_KEY: Record<string, string> = {
  All: 'ALL',
  Draft: 'DRAFT',
  Sent: 'SENT',
  Overdue: 'LATE',
  Unpaid: 'UNPAID',
  'Partially Paid': 'PARTIALLY_PAID',
  Paid: 'PAID',
  Void: 'VOID',
};

export default function InvoicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Invoice[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [copying, setCopying] = useState(false);
  const [copies, setCopies] = useState<{
    created: { id: string; invoiceNumber: string; from: string }[];
    refused: { id: string; message: string }[];
  } | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const params = useSearchParams();
  const [view, setView] = useState(() => {
    const asked = params.get('view') ?? '';
    return asked === 'overdue' || asked === 'unpaid' ? asked : '';
  });
  const [customerId, setCustomerId] = useState(() => params.get('customerId') ?? '');
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
      const res = await api.get<Paged<Invoice>>('/invoices', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        view: view || undefined,
        customerId: customerId || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, view, customerId, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const tiles = meta?.tiles;
  const counts = meta?.counts;

  async function duplicateSelected() {
    setCopying(true);
    setError('');
    try {
      const res = await api.post<{
        data: {
          created: { id: string; invoiceNumber: string; from: string }[];
          refused: { id: string; message: string }[];
        };
      }>('/invoices/bulk-duplicate', { ids: sel.selected });
      sel.clear();
      if (res.data.created.length === 1 && !res.data.refused.length) {
        router.push(`/admin/invoices/${res.data.created[0].id}/edit`);
        return;
      }
      setCopies(res.data);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  function exportSpec() {
    const columns: Column<Invoice>[] = [
      { header: 'Invoice', value: (r) => r.invoiceNumber, width: 100 },
      { header: 'Date', value: (r) => shortDate(r.invoiceDate) },
      { header: 'Due', value: (r) => (r.dueDate ? shortDate(r.dueDate) : '') },
      { header: 'Customer', value: (r) => r.customer?.displayName ?? '', width: 150 },
      { header: 'Order', value: (r) => r.order?.orderNumber ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Overdue by (days)', value: (r) => r.overdueByDays ?? 0, align: 'right' as const },
      { header: 'Total', value: (r) => Number(r.grandTotal), money: true },
      { header: 'Paid', value: (r) => Number(r.amountPaid), money: true },
      { header: 'Balance due', value: (r) => Number(r.balanceDue), money: true },
    ];
    return {
      title: 'Invoices',
      subtitle: `${sel.count || rows.length} invoice(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Balance due is the total less payments and credit notes applied. Overdue days count ' +
        'from the due date, not the invoice date.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="What customers owe us — the tax invoice is the document GSTR-1 is filed from"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            <Link href="/admin/invoices/new">
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

      {tiles && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Outstanding Receivables"
            value={money(tiles.outstanding)}
            tone={tiles.outstanding > 0 ? 'amber' : 'green'}
          />
          <StatCard
            label="Due Today"
            value={money(tiles.dueToday)}
            sub={`${tiles.dueTodayCount} invoice(s)`}
          />
          <StatCard
            label="Due Within 30 Days"
            value={money(tiles.dueIn30Days)}
            sub={`${tiles.dueIn30DaysCount} invoice(s)`}
          />
          <StatCard
            label="Overdue Invoices"
            value={money(tiles.overdue)}
            sub={
              tiles.averageDaysToPay === null
                ? `${tiles.overdueCount} invoice(s)`
                : `${tiles.overdueCount} invoice(s) · avg ${tiles.averageDaysToPay}d to pay`
            }
            tone={tiles.overdue > 0 ? 'red' : 'green'}
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="invoice"
        endpoint="/invoices/bulk-delete"
        ids={sel.selected}
        onDone={() => {
          sel.clear();
          load();
        }}
        onClear={sel.clear}
        actions={
          <Button size="sm" onClick={duplicateSelected} disabled={copying}>
            {copying ? 'Copying…' : 'Duplicate'}
          </Button>
        }
      />

      {copies && (
        <div className="mb-3 rounded-md border border-gold/40 bg-gold-soft px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-gold-ink">
              {copies.created.length} draft cop{copies.created.length === 1 ? 'y' : 'ies'} made
              {copies.refused.length > 0 && `, ${copies.refused.length} could not be copied`}
            </span>
            <button
              type="button"
              onClick={() => setCopies(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Dismiss
            </button>
          </div>
          {copies.created.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {copies.created.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-foreground">{c.invoiceNumber}</span>
                  <span className="text-muted-foreground">copy of {c.from}</span>
                  <Link
                    href={`/admin/invoices/${c.id}/edit`}
                    className="font-medium text-gold-ink hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {copies.refused.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {copies.refused.map((r) => (
                <li key={r.id}>· {r.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-5 border-b border-border px-4">
          {VIEWS.map((v) => {
            const active = status === v.key && view === v.view;
            const n = counts?.[COUNT_KEY[v.label]];
            return (
              <button
                key={v.label}
                onClick={() => {
                  setStatus(v.key);
                  setView(v.view);
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
            placeholder="Search invoice number, reference, subject or customer…"
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
          {(search || status || view || customerId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setView('');
                setCustomerId('');
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
            <CardList empty="No invoices match those filters">
              {rows.map((inv) => (
                <RecordCard
                  key={inv.id}
                  href={`/admin/invoices/${inv.id}`}
                  title={inv.invoiceNumber}
                  amount={money(inv.grandTotal)}
                  date={shortDate(inv.invoiceDate)}
                  note={Number(inv.balanceDue) > 0 ? `${money(inv.balanceDue)} due` : undefined}
                  primary={inv.customer?.displayName ?? '—'}
                  secondary={
                    inv.order
                      ? `Order ${inv.order.orderNumber}`
                      : (inv.referenceNumber ?? undefined)
                  }
                  alert={
                    inv.overdueByDays
                      ? `Overdue by ${inv.overdueByDays.toLocaleString(numberLocale())} days`
                      : undefined
                  }
                  footer={inv.dueDate ? `Due ${shortDate(inv.dueDate)}` : undefined}
                  select={
                    <SelectBox
                      checked={sel.isSelected(inv.id)}
                      onChange={() => sel.toggle(inv.id)}
                    />
                  }
                  badges={<Badge status={inv.status}>{inv.status.replaceAll('_', ' ')}</Badge>}
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="1050px">
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
                  <Th>INVOICE#</Th>
                  <Th>ORDER NUMBER</Th>
                  <Th>CUSTOMER NAME</Th>
                  <Th>STATUS</Th>
                  <Th>DUE DATE</Th>
                  <Th className="text-right">AMOUNT</Th>
                  <Th className="text-right">BALANCE DUE</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={9} message="No invoices match those filters" />
                )}
                {rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox
                        checked={sel.isSelected(inv.id)}
                        onChange={() => sel.toggle(inv.id)}
                      />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(inv.invoiceDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      {ordersOf(inv).length ? (
                        ordersOf(inv).map((o, idx) => (
                          <span key={o.id}>
                            {idx > 0 && ', '}
                            <Link href={`/admin/orders/${o.id}`} className="text-gold-ink hover:underline">
                              {o.orderNumber}
                            </Link>
                          </span>
                        ))
                      ) : (
                        (inv.referenceNumber ?? '—')
                      )}
                    </Td>
                    <Td>{inv.customer?.displayName ?? '—'}</Td>
                    <Td>
                      {inv.overdueByDays ? (
                        <span className="whitespace-nowrap text-xs font-medium uppercase text-destructive">
                          Overdue by {inv.overdueByDays.toLocaleString(numberLocale())} days
                        </span>
                      ) : (
                        <Badge status={inv.status}>{inv.status.replaceAll('_', ' ')}</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {inv.dueDate ? shortDate(inv.dueDate) : '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-right">{money(inv.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(inv.balanceDue)}
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
