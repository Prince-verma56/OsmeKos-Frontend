'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, type Paged, numberLocale } from '@/lib/api';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';

import { CardList, RecordCard } from '@/components/CardList';
import { DateRange, type Range } from '@/components/DateRange';
type SalesReturn = {
  id: string;
  returnNumber: string;
  status: string;
  receiveStatus: 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
  refundStatus: 'NOT_REFUNDED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  reason: string | null;
  returnTotal: string;
  refundAmount: string;
  returnedQuantity: number;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    customer: { id: string; firstName: string | null; lastName: string | null } | null;
  } | null;
  creditNotes: { id: string; creditNumber: string; grandTotal: string }[];
};

type Meta = Paged<SalesReturn>['meta'] & {
  counts: Record<string, number>;
  totals: { returned: number; refunded: number };
};

const RECEIVE_LABEL: Record<string, string> = {
  NOT_RECEIVED: 'Not received',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
};

const REFUND_LABEL: Record<string, string> = {
  NOT_REFUNDED: 'Not refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
};

const VIEWS = [
  { key: '', label: 'All' },
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'RECEIVED', label: 'Received' },
  { key: 'INSPECTED', label: 'Inspected' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;

const customerName = (r: SalesReturn) =>
  [r.order?.customer?.firstName, r.order?.customer?.lastName].filter(Boolean).join(' ') || '—';

export default function SalesReturnsPage() {
  const [rows, setRows] = useState<SalesReturn[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [receiveStatus, setReceiveStatus] = useState('');
  const [refundStatus, setRefundStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [range, setRange] = useState<Range>({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<SalesReturn>>('/returns', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        receiveStatus: receiveStatus || undefined,
        refundStatus: refundStatus || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, receiveStatus, refundStatus, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const counts = meta?.counts;
  const filtering = !!(search || status || receiveStatus || refundStatus);

  function exportSpec() {
    const columns: Column<SalesReturn>[] = [
      { header: 'Return', value: (r) => r.returnNumber, width: 100 },
      { header: 'Raised', value: (r) => shortDate(r.createdAt) },
      { header: 'Order', value: (r) => r.order?.orderNumber ?? '' },
      {
        header: 'Customer',
        value: (r) =>
          [r.order?.customer?.firstName, r.order?.customer?.lastName].filter(Boolean).join(' '),
        width: 150,
      },
      { header: 'Reason', value: (r) => r.reason ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Received', value: (r) => r.receiveStatus },
      { header: 'Refunded', value: (r) => r.refundStatus },
      { header: 'Quantity', value: (r) => r.returnedQuantity, align: 'right' as const },
      { header: 'Return value', value: (r) => Number(r.returnTotal), money: true },
      { header: 'Refund', value: (r) => Number(r.refundAmount), money: true },
      { header: 'Credit notes', value: (r) => r.creditNotes.map((c) => c.creditNumber).join(', ') },
    ];
    return {
      title: 'Sales returns',
      subtitle: `${sel.count || rows.length} return(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Receiving and refunding are tracked apart on purpose: goods can be back on the shelf ' +
        'before the money goes out, and stock only moves once the return is inspected.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Sales Returns"
        subtitle="Goods coming back from customers — receiving and refunding are tracked separately"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      {meta && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={filtering ? 'Value, this filter' : 'Total Returned'}
            value={money(meta.totals.returned)}
            sub={`${meta.total} return(s)`}
          />
          <StatCard label="Amount Refunded" value={money(meta.totals.refunded)} tone="amber" />
          <StatCard
            label="Awaiting Goods"
            value={String((counts?.REQUESTED ?? 0) + (counts?.APPROVED ?? 0))}
            sub="not received yet"
          />
          <StatCard
            label="Completed"
            value={String(counts?.COMPLETED ?? 0)}
            sub="closed out"
            tone="green"
          />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="return"
        endpoint="/returns/bulk-delete"
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
            placeholder="Search RMA number or sales order…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={(next) => { setRange(next); setPage(1); }} />
          <Select
            value={receiveStatus}
            onChange={(e) => {
              setReceiveStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any receive status</option>
            {Object.entries(RECEIVE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
          <Select
            value={refundStatus}
            onChange={(e) => {
              setRefundStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any refund status</option>
            {Object.entries(REFUND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setReceiveStatus('');
                setRefundStatus('');
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
            <CardList empty="No returns match those filters">
              {rows.map((r) => (
                <RecordCard
                  key={r.id}
                  href={`/admin/returns/${r.id}`}
                  title={r.returnNumber}
                  amount={money(r.returnTotal)}
                  date={shortDate(r.createdAt)}
                  note={
                    Number(r.refundAmount) > 0 ? `${money(r.refundAmount)} refunded` : undefined
                  }
                  primary={customerName(r)}
                  secondary={r.order ? `Order ${r.order.orderNumber}` : undefined}
                  footer={[
                    `${r.returnedQuantity.toLocaleString(numberLocale())} returned`,
                    r.creditNotes.length > 0
                      ? `${r.creditNotes.length} credit note${
                          r.creditNotes.length === 1 ? '' : 's'
                        }`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  select={
                    <SelectBox checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                  }
                  badges={
                    <>
                      <Badge status={r.status}>{r.status.replaceAll('_', ' ')}</Badge>
                      <Badge status={r.receiveStatus}>
                        {RECEIVE_LABEL[r.receiveStatus] ?? r.receiveStatus}
                      </Badge>
                      <Badge status={r.refundStatus}>
                        {REFUND_LABEL[r.refundStatus] ?? r.refundStatus}
                      </Badge>
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
                  <Th>RMA#</Th>
                  <Th>SALES ORDER#</Th>
                  <Th>CUSTOMER</Th>
                  <Th>STATUS</Th>
                  <Th>RECEIVE STATUS</Th>
                  <Th>REFUND STATUS</Th>
                  <Th className="text-right">RETURNED</Th>
                  <Th className="text-right">AMOUNT REFUNDED</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={10} message="No returns match those filters" />
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(r.createdAt)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/returns/${r.id}`}
                        className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                      >
                        {r.returnNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      {r.order ? (
                        <Link
                          href={`/admin/orders/${r.order.id}`}
                          className="text-gold-ink hover:underline"
                        >
                          {r.order.orderNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{customerName(r)}</Td>
                    <Td>
                      <Badge status={r.status}>{r.status.replaceAll('_', ' ')}</Badge>
                    </Td>
                    <Td>
                      <Badge status={r.receiveStatus}>
                        {RECEIVE_LABEL[r.receiveStatus] ?? r.receiveStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge status={r.refundStatus}>
                        {REFUND_LABEL[r.refundStatus] ?? r.refundStatus}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {r.returnedQuantity.toLocaleString(numberLocale())}
                      <span className="block text-[11px] text-muted-foreground">
                        {money(r.returnTotal)}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(r.refundAmount)}
                      {r.creditNotes.length > 0 && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {r.creditNotes.length} credit note(s)
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
