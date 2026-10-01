'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, shortDate, errorMessage, type Paged, numberLocale } from '@/lib/api';
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
import { useAuth } from '@/lib/auth';
import { DateRange, type Range } from '@/components/DateRange';
import { fmtQty, type QcSummary } from '@/lib/quality';
type Receive = {
  id: string;
  receiveNumber: string;
  receiveDate: string;
  status: string;
  billedStatus: string;
  quantity: number;
  trackingNumber: string | null;
  vendor: { id: string; displayName: string } | null;
  purchaseOrder: { id: string; poNumber: string } | null;
  bill: { id: string; billNumber: string } | null;
  location: { id: string; name: string; code: string } | null;
  qc?: QcSummary;
};

function QcCell({ qc }: { qc?: QcSummary }) {
  if (!qc || qc.state === 'NONE') return <span className="text-muted-foreground">—</span>;
  if (qc.state === 'PENDING') return <Badge tone="amber">{fmtQty(qc.pending)} waiting</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone="green">Done</Badge>
      {qc.rejected > 0 && <Badge tone="red">{fmtQty(qc.rejected)} rejected</Badge>}
    </span>
  );
}

type Meta = Paged<Receive>['meta'] & { counts: Record<string, number> };

type Vendor = { id: string; displayName: string };

const VIEWS = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'RECEIVED', label: 'Received' },
] as const;

const BILLED_TONE: Record<string, 'green' | 'amber' | 'gray'> = {
  FULL: 'green',
  PARTIAL: 'amber',
  NONE: 'gray',
};

export default function PurchaseReceivesPage() {
  const [rows, setRows] = useState<Receive[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [billedStatus, setBilledStatus] = useState('');
  const params = useSearchParams();
  const router = useRouter();
  const [qc, setQc] = useState<'' | 'PENDING' | 'DONE'>('');

  useEffect(() => {
    const asked = params.get('qc');
    if (asked === 'PENDING' || asked === 'DONE') {
      router.replace(asked === 'DONE' ? '/quality-check?tab=done' : '/quality-check');
    }
  }, [params, router]);
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
      const res = await api.get<Paged<Receive>>('/purchase-receives', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        billedStatus: billedStatus || undefined,
        qc: qc || undefined,
        vendorId: vendorId || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, billedStatus, qc, vendorId, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const counts = meta?.counts;

  function exportSpec() {
    const columns: Column<Receive>[] = [
      { header: 'Receive', value: (r) => r.receiveNumber, width: 100 },
      { header: 'Date', value: (r) => shortDate(r.receiveDate) },
      { header: 'Vendor', value: (r) => r.vendor?.displayName ?? '', width: 150 },
      { header: 'Purchase order', value: (r) => r.purchaseOrder?.poNumber ?? '' },
      { header: 'Bill', value: (r) => r.bill?.billNumber ?? '' },
      { header: 'Into', value: (r) => r.location?.name ?? '' },
      { header: 'Quantity', value: (r) => r.quantity, align: 'right' as const },
      { header: 'Tracking', value: (r) => r.trackingNumber ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Billed', value: (r) => r.billedStatus },
      {
        header: 'QC',
        value: (r) =>
          !r.qc || r.qc.state === 'NONE'
            ? ''
            : r.qc.state === 'PENDING'
              ? `${r.qc.pending} waiting`
              : `Done${r.qc.rejected ? ` - ${r.qc.rejected} rejected` : ''}`,
      },
    ];
    return {
      title: 'Purchase receives',
      subtitle: `${sel.count || rows.length} receive(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Receiving is the only step that raises on-hand stock. Each line here has a matching ' +
        'entry in the stock ledger.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Receipts & QC"
        subtitle="Goods arriving against a purchase order. Everything received waits for QC before it can be labelled or sold."
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/purchase-receives/new">
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

      <BulkBar
        count={sel.count}
        noun="receive"
        endpoint="/purchase-receives/bulk-delete"
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
            const n = counts ? (v.key === '' ? counts.ALL : counts[v.key]) : undefined;
            const active = status === v.key && !qc && !billedStatus;
            return (
              <button
                key={v.key}
                onClick={() => {
                  setStatus(v.key);
                  setBilledStatus('');
                  setQc('');
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
          {!!counts?.PENDING_QC && (
            <Link
              href="/admin/quality-check"
              className="relative -mb-px whitespace-nowrap border-b-2 border-transparent py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Waiting for QC <span className="ml-1 text-xs font-medium text-warning">{counts.PENDING_QC}</span> →
            </Link>
          )}
          {(['FULL', 'PARTIAL'] as const).map((b) => (
            <button
              key={b}
              onClick={() => {
                setBilledStatus(billedStatus === b ? '' : b);
                setStatus('');
                setQc('');
                setPage(1);
              }}
              className={`relative -mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                billedStatus === b
                  ? 'border-border font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {b === 'FULL' ? 'Billed' : 'Partially Billed'}
              {counts && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {b === 'FULL' ? counts.BILLED : counts.PARTIALLY_BILLED}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search receive number, PO or vendor…"
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
          {(search || status || billedStatus || qc || vendorId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
                setBilledStatus('');
                setQc('');
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
            <CardList empty="No purchase receives match those filters">
              {rows.map((r) => (
                <RecordCard
                  key={r.id}
                  href={`/admin/purchase-receives/${r.id}`}
                  title={r.receiveNumber}
                  actions={
                    r.status === 'DRAFT' && can('purchase-receives:write') ? (
                      <CardAction href={`/admin/purchase-receives/${r.id}/edit`}>Receive</CardAction>
                    ) : undefined
                  }
                  amount={r.quantity.toLocaleString(numberLocale(), { minimumFractionDigits: 2 })}
                  date={shortDate(r.receiveDate)}
                  primary={r.vendor?.displayName ?? '—'}
                  secondary={
                    r.purchaseOrder
                      ? `Against ${r.purchaseOrder.poNumber}`
                      : r.bill
                        ? `Against bill ${r.bill.billNumber}`
                        : 'No purchase order'
                  }
                  select={
                    <SelectBox checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                  }
                  badges={
                    <>
                      <Badge status={r.status}>{r.status.replaceAll('_', ' ')}</Badge>
                      <Badge tone={BILLED_TONE[r.billedStatus] ?? 'gray'}>
                        {r.billedStatus === 'FULL'
                          ? 'Billed'
                          : r.billedStatus === 'PARTIAL'
                            ? 'Part billed'
                            : 'Unbilled'}
                      </Badge>
                      {r.qc && r.qc.state !== 'NONE' && <QcCell qc={r.qc} />}
                    </>
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="900px">
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
                  <Th>PURCHASE RECEIVE#</Th>
                  <Th>PURCHASE ORDER#</Th>
                  <Th>VENDOR NAME</Th>
                  <Th>STATUS</Th>
                  <Th>QC</Th>
                  <Th>BILLED</Th>
                  <Th className="text-right">QUANTITY</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={10} message="No purchase receives match those filters" />
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(r.receiveDate)}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/purchase-receives/${r.id}`}
                        className="font-mono font-medium text-gold-ink hover:underline"
                      >
                        {r.receiveNumber}
                      </Link>
                    </Td>
                    <Td>
                      {r.purchaseOrder ? (
                        <Link
                          href={`/admin/purchase-orders/${r.purchaseOrder.id}`}
                          className="font-mono hover:underline"
                        >
                          {r.purchaseOrder.poNumber}
                        </Link>
                      ) : r.bill ? (
                        <Link href={`/admin/bills/${r.bill.id}`} className="font-mono hover:underline">
                          {r.bill.billNumber}
                          <span className="ml-1 font-sans text-xs text-muted-foreground">bill</span>
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{r.vendor?.displayName ?? '—'}</Td>
                    <Td>
                      <Badge status={r.status}>{r.status.replaceAll('_', ' ')}</Badge>
                    </Td>
                    <Td>
                      <QcCell qc={r.qc} />
                    </Td>
                    <Td>
                      <Badge tone={BILLED_TONE[r.billedStatus] ?? 'gray'}>
                        {r.billedStatus === 'FULL'
                          ? 'Billed'
                          : r.billedStatus === 'PARTIAL'
                            ? 'Partial'
                            : '—'}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium">
                      {r.quantity.toLocaleString(numberLocale(), { minimumFractionDigits: 2 })}
                    </Td>
                    <Td className="text-right">
                      {r.status === 'DRAFT' && can('purchase-receives:write') && (
                        <Link href={`/admin/purchase-receives/${r.id}/edit`}>
                          <Button size="sm" variant="primary">Receive</Button>
                        </Link>
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

      <p className="mt-3 text-xs text-muted-foreground">
        A draft or in-transit note moves no stock. <strong>Received</strong> clears the incoming expectation and
        adds to on hand, but the goods stay unavailable until they pass QC.
      </p>
    </>
  );
}
