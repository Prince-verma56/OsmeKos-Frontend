'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale, type Paged } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { CardList, RecordCard } from '@/components/CardList';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import { LOT_STATUS, lotStatusOf, type LotStatus } from '@/lib/quality';
import {
  Badge, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type BucketKey = 'expired' | 'within30' | 'days31to90' | 'days91to180' | 'over180' | 'noExpiry';

type Row = {
  id: string;
  batchNo: string | null;
  item: { id: string; name: string; sku: string | null; unit: string; itemCategory: string };
  location: { id: string; name: string; code: string } | null;
  status: LotStatus;
  notLabelled: boolean;
  mfgDate: string | null;
  expiryDate: string | null;
  daysLeft: number | null;
  bucket: BucketKey;
  unitsLeft: number;
  unitCost?: number;
  stockValue?: number;
};

type Bucket = { key: BucketKey; label: string; batchCount: number; units: number; value?: number };

type Meta = {
  asOf: string;
  bucket: BucketKey | null;
  buckets: Bucket[];
  totals: { batchCount: number; units: number; notLabelled: number; value?: number };
};

type Location = { id: string; name: string; code: string };

const BUCKETS: { key: BucketKey; label: string; tone: 'red' | 'amber' | 'green' | 'slate' }[] = [
  { key: 'expired', label: 'Expired', tone: 'red' },
  { key: 'within30', label: 'Within 30 days', tone: 'amber' },
  { key: 'days31to90', label: '31 to 90 days', tone: 'amber' },
  { key: 'days91to180', label: '91 to 180 days', tone: 'slate' },
  { key: 'over180', label: 'Over 180 days', tone: 'green' },
  { key: 'noExpiry', label: 'No expiry date', tone: 'slate' },
];

const CATEGORIES = [
  { value: '', label: 'All kinds' },
  { value: 'FINISHED_GOOD', label: 'Finished products' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'RAW_MATERIAL', label: 'Raw materials' },
  { value: 'CONSUMABLE', label: 'Consumables' },
];

const STATUSES: LotStatus[] = ['AVAILABLE', 'PENDING_QC', 'ON_HOLD', 'RECALLED', 'EXPIRED', 'REJECTED'];

const qty = (n: number) => Number(n).toLocaleString(numberLocale());

const plural = (n: number, one: string, many = `${one}s`) => `${qty(n)} ${n === 1 ? one : many}`;

function daysText(days: number | null) {
  if (days === null) return '';
  if (days < 0) return `Expired ${plural(-days, 'day')} ago`;
  if (days === 0) return 'Expires today';
  return `${plural(days, 'day')} left`;
}

const daysTone = (days: number | null) =>
  days === null ? 'text-muted-foreground' : days < 0 ? 'text-destructive' : days <= 90 ? 'text-warning' : 'text-muted-foreground';

export default function BatchExpiryReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [bucket, setBucket] = useState<BucketKey | ''>('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<LotStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, locs] = await Promise.all([
        api.get<{ data: Row[]; meta: Meta }>('/reports/batch-expiry', {
          bucket: bucket || undefined,
          search: search.trim() || undefined,
          itemCategory: category || undefined,
          locationId: locationId || undefined,
          status: status || undefined,
        }),
        api
          .get<Paged<Location>>('/locations', { limit: 50 })
          .catch(() => ({ data: [] as Location[] })),
      ]);
      setRows(res.data);
      setMeta(res.meta);
      setLocations(locs.data ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [bucket, search, category, locationId, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const sel = useRowSelection(rows);

  const t = meta?.totals;
  const showCosts = t?.value !== undefined;
  const summaryOf = (key: BucketKey) => meta?.buckets.find((b) => b.key === key);

  function exportSpec() {
    const columns: Column<Row>[] = [
      { header: 'Batch', value: (r) => r.batchNo ?? '' },
      { header: 'Item', value: (r) => r.item.name, width: 180 },
      { header: 'SKU', value: (r) => r.item.sku ?? '' },
      { header: 'Location', value: (r) => r.location?.name ?? '' },
      { header: 'Status', value: (r) => lotStatusOf(r.status).label },
      { header: 'Not labelled', value: (r) => (r.notLabelled ? 'Yes' : '') },
      { header: 'Made on', value: (r) => (r.mfgDate ? shortDate(r.mfgDate) : '') },
      { header: 'Expires on', value: (r) => (r.expiryDate ? shortDate(r.expiryDate) : 'No expiry date') },
      { header: 'Days left', value: (r) => r.daysLeft ?? '', align: 'right' },
      { header: 'Units left', value: (r) => r.unitsLeft, align: 'right' },
      ...(showCosts
        ? [
            { header: 'Unit cost', value: (r: Row) => r.unitCost ?? 0, money: true },
            { header: 'Stock value', value: (r: Row) => r.stockValue ?? 0, money: true },
          ]
        : []),
    ];
    const picked = BUCKETS.find((b) => b.key === bucket);
    return {
      title: 'Batch Expiry',
      subtitle: `${picked ? `${picked.label} · ` : ''}As of ${shortDate(meta?.asOf)} · ${plural(t?.batchCount ?? 0, 'batch', 'batches')}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total', '', '', '', '',
        t?.notLabelled ? t.notLabelled : '',
        '', '', '',
        t?.units ?? 0,
        ...(showCosts ? ['', t?.value ?? 0] : []),
      ],
      footnote:
        'Only batches with stock left are listed. Days left are counted from today. ' +
        'Rejected batches are left out unless you pick them in the status filter.',
      orientation: 'landscape' as const,
    };
  }

  const colSpan = showCosts ? 10 : 9;

  return (
    <>
      <PageHeader
        title="Batch expiry"
        subtitle="Batches still in stock, grouped by how soon they expire"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {meta && (
        <div className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Batches in each group
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {BUCKETS.map((b) => {
              const s = summaryOf(b.key);
              const count = s?.batchCount ?? 0;
              const units = s?.units ?? 0;
              return (
                <StatCard
                  key={b.key}
                  label={b.label}
                  value={qty(count)}
                  sub={
                    showCosts
                      ? `${plural(units, 'unit')} · ${money(s?.value ?? 0)}`
                      : `${plural(units, 'unit')} left`
                  }
                  tone={count > 0 ? b.tone : 'slate'}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block w-full sm:w-64">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Search
            </span>
            <Input
              placeholder="Item, SKU or batch number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </label>
          <label className="block w-full sm:w-auto">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Expires
            </span>
            <Select
              value={bucket}
              onChange={(e) => setBucket(e.target.value as BucketKey | '')}
              className="w-full sm:w-44"
            >
              <option value="">Any time</option>
              {BUCKETS.map((b) => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </Select>
          </label>
          <label className="block w-full sm:w-auto">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Kind
            </span>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full sm:w-44"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </label>
          <label className="block w-full sm:w-auto">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Location
            </span>
            <Select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full sm:w-52"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </label>
          <label className="block w-full sm:w-auto">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </span>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as LotStatus | '')}
              className="w-full sm:w-48"
            >
              <option value="">All except rejected</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{LOT_STATUS[s].label}</option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty="No batches with stock match these filters">
              {rows.map((r) => {
                const st = lotStatusOf(r.status);
                return (
                  <RecordCard
                    key={r.id}
                    href={`/admin/batches/${r.id}`}
                    title={r.batchNo ?? 'No batch no.'}
                    amount={`${qty(r.unitsLeft)} ${r.item.unit} left`}
                    date={r.expiryDate ? `Expires ${shortDate(r.expiryDate)}` : 'No expiry date'}
                    note={r.daysLeft !== null && r.daysLeft <= 90 ? daysText(r.daysLeft) : undefined}
                    primary={r.item.name}
                    secondary={[
                      r.location?.name,
                      r.mfgDate ? `Made ${shortDate(r.mfgDate)}` : null,
                    ].filter(Boolean).join(' · ') || undefined}
                    badges={
                      <>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {r.notLabelled && <Badge tone="amber">Not labelled</Badge>}
                      </>
                    }
                    footer={showCosts ? `Value at cost ${money(r.stockValue ?? 0)}` : undefined}
                  />
                );
              })}
            </CardList>

            <div className="hidden md:block">
              <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />
              <Table minWidth={showCosts ? '1080px' : '980px'}>
                <thead>
                  <tr>
                    <Th className="w-8">
                      <SelectAllBox
                        allSelected={sel.allSelected}
                        someSelected={sel.someSelected}
                        onToggle={sel.toggleAll}
                      />
                    </Th>
                    <Th>BATCH</Th>
                    <Th>ITEM</Th>
                    <Th>LOCATION</Th>
                    <Th>STATUS</Th>
                    <Th>MADE</Th>
                    <Th>EXPIRES</Th>
                    <Th className="text-right">DAYS LEFT</Th>
                    <Th className="text-right">UNITS LEFT</Th>
                    {showCosts && <Th className="text-right">VALUE AT COST</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <EmptyRow colSpan={colSpan} message="No batches with stock match these filters" />
                  )}
                  {rows.map((r, i) => {
                    const st = lotStatusOf(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-muted/60">
                        <Td>
                          <SelectBox
                            checked={sel.isSelected(sel.idOf(r, i))}
                            onToggle={() => sel.toggle(sel.idOf(r, i))}
                          />
                        </Td>
                        <Td>
                          <Link
                            href={`/admin/batches/${r.id}`}
                            className="font-mono font-medium text-gold-ink hover:underline"
                          >
                            {r.batchNo ?? 'No batch no.'}
                          </Link>
                        </Td>
                        <Td>
                          <div className="min-w-44 font-medium">{r.item.name}</div>
                          {r.item.sku && (
                            <div className="font-mono text-[11px] text-muted-foreground">{r.item.sku}</div>
                          )}
                        </Td>
                        <Td className="text-muted-foreground">{r.location?.name ?? '—'}</Td>
                        <Td>
                          <span className="flex flex-wrap gap-1">
                            <Badge tone={st.tone}>{st.label}</Badge>
                            {r.notLabelled && <Badge tone="amber">Not labelled</Badge>}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-muted-foreground">
                          {r.mfgDate ? shortDate(r.mfgDate) : '—'}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {r.expiryDate ? shortDate(r.expiryDate) : (
                            <span className="text-muted-foreground">No expiry date</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          {r.daysLeft === null ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            <>
                              <span className={`font-semibold ${daysTone(r.daysLeft)}`}>{qty(r.daysLeft)}</span>
                              {r.daysLeft <= 0 && (
                                <span className={`block text-[11px] ${daysTone(r.daysLeft)}`}>
                                  {r.daysLeft < 0 ? 'expired' : 'expires today'}
                                </span>
                              )}
                            </>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          <span className="font-semibold">{qty(r.unitsLeft)}</span>
                          <span className="ml-1 text-[11px] text-muted-foreground">{r.item.unit}</span>
                        </Td>
                        {showCosts && (
                          <Td className="text-right font-medium">{money(r.stockValue ?? 0)}</Td>
                        )}
                      </tr>
                    );
                  })}
                  {t && rows.length > 0 && (
                    <tr className="border-t-2 border-border font-semibold">
                      <Td />
                      <Td>Total</Td>
                      <Td className="font-normal text-muted-foreground">{plural(t.batchCount, 'batch', 'batches')}</Td>
                      <Td />
                      <Td className="font-normal text-muted-foreground">
                        {t.notLabelled > 0 ? `${qty(t.notLabelled)} not labelled` : ''}
                      </Td>
                      <Td />
                      <Td />
                      <Td />
                      <Td className="text-right">{qty(t.units)}</Td>
                      {showCosts && <Td className="text-right">{money(t.value ?? 0)}</Td>}
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Only batches with stock left are shown, soonest expiry first. Days left are counted from
        today{meta ? ` (${shortDate(meta.asOf)})` : ''}. Rejected batches are hidden unless you pick
        Rejected under Status.
      </p>
    </>
  );
}
