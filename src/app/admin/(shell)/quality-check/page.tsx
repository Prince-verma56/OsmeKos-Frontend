'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, errorMessage, shortDate, dateTime, type Paged } from '@/lib/api';
import { Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader, Pagination, Table, Td, Th } from '@/components/ui';
import { PageCrumb } from '@/lib/crumbs';
import { fmtQty } from '@/lib/quality';

type WaitingBatch = {
  id: string;
  batchNo: string | null;
  quantityRemaining: string;
  receivedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  receiveNumber: string | null;
  item: { id: string; name: string; sku: string | null; unit: string } | null;
  vendor: { id: string; displayName: string } | null;
};

type DoneCheck = {
  id: string;
  inspectionNumber: string;
  status: string;
  quantityInspected: string;
  quantityAccepted: string;
  quantityRejected: string;
  inspectedAt: string;
  inspectedBy: { id: string; name: string } | null;
  item: { id: string; name: string; sku: string | null } | null;
  lot: { id: string; batchNo: string | null } | null;
  receive: { id: string; receiveNumber: string } | null;
};

type Tab = 'WAITING' | 'DONE';

function QualityCheck() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'done' ? 'DONE' : 'WAITING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [waiting, setWaiting] = useState<Paged<WaitingBatch> | null>(null);
  const [done, setDone] = useState<Paged<DoneCheck> | null>(null);
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = { page, limit: pageSize, search: search.trim() || undefined };
      if (tab === 'WAITING') {
        const res = await api.get<Paged<WaitingBatch>>('/batches', { ...query, status: 'PENDING_QC', inStock: 'true' });
        setWaiting(res);
        setWaitingCount(res.meta.total);
      } else {
        const [res, pending] = await Promise.all([
          api.get<Paged<DoneCheck>>('/quality/inspections', { ...query, status: 'COMPLETED' }),
          api.get<Paged<WaitingBatch>>('/batches', { status: 'PENDING_QC', inStock: 'true', limit: 1 }),
        ]);
        setDone(res);
        setWaitingCount(pending.meta.total);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const meta = tab === 'WAITING' ? waiting?.meta : done?.meta;

  const tabs: { key: Tab; label: string; count?: number | null }[] = [
    { key: 'WAITING', label: 'Waiting for QC', count: waitingCount },
    { key: 'DONE', label: 'QC done' },
  ];

  return (
    <>
      <PageCrumb label="Quality check" />
      <PageHeader
        title="Quality check"
        subtitle="Batches from purchase receives that still need checking, and the checks already done"
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`relative -mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                tab === t.key
                  ? 'border-border font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 text-xs font-medium text-warning">{t.count}</span>
              )}
            </button>
          ))}
          <Input
            placeholder={tab === 'WAITING' ? 'Search batch or item…' : 'Search batch, item or QC number…'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="my-2 ml-auto max-w-xs"
          />
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBox message={error} onRetry={load} />
          </div>
        ) : loading && !(tab === 'WAITING' ? waiting : done) ? (
          <Loading />
        ) : tab === 'WAITING' ? (
          <Table>
            <thead>
              <tr>
                <Th>Batch</Th>
                <Th>Item</Th>
                <Th>Receipt</Th>
                <Th>Vendor</Th>
                <Th className="text-right">Waiting</Th>
                <Th>Received</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {(waiting?.data.length ?? 0) === 0 && (
                <EmptyRow colSpan={7} message="Nothing is waiting for a quality check" />
              )}
              {waiting?.data.map((b) => {
                const qcHref =
                  b.sourceType === 'purchase_receive' && b.sourceId ? `/purchase-receives/${b.sourceId}/qc/${b.id}` : null;
                return (
                  <tr key={b.id} className="hover:bg-muted/60">
                    <Td className="font-mono text-xs">{b.batchNo ?? '—'}</Td>
                    <Td>
                      <div className="font-medium">{b.item?.name ?? '—'}</div>
                      {b.item?.sku && <div className="font-mono text-xs text-muted-foreground">{b.item.sku}</div>}
                    </Td>
                    <Td>
                      {b.sourceId && b.receiveNumber ? (
                        <Link href={`/admin/purchase-receives/${b.sourceId}`} className="font-mono text-xs text-gold-ink hover:underline">
                          {b.receiveNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{b.vendor?.displayName ?? '—'}</Td>
                    <Td className="text-right tabular-nums">
                      {fmtQty(b.quantityRemaining)} <span className="text-xs text-muted-foreground">{b.item?.unit}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {b.receivedAt ? shortDate(b.receivedAt) : '—'}
                    </Td>
                    <Td className="text-right">
                      {qcHref && (
                        <Link href={qcHref}>
                          <Button size="sm" variant="primary">Check now</Button>
                        </Link>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>QC#</Th>
                <Th>Batch</Th>
                <Th>Item</Th>
                <Th>Receipt</Th>
                <Th className="text-right">Accepted</Th>
                <Th className="text-right">Rejected</Th>
                <Th>Checked</Th>
              </tr>
            </thead>
            <tbody>
              {(done?.data.length ?? 0) === 0 && <EmptyRow colSpan={7} message="No quality checks done yet" />}
              {done?.data.map((c) => {
                const qcHref = c.receive && c.lot ? `/purchase-receives/${c.receive.id}/qc/${c.lot.id}` : null;
                const rejected = Number(c.quantityRejected);
                return (
                  <tr key={c.id} className="hover:bg-muted/60">
                    <Td className="font-mono text-xs">
                      {qcHref ? (
                        <Link href={qcHref} className="text-gold-ink hover:underline">
                          {c.inspectionNumber}
                        </Link>
                      ) : (
                        c.inspectionNumber
                      )}
                    </Td>
                    <Td className="font-mono text-xs">{c.lot?.batchNo ?? '—'}</Td>
                    <Td className="font-medium">{c.item?.name ?? '—'}</Td>
                    <Td>
                      {c.receive ? (
                        <Link href={`/admin/purchase-receives/${c.receive.id}`} className="font-mono text-xs text-gold-ink hover:underline">
                          {c.receive.receiveNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="text-right tabular-nums text-success">{fmtQty(c.quantityAccepted)}</Td>
                    <Td className="text-right tabular-nums">
                      {rejected > 0 ? <Badge tone="red">{fmtQty(c.quantityRejected)}</Badge> : '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(c.inspectedAt)}
                      {c.inspectedBy?.name ? ` · ${c.inspectedBy.name}` : ''}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {meta && meta.total > 0 && (
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
      </div>
    </>
  );
}

export default function QualityCheckPage() {
  return (
    <Suspense fallback={<Loading />}>
      <QualityCheck />
    </Suspense>
  );
}
