'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, errorMessage, shortDate, type Paged } from '@/lib/api';
import { Badge, EmptyRow, ErrorBox, Input, Loading, PageHeader, Pagination, Select, Table, Td, Th } from '@/components/ui';
import { CardList, RecordCard } from '@/components/CardList';
import { fmtQty, lotStatusOf, needsLabel, type LotStatus } from '@/lib/quality';
import { ExpiryCell } from '@/components/quality/ExpiryCell';

type Batch = {
  id: string;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  status: LotStatus;
  quantityReceived: string;
  quantityRemaining: string;
  sourceType: string | null;
  needsLabelling: boolean;
  labelledAt: string | null;
  locationName: string | null;
  item: { id: string; name: string; sku: string | null; unit: string; itemCategory: string };
  vendor: { id: string; displayName: string } | null;
};

type Meta = Paged<Batch>['meta'] & { counts: Record<string, number> };

const VIEWS: { key: string; label: string; query: Record<string, string | number> }[] = [
  { key: 'stock', label: 'In stock', query: { inStock: 'true', status: 'AVAILABLE' } },
  { key: 'expiring', label: 'Expiring in 90 days', query: { expiringWithinDays: 90, inStock: 'true' } },
  { key: 'toLabel', label: 'Waiting for labelling', query: { toLabel: 'true' } },
  { key: 'PENDING_QC', label: 'Waiting for QC', query: { status: 'PENDING_QC' } },
  { key: 'EXPIRED', label: 'Expired', query: { status: 'EXPIRED' } },
  { key: 'RECALLED', label: 'Recalled', query: { status: 'RECALLED' } },
  { key: 'REJECTED', label: 'Rejected', query: { status: 'REJECTED' } },
  { key: 'all', label: 'All', query: {} },
];

const CATEGORIES = [
  { value: '', label: 'All kinds' },
  { value: 'FINISHED_GOOD', label: 'Finished products' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'RAW_MATERIAL', label: 'Raw materials' },
];

export default function BatchesPage() {
  const params = useSearchParams();
  const [view, setView] = useState(() => {
    const asked = params.get('view');
    return VIEWS.some((v) => v.key === asked) ? (asked as string) : 'stock';
  });
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Batch[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
      const res = await api.get<Paged<Batch>>('/batches', {
        page,
        limit: 20,
        ...current.query,
        itemCategory: category || undefined,
        search: search || undefined,
      });
      setRows(res.data);
      setMeta(res.meta as Meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [view, category, search, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const countFor = (key: string) => {
    const c = meta?.counts;
    if (!c) return undefined;
    if (key === 'expiring') return c.EXPIRING_90;
    if (key === 'toLabel') return c.TO_LABEL;
    if (key === 'stock' || key === 'all') return undefined;
    return c[key];
  };

  return (
    <>
      <PageHeader
        title="Batches"
        subtitle="Every batch: what is left, when it expires, and where each unit went."
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex gap-5 overflow-x-auto border-b border-border px-4">
          {VIEWS.map((v) => {
            const count = countFor(v.key);
            return (
              <button
                key={v.key}
                onClick={() => {
                  setView(v.key);
                  setPage(1);
                }}
                className={`relative -mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                  view === v.key ? 'border-border font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {v.label}
                {count !== undefined && count > 0 && (
                  <span className={`ml-1.5 text-xs ${v.key === 'RECALLED' || v.key === 'expiring' || v.key === 'toLabel' ? 'font-medium text-warning' : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search batch number or product…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty="No batches match">
              {rows.map((b) => {
                const status = lotStatusOf(b.status);
                return (
                  <RecordCard
                    key={b.id}
                    href={`/admin/batches/${b.id}`}
                    title={b.batchNo ?? 'No batch no.'}
                    amount={`${fmtQty(b.quantityRemaining)} left`}
                    primary={b.item.name}
                    secondary={b.expiryDate ? `Expires ${shortDate(b.expiryDate)}` : 'No expiry'}
                    badges={
                      <>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {needsLabel(b) && <Badge tone="amber">Not labelled</Badge>}
                      </>
                    }
                  />
                );
              })}
            </CardList>
            <div className="hidden md:block">
              <Table minWidth="900px">
                <thead>
                  <tr>
                    <Th>BATCH</Th>
                    <Th>PRODUCT / ITEM</Th>
                    <Th>STATUS</Th>
                    <Th>MFG</Th>
                    <Th>EXPIRY</Th>
                    <Th className="text-right">LEFT</Th>
                    <Th>LOCATION</Th>
                    <Th>FROM</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <EmptyRow colSpan={8} message="No batches match" />}
                  {rows.map((b) => {
                    const status = lotStatusOf(b.status);
                    return (
                      <tr key={b.id} className="hover:bg-muted/60">
                        <Td>
                          <Link href={`/admin/batches/${b.id}`} className="font-mono font-medium text-gold-ink hover:underline">
                            {b.batchNo ?? 'No batch no.'}
                          </Link>
                        </Td>
                        <Td>
                          <div className="min-w-48">{b.item.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{b.item.sku}</div>
                        </Td>
                        <Td>
                          <span className="flex flex-wrap gap-1">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {needsLabel(b) && <Badge tone="amber">Not labelled</Badge>}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-muted-foreground">{b.mfgDate ? shortDate(b.mfgDate) : '—'}</Td>
                        <Td>
                          <ExpiryCell date={b.expiryDate} days={b.daysToExpiry} />
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          <strong>{fmtQty(b.quantityRemaining)}</strong>
                          <span className="text-xs text-muted-foreground"> / {fmtQty(b.quantityReceived)}</span>
                        </Td>
                        <Td className="text-muted-foreground">{b.locationName ?? '—'}</Td>
                        <Td className="text-muted-foreground">
                          {b.sourceType === 'inventory_document' ? 'Transfer' : b.vendor?.displayName ?? 'Opening stock'}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />}
          </>
        )}
      </div>
    </>
  );
}
