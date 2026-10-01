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
type Credit = {
  id: string;
  creditNumber: string;
  creditDate: string;
  referenceNumber: string | null;
  reason: string | null;
  status: string;
  grandTotal: string;
  amountApplied: string;
  balance: string;
  stockReturned: boolean;
  vendor: { id: string; displayName: string } | null;
  location: { id: string; name: string } | null;
  _count?: { lines: number; applications: number };
};

type Meta = Paged<Credit>['meta'] & {
  totals: { filtered: number; remaining: number; openCredits: number };
};

type Vendor = { id: string; displayName: string };

const STATUSES = ['', 'DRAFT', 'OPEN', 'CLOSED', 'VOID'];

export default function VendorCreditsPage() {
  const [rows, setRows] = useState<Credit[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Meta | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
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
      const res = await api.get<Paged<Credit>>('/vendor-credits', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        vendorId: vendorId || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, status, vendorId, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totals = meta?.totals;
  const filtering = !!(search || status || vendorId);
  const emptyMessage =
    filtering || range.from || range.to
      ? 'No vendor credits match those filters'
      : 'No vendor credits yet. Record one when a supplier gives you credit for returned or faulty goods.';

  function exportSpec() {
    const columns: Column<Credit>[] = [
      { header: 'Credit', value: (r) => r.creditNumber, width: 100 },
      { header: 'Date', value: (r) => shortDate(r.creditDate) },
      { header: 'Vendor', value: (r) => r.vendor?.displayName ?? '', width: 150 },
      { header: 'Reference', value: (r) => r.referenceNumber ?? '' },
      { header: 'Reason', value: (r) => r.reason ?? '' },
      { header: 'Returned to stock', value: (r) => (r.stockReturned ? 'Yes' : 'No') },
      { header: 'Status', value: (r) => r.status },
      { header: 'Total', value: (r) => Number(r.grandTotal), money: true },
      { header: 'Applied', value: (r) => Number(r.amountApplied), money: true },
      { header: 'Balance', value: (r) => Number(r.balance), money: true },
    ];
    return {
      title: 'Vendor credits',
      subtitle: `${sel.count || rows.length} credit(s)`,
      columns,
      rows: sel.pick(rows),
      footnote:
        'Balance is credit still available to set against a future bill. Returning goods to the ' +
        'vendor takes them out of stock, which is what the returned column records.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Vendor Credits"
        subtitle="What a supplier owes us back — returned goods, short shipments, overcharges"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
  <Link href="/admin/vendor-credits/new">
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
          <StatCard
            label="Credits Remaining"
            value={money(totals.openCredits)}
            sub="still to be used against a bill"
            tone={totals.openCredits > 0 ? 'purple' : 'slate'}
          />
          <StatCard
            label={filtering ? 'Matching this filter' : 'Raised in total'}
            value={money(totals.filtered)}
            sub={`${meta?.total ?? 0} credit note(s)`}
          />
          <StatCard label="Unused of these" value={money(totals.remaining)} sub="balance on the rows below" />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="credit"
        endpoint="/vendor-credits/bulk-delete"
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
            placeholder="Search credit note, reference, reason or vendor…"
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
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All statuses'}
              </option>
            ))}
          </Select>
          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('');
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
            <CardList empty={emptyMessage}>
              {rows.map((c) => (
                <RecordCard
                  key={c.id}
                  href={`/admin/vendor-credits/${c.id}`}
                  title={c.creditNumber}
                  amount={money(c.grandTotal)}
                  date={shortDate(c.creditDate)}
                  note={Number(c.balance) > 0 ? `${money(c.balance)} unapplied` : undefined}
                  primary={c.vendor?.displayName ?? '—'}
                  secondary={c.referenceNumber ?? undefined}
                  alert={c.stockReturned ? 'Goods have gone back to the supplier' : undefined}
                  footer={c.location?.name ?? undefined}
                  select={
                    <SelectBox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                  }
                  badges={<Badge status={c.status}>{c.status}</Badge>}
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="980px">
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
                  <Th>VENDOR NAME</Th>
                  <Th>LOCATION</Th>
                  <Th>STATUS</Th>
                  <Th className="text-right">AMOUNT</Th>
                  <Th className="text-right">BALANCE</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={9} message={emptyMessage} />
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
                        href={`/admin/vendor-credits/${c.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {c.creditNumber}
                      </Link>
                      {c.stockReturned && (
                        <span
                          className="ml-1.5 text-[11px] text-muted-foreground"
                          title="Goods have gone back to the supplier"
                        >
                          goods returned
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">{c.referenceNumber ?? '—'}</Td>
                    <Td>{c.vendor?.displayName ?? '—'}</Td>
                    <Td className="text-xs">{c.location?.name ?? '—'}</Td>
                    <Td>
                      <Badge status={c.status}>{c.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right">{money(c.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{money(c.balance)}</Td>
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
