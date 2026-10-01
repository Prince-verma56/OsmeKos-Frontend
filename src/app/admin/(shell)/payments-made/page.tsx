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
  paymentMode: string;
  referenceNumber: string | null;
  notes: string | null;
  type: 'BILL_PAYMENT' | 'VENDOR_ADVANCE';
  status?: string;
  unapplied: number;
  vendor: { id: string; displayName: string } | null;
  allocations: {
    id: string;
    amount: string;
    bill: { id: string; billNumber: string };
  }[];
};

type Meta = Paged<Payment>['meta'] & {
  totals: { filtered: number; tdsDeducted: number; allTime: number; unappliedAdvances: number };
};

type Vendor = { id: string; displayName: string };

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Paid',
  APPLIED: 'Applied',
  PARTIALLY_APPLIED: 'Part applied',
  UNAPPLIED: 'Unapplied',
};

function statusOf(p: { type: string; status?: string; amount: string; unapplied: number }): string {
  if (p.status) return p.status;
  if (p.type === 'BILL_PAYMENT') return 'PAID';
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

export default function PaymentsMadePage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Payment>>('/bills/payments', {
        page,
        limit: pageSize,
        search: search || undefined,
        vendorId: vendorId || undefined,
        paymentMode: paymentMode || undefined,
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
  }, [page, search, vendorId, paymentMode, from, to, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = meta?.totals;
  const filtering = !!(search || vendorId || paymentMode || from || to);

  function exportSpec() {
    const columns: Column<Payment>[] = [
      { header: 'Payment', value: (r) => r.paymentNumber, width: 90 },
      { header: 'Date', value: (r) => shortDate(r.paymentDate) },
      { header: 'Vendor', value: (r) => r.vendor?.displayName ?? '', width: 150 },
      { header: 'Kind', value: (r) => (r.type === 'VENDOR_ADVANCE' ? 'Advance' : 'Bill payment') },
      { header: 'Mode', value: (r) => r.paymentMode },
      { header: 'Reference', value: (r) => r.referenceNumber ?? '' },
      { header: 'Amount', value: (r) => Number(r.amount), money: true },
      { header: 'TDS deducted', value: (r) => Number(r.tdsDeducted), money: true },
      { header: 'Unapplied', value: (r) => Number(r.unapplied), money: true },
    ];
    return {
      title: 'Payments made',
      subtitle: `${sel.count || rows.length} payment(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'TDS is withheld by us and paid to the government, so it settles the bill without ' +
        'leaving the bank. Unapplied is an advance with no bill against it yet.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Payments Made"
        subtitle="Money that has left for suppliers — each one settles a bill"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/payments-made/new">
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
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Total Paid" value={money(totals.allTime)} sub="all time" tone="green" />
          <StatCard
            label={filtering ? 'Matching this filter' : 'Shown here'}
            value={money(totals.filtered)}
            sub={`${meta?.total ?? 0} payment(s)`}
          />
          <StatCard
            label="Unapplied Advances"
            value={money(totals.unappliedAdvances)}
            sub="paid ahead, not yet on a bill"
            tone={totals.unappliedAdvances > 0 ? 'purple' : 'slate'}
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="payment"
        endpoint="/bills/payments/bulk-delete"
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
            placeholder="Search payment number, reference, vendor or bill…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
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
                setVendorId('');
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
                  href={`/admin/payments-made/${p.id}`}
                  title={p.paymentNumber}
                  amount={money(p.amount)}
                  date={shortDate(p.paymentDate)}
                  note={
                    p.type === 'VENDOR_ADVANCE' && p.unapplied > 0
                      ? `${money(p.unapplied)} unused`
                      : undefined
                  }
                  primary={p.vendor?.displayName ?? '—'}
                  secondary={
                    p.allocations.length === 0
                      ? 'Unapplied'
                      : p.allocations.length === 1
                        ? p.allocations[0].bill.billNumber
                        : `${p.allocations.length} bills`
                  }
                  footer={[modeLabel(p.paymentMode), p.referenceNumber]
                    .filter(Boolean)
                    .join(' · ')}
                  select={
                    <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                  }
                  badges={
                    <>
                      <Badge tone={p.type === 'VENDOR_ADVANCE' ? 'purple' : 'gray'}>
                        {p.type === 'VENDOR_ADVANCE' ? 'Advance' : 'Bill payment'}
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
                  <Th>PAYMENT#</Th>
                  <Th>REFERENCE#</Th>
                  <Th>VENDOR NAME</Th>
                  <Th>BILL#</Th>
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
                        href={`/admin/payments-made/${p.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {p.paymentNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">{p.referenceNumber ?? '—'}</Td>
                    <Td>{p.vendor?.displayName ?? '—'}</Td>
                    <Td>
                      {p.allocations.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Unapplied
                        </span>
                      ) : p.allocations.length === 1 ? (
                        <Link
                          href={`/admin/bills/${p.allocations[0].bill.id}`}
                          className="hover:underline"
                        >
                          {p.allocations[0].bill.billNumber}
                        </Link>
                      ) : (
                        <span className="text-xs">{p.allocations.length} bills</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={p.type === 'VENDOR_ADVANCE' ? 'purple' : 'gray'}>
                        {p.type === 'VENDOR_ADVANCE' ? 'Advance' : 'Bill payment'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge status={statusOf(p)}>
                        {STATUS_LABEL[statusOf(p)] ?? statusOf(p).replaceAll('_', ' ')}
                      </Badge>
                    </Td>
                    <Td className="text-xs">{modeLabel(p.paymentMode)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{money(p.amount)}</Td>
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
