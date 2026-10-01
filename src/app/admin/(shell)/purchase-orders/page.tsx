'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, dateTime, shortDate, errorMessage, type Paged } from '@/lib/api';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, Table, Td, Th,
} from '@/components/ui';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';

import { CardList, RecordCard, CardAction } from '@/components/CardList';
import { DateRange, type Range } from '@/components/DateRange';
type PO = {
  id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  referenceNumber: string | null;
  status: string;
  receivedStatus: string;
  billedStatus: string;
  grandTotal: string;
  originalGrandTotal?: string | null;
  amendmentCount?: number;
  vendor: { id: string; displayName: string } | null;
  location: { id: string; code: string; name: string } | null;
  lines?: { id: string }[];
  _count?: { lines: number };
};

type Vendor = { id: string; displayName: string };

const RECEIVED_TONE: Record<string, 'green' | 'amber' | 'gray'> = {
  FULL: 'green',
  PARTIAL: 'amber',
  NONE: 'gray',
};

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PO[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Paged<PO>['meta'] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [receivedStatus, setReceivedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    api
      .get<Paged<Vendor>>('/vendors', { limit: 100 })
      .then((r) => setVendors(r.data))
      .catch(() => {});
  }, []);

  const [range, setRange] = useState<Range>({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<PO>>('/purchase-orders', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        vendorId: vendorId || undefined,
        receivedStatus: receivedStatus || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, vendorId, receivedStatus, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function exportSpec() {
    const columns: Column<PO>[] = [
      { header: 'PO', value: (r) => r.poNumber, width: 90 },
      { header: 'Date', value: (r) => shortDate(r.poDate) },
      { header: 'Expected', value: (r) => (r.expectedDeliveryDate ? shortDate(r.expectedDeliveryDate) : '') },
      { header: 'Vendor', value: (r) => r.vendor?.displayName ?? '', width: 150 },
      { header: 'Deliver to', value: (r) => r.location?.name ?? '' },
      { header: 'Reference', value: (r) => r.referenceNumber ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Received', value: (r) => r.receivedStatus },
      { header: 'Billed', value: (r) => r.billedStatus },
      { header: 'Total', value: (r) => Number(r.grandTotal), money: true },
    ];
    return {
      title: 'Purchase orders',
      subtitle: `${sel.count || rows.length} order(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Receiving goods is what adds stock, not raising the order. A PO can be fully billed ' +
        'while still part received, and the other way round.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Ordering stock in — receiving a PO is what raises on-hand quantity"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
            <Link href="/admin/purchase-orders/new">
              <Button variant="primary">+ New purchase order</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="purchase order"
        endpoint="/purchase-orders/bulk-delete"
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
            placeholder="Search PO number or reference…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={(next) => { setRange(next); setPage(1); }} />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any status</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_RECEIVED">Partially received</option>
            <option value="RECEIVED">Received</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName}
              </option>
            ))}
          </Select>
          <Select
            value={receivedStatus}
            onChange={(e) => {
              setReceivedStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any receipt state</option>
            <option value="NONE">Nothing received</option>
            <option value="PARTIAL">Partially received</option>
            <option value="FULL">Fully received</option>
          </Select>
          {(search || status || vendorId || receivedStatus) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setVendorId('');
                setReceivedStatus('');
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
            <CardList empty="No purchase orders match those filters">
              {rows.map((p) => (
                <RecordCard
                  key={p.id}
                  href={`/admin/purchase-orders/${p.id}`}
                  title={p.poNumber}
                  amount={money(p.grandTotal)}
                  date={dateTime(p.poDate).split(',')[0]}
                  note={
                    p.expectedDeliveryDate
                      ? `due ${dateTime(p.expectedDeliveryDate).split(',')[0]}`
                      : undefined
                  }
                  primary={p.vendor?.displayName ?? '—'}
                  secondary={[p.location?.name ?? p.location?.code, p.referenceNumber]
                    .filter(Boolean)
                    .join(' · ')}
                  select={
                    <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                  }
                  badges={
                    <>
                      <Badge status={p.status}>{p.status.replaceAll('_', ' ')}</Badge>
                      <Badge tone={RECEIVED_TONE[p.receivedStatus] ?? 'gray'}>
                        {p.receivedStatus}
                      </Badge>
                      <Badge tone={RECEIVED_TONE[p.billedStatus] ?? 'gray'}>{p.billedStatus}</Badge>
                    </>
                  }
                  actions={
                    <>
                      {p.status === 'DRAFT' && (
                        <CardAction href={`/admin/purchase-orders/${p.id}`} variant="primary">
                          Issue
                        </CardAction>
                      )}
                      {['ISSUED', 'PARTIALLY_RECEIVED'].includes(p.status) && (
                        <CardAction href={`/admin/purchase-orders/${p.id}`} variant="success">
                          Receive
                        </CardAction>
                      )}
                      <CardAction href={`/admin/purchase-orders/${p.id}`}>View</CardAction>
                    </>
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th className="w-8">
                    <SelectAllBox
                      checked={sel.allOnPage}
                      indeterminate={sel.someOnPage}
                      onChange={sel.toggleAll}
                    />
                  </Th>
                  <Th>Date</Th>
                  <Th>Location</Th>
                  <Th>Purchase order#</Th>
                  <Th>Reference#</Th>
                  <Th>Vendor name</Th>
                  <Th>Status</Th>
                  <Th>Received</Th>
                  <Th>Billed</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Delivery date</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={12} message="No purchase orders match those filters" />
                )}
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(p.poDate).split(',')[0]}
                    </Td>
                    <Td className="text-xs">
                      {p.location?.name ?? p.location?.code ?? '—'}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/purchase-orders/${p.id}`}
                        className="font-mono font-medium text-gold-ink hover:underline"
                      >
                        {p.poNumber}
                      </Link>
                    </Td>
                    <Td className="text-xs">{p.referenceNumber ?? '—'}</Td>
                    <Td>{p.vendor?.displayName ?? '—'}</Td>
                    <Td>
                      <Badge status={p.status}>{p.status.replaceAll('_', ' ')}</Badge>
                      {!!p.amendmentCount && (
                        <Badge tone="amber" className="ml-1.5">
                          Amended
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={RECEIVED_TONE[p.receivedStatus] ?? 'gray'}>
                        {p.receivedStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={RECEIVED_TONE[p.billedStatus] ?? 'gray'}>{p.billedStatus}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium">
                      {money(p.grandTotal)}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {p.expectedDeliveryDate ? dateTime(p.expectedDeliveryDate).split(',')[0] : '—'}
                    </Td>
                    <Td>
                      <div className="flex gap-1.5 whitespace-nowrap">
                        <Link href={`/admin/purchase-orders/${p.id}`}>
                          <Button size="sm">View</Button>
                        </Link>
                        {p.status === 'DRAFT' && (
                          <Link href={`/admin/purchase-orders/${p.id}`}>
                            <Button size="sm" variant="primary">Issue</Button>
                          </Link>
                        )}
                        {['ISSUED', 'PARTIALLY_RECEIVED'].includes(p.status) && (
                          <Link href={`/admin/purchase-orders/${p.id}`}>
                            <Button size="sm" variant="success">Receive</Button>
                          </Link>
                        )}
                      </div>
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

      <p className="mt-3 text-xs text-muted-foreground">
        Issuing a PO adds the quantity to <strong>incoming</strong>. Receiving moves it out of
        incoming and into <strong>on hand</strong>, creating a costed batch for FIFO.
      </p>
    </>
  );
}
