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
type CreditNote = {
  id: string;
  creditNumber: string;
  creditDate: string;
  referenceNumber: string | null;
  reason: string | null;
  status: string;
  grandTotal: string;
  amountApplied: string;
  amountRefunded: string;
  balance: string;
  customer: { id: string; displayName: string | null } | null;
  invoice: { id: string; invoiceNumber: string } | null;
  location: { id: string; name: string } | null;
  applications: { id: string; amount: string; invoice: { id: string; invoiceNumber: string } }[];
};

type Meta = Paged<CreditNote>['meta'] & {
  counts: Record<string, number>;
  totals: { credited: number; applied: number; refunded: number; available: number };
};

type Customer = { id: string; displayName: string | null };

export const REASON_LABEL: Record<string, string> = {
  SALES_RETURN: 'Sales Return',
  POST_SALE_DISCOUNT: 'Post Sale Discount',
  DEFICIENCY_IN_SERVICE: 'Deficiency in service',
  CORRECTION_IN_INVOICE: 'Correction in invoice',
  CHANGE_IN_POS: 'Change in POS',
  FINALIZATION_OF_PROVISIONAL_ASSESSMENT: 'Finalization of Provisional assessment',
  OTHERS: 'Others',
};

const VIEWS = [
  { key: '', view: '', label: 'All' },
  { key: 'DRAFT', view: '', label: 'Draft' },
  { key: 'OPEN', view: '', label: 'Open' },
  { key: '', view: 'unused', label: 'Unused Credits' },
  { key: 'CLOSED', view: '', label: 'Closed' },
  { key: 'VOID', view: '', label: 'Void' },
] as const;

const COUNT_KEY: Record<string, string> = {
  All: 'ALL',
  Draft: 'DRAFT',
  Open: 'OPEN',
  Closed: 'CLOSED',
  Void: 'VOID',
};

export default function CreditNotesPage() {
  const [rows, setRows] = useState<CreditNote[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [reason, setReason] = useState('');
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
      const res = await api.get<Paged<CreditNote>>('/credit-notes', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        view: view || undefined,
        customerId: customerId || undefined,
        reason: reason || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, view, customerId, reason, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = meta?.totals;
  const counts = meta?.counts;

  const invoiceCell = (c: CreditNote) => {
    if (c.applications.length > 1) {
      return <span className="text-xs">{c.applications.length} invoices</span>;
    }
    const one = c.applications[0]?.invoice ?? c.invoice;
    if (!one) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <Link
        href={`/admin/invoices/${one.id}`}
        className="whitespace-nowrap text-gold-ink hover:underline"
      >
        {one.invoiceNumber}
      </Link>
    );
  };

  function exportSpec() {
    const columns: Column<CreditNote>[] = [
      { header: 'Credit note', value: (r) => r.creditNumber, width: 100 },
      { header: 'Date', value: (r) => shortDate(r.creditDate) },
      { header: 'Customer', value: (r) => r.customer?.displayName ?? '', width: 150 },
      { header: 'Against invoice', value: (r) => r.invoice?.invoiceNumber ?? '' },
      { header: 'Reason', value: (r) => (r.reason ? (REASON_LABEL[r.reason] ?? r.reason) : '') },
      { header: 'Status', value: (r) => r.status },
      { header: 'Total', value: (r) => Number(r.grandTotal), money: true },
      { header: 'Applied', value: (r) => Number(r.amountApplied), money: true },
      { header: 'Refunded', value: (r) => Number(r.amountRefunded), money: true },
      { header: 'Balance', value: (r) => Number(r.balance), money: true },
    ];
    return {
      title: 'Credit notes',
      subtitle: `${sel.count || rows.length} credit note(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Balance is credit still available to set against a future invoice or refund. The reason ' +
        'code is what GSTR-1 asks for.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Credit Notes"
        subtitle="What we owe customers — a return, a post-sale discount, or an invoice corrected after filing"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/credit-notes/new">
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

      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Credited" value={money(totals.credited)} />
          <StatCard
            label="Applied to Invoices"
            value={money(totals.applied)}
            sub="offset against what they owe"
          />
          <StatCard label="Refunded" value={money(totals.refunded)} sub="money paid back" />
          <StatCard
            label="Unused Credits"
            value={money(totals.available)}
            sub="still available"
            tone={totals.available > 0 ? 'purple' : 'slate'}
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="credit note"
        endpoint="/credit-notes/bulk-delete"
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
            placeholder="Search credit note, reference, customer or invoice…"
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
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All reasons</option>
            {Object.entries(REASON_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
          {(search || status || view || customerId || reason) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setView('');
                setCustomerId('');
                setReason('');
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
            <CardList empty="No credit notes match those filters">
              {rows.map((c) => (
                <RecordCard
                  key={c.id}
                  href={`/admin/credit-notes/${c.id}`}
                  title={c.creditNumber}
                  amount={money(c.grandTotal)}
                  date={shortDate(c.creditDate)}
                  note={Number(c.balance) > 0 ? `${money(c.balance)} unapplied` : undefined}
                  primary={c.customer?.displayName ?? '—'}
                  secondary={invoiceCell(c)}
                  footer={[
                    c.reason ? (REASON_LABEL[c.reason] ?? c.reason) : null,
                    Number(c.amountRefunded) > 0 ? `${money(c.amountRefunded)} refunded` : null,
                    c.referenceNumber,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  select={
                    <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                  }
                  badges={<Badge status={c.status}>{c.status}</Badge>}
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
                  <Th>CREDIT NOTE#</Th>
                  <Th>REFERENCE NUMBER</Th>
                  <Th>CUSTOMER NAME</Th>
                  <Th>INVOICE#</Th>
                  <Th>REASON</Th>
                  <Th>STATUS</Th>
                  <Th className="text-right">AMOUNT</Th>
                  <Th className="text-right">BALANCE</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={10} message="No credit notes match those filters" />
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(c.creditDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/credit-notes/${c.id}`}
                        className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                      >
                        {c.creditNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">{c.referenceNumber ?? '—'}</Td>
                    <Td>{c.customer?.displayName ?? '—'}</Td>
                    <Td>{invoiceCell(c)}</Td>
                    <Td className="text-xs">
                      {c.reason ? (REASON_LABEL[c.reason] ?? c.reason) : '—'}
                    </Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right">{money(c.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(c.balance)}
                      {Number(c.amountRefunded) > 0 && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {money(c.amountRefunded)} refunded
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
