'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
type Bill = {
  id: string;
  billNumber: string;
  billDate: string;
  dueDate: string | null;
  referenceNumber: string | null;
  status: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  overdueByDays: number;
  vendor: { id: string; displayName: string } | null;
  purchaseOrder: { id: string; poNumber: string } | null;
  _count?: { lines: number; payments: number };
};

type Meta = Paged<Bill>['meta'] & {
  counts: Record<string, number>;
  tiles: {
    outstanding: number;
    dueToday: number;
    dueTodayCount: number;
    dueIn30Days: number;
    dueIn30DaysCount: number;
    overdue: number;
    overdueCount: number;
  };
};

type Vendor = { id: string; displayName: string };

const VIEWS = [
  { key: '', view: '', label: 'All' },
  { key: 'DRAFT', view: '', label: 'Draft' },
  { key: 'OPEN', view: '', label: 'Open' },
  { key: '', view: 'overdue', label: 'Overdue' },
  { key: '', view: 'unpaid', label: 'Unpaid' },
  { key: 'PARTIALLY_PAID', view: '', label: 'Partially Paid' },
  { key: 'PAID', view: '', label: 'Paid' },
  { key: 'VOID', view: '', label: 'Void' },
] as const;

const COUNT_KEY: Record<string, string> = {
  All: 'ALL',
  Draft: 'DRAFT',
  Open: 'OPEN',
  Overdue: 'LATE',
  Unpaid: 'UNPAID',
  'Partially Paid': 'PARTIALLY_PAID',
  Paid: 'PAID',
  Void: 'VOID',
};

export default function BillsPage() {
  const [rows, setRows] = useState<Bill[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const params = useSearchParams();
  const [view, setView] = useState(() => {
    const asked = params.get('view') ?? '';
    return asked === 'overdue' || asked === 'unpaid' ? asked : '';
  });
  const [vendorId, setVendorId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Paged<Vendor>>('/vendors', { limit: 100 })
      .then((r) => {
        if (!cancelled) setVendors(r.data);
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
      const res = await api.get<Paged<Bill>>('/bills', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        view: view || undefined,
        vendorId: vendorId || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, view, vendorId, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const tiles = meta?.tiles;
  const counts = meta?.counts;

  function exportSpec() {
    const columns: Column<Bill>[] = [
      { header: 'Bill', value: (r) => r.billNumber, width: 90 },
      { header: 'Date', value: (r) => shortDate(r.billDate) },
      { header: 'Due', value: (r) => (r.dueDate ? shortDate(r.dueDate) : '') },
      { header: 'Vendor', value: (r) => r.vendor?.displayName ?? '', width: 150 },
      { header: 'Purchase order', value: (r) => r.purchaseOrder?.poNumber ?? '' },
      { header: 'Reference', value: (r) => r.referenceNumber ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Overdue by (days)', value: (r) => r.overdueByDays, align: 'right' as const },
      { header: 'Total', value: (r) => Number(r.grandTotal), money: true },
      { header: 'Paid', value: (r) => Number(r.amountPaid), money: true },
      { header: 'Balance due', value: (r) => Number(r.balanceDue), money: true },
    ];
    return {
      title: 'Bills',
      subtitle: `${sel.count || rows.length} bill(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Balance due is the total less payments made and vendor credits applied. A voided bill ' +
        'is excluded from what is owed.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle="What we owe suppliers — a bill records the liability, a payment settles it"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            <Link href="/admin/bills/new">
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
            label="Total Outstanding Payables"
            value={money(tiles.outstanding)}
            tone={tiles.outstanding > 0 ? 'amber' : 'green'}
          />
          <StatCard
            label="Due Today"
            value={money(tiles.dueToday)}
            sub={`${tiles.dueTodayCount} bill(s)`}
          />
          <StatCard
            label="Due Within 30 Days"
            value={money(tiles.dueIn30Days)}
            sub={`${tiles.dueIn30DaysCount} bill(s)`}
          />
          <StatCard
            label="Overdue Bills"
            value={money(tiles.overdue)}
            sub={`${tiles.overdueCount} bill(s)`}
            tone={tiles.overdue > 0 ? 'red' : 'green'}
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="bill"
        endpoint="/bills/bulk-delete"
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
            placeholder="Search bill number, reference or vendor…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={(next) => { setRange(next); setPage(1); }} />
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.displayName}</option>
            ))}
          </Select>
          {(search || status || view || vendorId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setView('');
                setVendorId('');
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
            <CardList empty="No bills match those filters">
              {rows.map((b) => (
                <RecordCard
                  key={b.id}
                  href={`/admin/bills/${b.id}`}
                  title={b.billNumber}
                  amount={money(b.grandTotal)}
                  date={shortDate(b.billDate)}
                  note={Number(b.balanceDue) > 0 ? `${money(b.balanceDue)} due` : undefined}
                  primary={b.vendor?.displayName ?? '—'}
                  secondary={b.referenceNumber ?? undefined}
                  alert={
                    b.overdueByDays > 0
                      ? `Overdue by ${b.overdueByDays.toLocaleString(numberLocale())} days`
                      : undefined
                  }
                  footer={b.dueDate ? `Due ${shortDate(b.dueDate)}` : undefined}
                  select={
                    <SelectBox checked={sel.isSelected(b.id)} onChange={() => sel.toggle(b.id)} />
                  }
                  badges={<Badge status={b.status}>{b.status.replaceAll('_', ' ')}</Badge>}
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="1000px">
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
                  <Th>BILL#</Th>
                  <Th>REFERENCE NUMBER</Th>
                  <Th>VENDOR NAME</Th>
                  <Th>STATUS</Th>
                  <Th>DUE DATE</Th>
                  <Th className="text-right">AMOUNT</Th>
                  <Th className="text-right">BALANCE DUE</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={9} message="No bills match those filters" />
                )}
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(b.id)} onChange={() => sel.toggle(b.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(b.billDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/bills/${b.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {b.billNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">{b.referenceNumber ?? '—'}</Td>
                    <Td>{b.vendor?.displayName ?? '—'}</Td>
                    <Td>
                      {b.overdueByDays > 0 ? (
                        <span className="whitespace-nowrap text-xs font-medium uppercase text-destructive">
                          Overdue by {b.overdueByDays.toLocaleString(numberLocale())} days
                        </span>
                      ) : (
                        <Badge status={b.status}>{b.status.replaceAll('_', ' ')}</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {b.dueDate ? shortDate(b.dueDate) : '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-right">{money(b.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(b.balanceDue)}
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
