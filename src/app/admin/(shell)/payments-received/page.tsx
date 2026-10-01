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
import { DateRange } from '@/components/DateRange';
type Payment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  tdsDeducted: string;
  bankCharges: string;
  paymentMode: string;
  referenceNumber: string | null;
  depositTo: string | null;
  notes: string | null;
  type: 'INVOICE_PAYMENT' | 'CUSTOMER_ADVANCE';
  status?: string;
  unapplied: number;
  customer: { id: string; displayName: string | null } | null;
  allocations: {
    id: string;
    amount: string;
    invoice: { id: string; invoiceNumber: string };
  }[];
};

type Meta = Paged<Payment>['meta'] & {
  totals: {
    filtered: number;
    tdsDeducted: number;
    bankCharges: number;
    allTime: number;
    unappliedAdvances: number;
  };
};

type Customer = { id: string; displayName: string | null };

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Received',
  APPLIED: 'Applied',
  PARTIALLY_APPLIED: 'Part applied',
  UNAPPLIED: 'Unapplied',
};

function statusOf(p: { type: string; status?: string; amount: string; unapplied: number }): string {
  if (p.status) return p.status;
  if (p.type === 'INVOICE_PAYMENT') return 'RECEIVED';
  if (p.unapplied <= 0) return 'APPLIED';
  return p.unapplied >= Number(p.amount) ? 'UNAPPLIED' : 'PARTIALLY_APPLIED';
}

const MODES = [
  { value: '', label: 'All modes' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
];

const modeLabel = (m: string) =>
  MODES.find((x) => x.value === m)?.label ?? m.replaceAll('_', ' ').toLowerCase();

const VIEWS = [
  { key: '', view: '', label: 'All' },
  { key: 'INVOICE_PAYMENT', view: '', label: 'Invoice Payments' },
  { key: 'CUSTOMER_ADVANCE', view: '', label: 'Advances' },
  { key: '', view: 'unapplied', label: 'Unapplied' },
] as const;

export default function PaymentsReceivedPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Payment>>('/payments-received', {
        page,
        limit: pageSize,
        search: search || undefined,
        customerId: customerId || undefined,
        paymentMode: paymentMode || undefined,
        type: type || undefined,
        view: view || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, customerId, paymentMode, type, view, from, to, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = meta?.totals;
  const filtering = !!(search || customerId || paymentMode || from || to);

  function exportSpec() {
    const columns: Column<Payment>[] = [
      { header: 'Receipt', value: (r) => r.paymentNumber, width: 90 },
      { header: 'Date', value: (r) => shortDate(r.paymentDate) },
      { header: 'Customer', value: (r) => r.customer?.displayName ?? '', width: 150 },
      { header: 'Kind', value: (r) => (r.type === 'CUSTOMER_ADVANCE' ? 'Advance' : 'Invoice payment') },
      { header: 'Mode', value: (r) => r.paymentMode },
      { header: 'Reference', value: (r) => r.referenceNumber ?? '' },
      { header: 'Deposited to', value: (r) => r.depositTo ?? '' },
      { header: 'Against', value: (r) => r.allocations.map((a) => a.invoice.invoiceNumber).join(', ') },
      { header: 'Amount', value: (r) => Number(r.amount), money: true },
      { header: 'TDS deducted', value: (r) => Number(r.tdsDeducted), money: true },
      { header: 'Bank charges', value: (r) => Number(r.bankCharges), money: true },
      { header: 'Unapplied', value: (r) => Number(r.unapplied), money: true },
    ];
    return {
      title: 'Payments received',
      subtitle: `${sel.count || rows.length} receipt(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'TDS is deducted by the customer and paid to the government on our behalf, so it settles ' +
        'the invoice without arriving as cash. Unapplied is money on account with no invoice yet.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Payments Received"
        subtitle="Money that has arrived from customers — each one settles an invoice"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            <Link href="/admin/payments-received/new">
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
          <StatCard label="Total Received" value={money(totals.allTime)} sub="all time" tone="green" />
          <StatCard
            label={filtering ? 'Matching this filter' : 'Shown here'}
            value={money(totals.filtered)}
            sub={`${meta?.total ?? 0} payment(s)`}
          />
          <StatCard
            label="Unapplied Advances"
            value={money(totals.unappliedAdvances)}
            sub="taken ahead, not yet on an invoice"
            tone={totals.unappliedAdvances > 0 ? 'purple' : 'slate'}
          />
          <StatCard
            label="TDS Deducted"
            value={money(totals.tdsDeducted)}
            sub="withheld by customers"
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="payment"
        endpoint="/payments-received/bulk-delete"
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
            const active = type === v.key && view === v.view;
            return (
              <button
                key={v.label}
                onClick={() => {
                  setType(v.key);
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
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search payment number, reference, customer or invoice…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
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
            value={paymentMode}
            onChange={(e) => {
              setPaymentMode(e.target.value);
              setPage(1);
            }}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <DateRange
            allowAll
            hideLabel
            label="Date"
            from={from}
            to={to}
            onChange={(next) => {
              setFrom(next.from);
              setTo(next.to);
              setPage(1);
            }}
          />
          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setCustomerId('');
                setPaymentMode('');
                setFrom('');
                setTo('');
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
            <CardList empty="No payments match those filters">
              {rows.map((p) => (
                <RecordCard
                  key={p.id}
                  href={`/admin/payments-received/${p.id}`}
                  title={p.paymentNumber}
                  amount={money(p.amount)}
                  date={shortDate(p.paymentDate)}
                  note={
                    p.type === 'CUSTOMER_ADVANCE' && p.unapplied > 0
                      ? `${money(p.unapplied)} unused`
                      : undefined
                  }
                  primary={p.customer?.displayName ?? '—'}
                  secondary={
                    p.allocations.length === 0
                      ? 'Unapplied'
                      : p.allocations.length === 1
                        ? p.allocations[0].invoice.invoiceNumber
                        : `${p.allocations.length} invoices`
                  }
                  footer={[modeLabel(p.paymentMode), p.referenceNumber]
                    .filter(Boolean)
                    .join(' · ')}
                  select={
                    <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                  }
                  badges={
                    <>
                      <Badge tone={p.type === 'CUSTOMER_ADVANCE' ? 'purple' : 'gray'}>
                        {p.type === 'CUSTOMER_ADVANCE' ? 'Advance' : 'Invoice payment'}
                      </Badge>
                      <Badge status={statusOf(p)}>
                        {STATUS_LABEL[statusOf(p)] ?? statusOf(p).replaceAll('_', ' ')}
                      </Badge>
                    </>
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="1020px">
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
                  <Th>PAYMENT#</Th>
                  <Th>REFERENCE#</Th>
                  <Th>CUSTOMER NAME</Th>
                  <Th>INVOICE#</Th>
                  <Th>TYPE</Th>
                  <Th>STATUS</Th>
                  <Th>MODE</Th>
                  <Th className="text-right">AMOUNT</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={10} message="No payments match those filters" />
                )}
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(p.paymentDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/payments-received/${p.id}`}
                        className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                      >
                        {p.paymentNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">{p.referenceNumber ?? '—'}</Td>
                    <Td>{p.customer?.displayName ?? '—'}</Td>
                    <Td>
                      {p.allocations.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Unapplied
                        </span>
                      ) : p.allocations.length === 1 ? (
                        <Link
                          href={`/admin/invoices/${p.allocations[0].invoice.id}`}
                          className="whitespace-nowrap hover:underline"
                        >
                          {p.allocations[0].invoice.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-xs">{p.allocations.length} invoices</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={p.type === 'CUSTOMER_ADVANCE' ? 'purple' : 'gray'}>
                        {p.type === 'CUSTOMER_ADVANCE' ? 'Advance' : 'Invoice payment'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge status={statusOf(p)}>
                        {STATUS_LABEL[statusOf(p)] ?? statusOf(p).replaceAll('_', ' ')}
                      </Badge>
                    </Td>
                    <Td className="text-xs">{modeLabel(p.paymentMode)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(p.amount)}
                      {p.type === 'CUSTOMER_ADVANCE' && p.unapplied > 0 && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {money(p.unapplied)} unused
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
