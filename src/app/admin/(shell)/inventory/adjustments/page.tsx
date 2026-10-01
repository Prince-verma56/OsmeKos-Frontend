'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, dateTime, errorMessage, type Paged } from '@/lib/api';
import {
  useRowSelection, SelectAllBox, SelectBox, BulkBar,
} from '@/components/BulkActions';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, Table, Td, Th,
} from '@/components/ui';

import { CardList, RecordCard } from '@/components/CardList';
import { DateRange, type Range } from '@/components/DateRange';
type Doc = {
  id: string;
  docNumber: string;
  type: 'ADJUSTMENT' | 'TRANSFER';
  mode: 'QUANTITY' | 'VALUE' | null;
  referenceNumber: string | null;
  documentDate: string;
  reason: string | null;
  description: string | null;
  status: 'DRAFT' | 'ADJUSTED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  createdAt: string;
  location: { id: string; name: string; code: string } | null;
  toLocation?: { id: string; name: string; code: string } | null;
  lines: {
    id: string;
    quantityAdjusted: string | null;
    quantitySent?: string | null;
    item: { name: string };
  }[];
};

const placeOf = (d: Doc) =>
  d.type === 'TRANSFER' ? `${d.location?.code ?? '?'} → ${d.toLocation?.code ?? '?'}` : d.location?.code;

const lineQty = (d: Doc, l: Doc['lines'][number]) =>
  d.type === 'TRANSFER' ? Number(l.quantitySent ?? 0) : l.quantityAdjusted === null ? null : Number(l.quantityAdjusted);

export default function AdjustmentsPage() {
  const [rows, setRows] = useState<Doc[]>([]);
  const sel = useRowSelection(rows.map((r) => r.id));
  const [meta, setMeta] = useState<Paged<Doc>['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [range, setRange] = useState<Range>({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paged<Doc>>('/inventory/documents', {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: 20,
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, page, search, type, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function post(id: string) {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/inventory/adjustments/${id}/post`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  async function transfer(id: string, step: 'dispatch' | 'receive') {
    if (step === 'receive' && !confirm('Mark this transfer received? The stock becomes on hand at the destination.')) return;
    setBusyId(id);
    setError('');
    try {
      await api.post(`/inventory/transfers/${id}/${step}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  function rowActions(d: Doc) {
    const busy = busyId === d.id;
    if (d.type === 'TRANSFER' && d.status === 'IN_TRANSIT') {
      return (
        <Button size="sm" variant="success" disabled={busy} onClick={() => transfer(d.id, 'receive')}>
          Receive
        </Button>
      );
    }
    if (d.status !== 'DRAFT') return undefined;
    return (
      <>
        <Button
          size="sm"
          variant="success"
          disabled={busy}
          onClick={() => (d.type === 'TRANSFER' ? transfer(d.id, 'dispatch') : post(d.id))}
        >
          {d.type === 'TRANSFER' ? 'Send' : 'Post'}
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => cancel(d.id)}>
          Cancel
        </Button>
      </>
    );
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this draft?')) return;
    setBusyId(id);
    try {
      await api.post(`/inventory/documents/${id}/cancel`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <PageHeader
        title="Inventory adjustments"
        subtitle="Quantity corrections and stock transfers"
        actions={
          <>
            <Link href="/admin/inventory/transfers/new">
              <Button>+ New transfer</Button>
            </Link>
            <Link href="/admin/inventory/adjustments/new">
              <Button variant="primary">+ New adjustment</Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <BulkBar
        count={sel.count}
        noun="adjustment"
        endpoint="/inventory/documents/bulk-delete"
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
            placeholder="Search by number or reference…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={(next) => { setRange(next); setPage(1); }} />
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="ADJUSTMENT">Adjustments</option>
            <option value="TRANSFER">Transfers</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ADJUSTED">Adjusted</option>
            <option value="IN_TRANSIT">In transit</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty="No adjustments yet">
              {rows.map((d) => {
                const net = d.type === 'TRANSFER' ? 0 : d.lines.reduce((a, l) => a + Number(l.quantityAdjusted ?? 0), 0);
                return (
                  <RecordCard
                    key={d.id}
                    href={`/admin/inventory/adjustments/${d.id}`}
                    title={d.docNumber}
                    amount={
                      net === 0 ? undefined : (
                        <span
                          className={
                            net > 0
                              ? 'text-success'
                              : 'text-destructive'
                          }
                        >
                          {net > 0 ? '+' : ''}
                          {net}
                        </span>
                      )
                    }
                    date={dateTime(d.documentDate).split(',')[0]}
                    primary={
                      d.lines
                        .slice(0, 2)
                        .map((l) => l.item.name)
                        .join(', ') +
                      (d.lines.length > 2 ? ` +${d.lines.length - 2} more` : '')
                    }
                    secondary={
                      d.reason ? d.reason.replaceAll('_', ' ').toLowerCase() : d.description
                    }
                    footer={[placeOf(d), d.referenceNumber ? `ref ${d.referenceNumber}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                    select={
                      <SelectBox checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} />
                    }
                    badges={
                      <>
                        <Badge tone={d.type === 'TRANSFER' ? 'blue' : 'gray'}>
                          {d.type === 'TRANSFER'
                            ? 'Transfer'
                            : (d.mode ?? 'QUANTITY').toLowerCase()}
                        </Badge>
                        <Badge status={d.status}>{d.status.replaceAll('_', ' ')}</Badge>
                      </>
                    }
                    actions={rowActions(d)}
                  />
                );
              })}
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
                  <Th>Document</Th>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Reason</Th>
                  <Th>Location</Th>
                  <Th>Items</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={9} message="No adjustments yet" />}
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/60">
                    <Td>
                      <SelectBox checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} />
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/inventory/adjustments/${d.id}`}
                        className="font-mono font-medium text-gold-ink hover:underline"
                      >
                        {d.docNumber}
                      </Link>
                      {d.referenceNumber && (
                        <div className="text-xs text-muted-foreground">
                          ref {d.referenceNumber}
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateTime(d.documentDate).split(',')[0]}
                    </Td>
                    <Td>
                      <Badge tone={d.type === 'TRANSFER' ? 'blue' : 'gray'}>
                        {d.type === 'TRANSFER' ? 'Transfer' : (d.mode ?? 'QUANTITY').toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className="text-xs">
                      {d.reason ? d.reason.replaceAll('_', ' ').toLowerCase() : '—'}
                      {d.description && (
                        <div className="text-muted-foreground">{d.description}</div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{placeOf(d) ?? '—'}</Td>
                    <Td className="text-xs">
                      {d.lines.slice(0, 2).map((l) => (
                        <div key={l.id} className="truncate text-muted-foreground">
                          {l.item.name}
                          {d.type === 'TRANSFER' ? (
                            <span className="text-info"> × {lineQty(d, l)}</span>
                          ) : (
                            l.quantityAdjusted !== null && (
                              <span
                                className={
                                  Number(l.quantityAdjusted) > 0
                                    ? ' text-success'
                                    : ' text-destructive'
                                }
                              >
                                {' '}
                                {Number(l.quantityAdjusted) > 0 ? '+' : ''}
                                {Number(l.quantityAdjusted)}
                              </span>
                            )
                          )}
                        </div>
                      ))}
                      {d.lines.length > 2 && (
                        <div className="text-muted-foreground">
                          +{d.lines.length - 2} more
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge status={d.status}>{d.status.replaceAll('_', ' ')}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">{rowActions(d)}</div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            </div>
            {meta && (
              <Pagination
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
        A draft records intent only — stock does not move until it is posted or sent. Posted documents are
        permanent; reverse them with a new adjustment so the ledger keeps both sides. A sent transfer shows
        as incoming at its destination until it is received.
      </p>
    </>
  );
}
