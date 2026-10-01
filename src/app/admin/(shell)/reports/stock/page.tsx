'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, errorMessage, type Paged, numberLocale } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { RankChart } from '@/components/ReportChart';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import {
  Badge, EmptyRow, ErrorBox, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type Row = {
  id: string;
  item: {
    id: string; name: string; sku: string | null; unit: string;
    itemCategory: string; costPrice: string | null; sellingPrice: string | null;
  };
  location: { id: string; name: string; code: string } | null;
  binLocation: string | null;
  onHand: number;
  committed: number;
  unavailable: number;
  incoming: number;
  available: number;
  costPrice: number;
  costValue: number;
  retailValue: number;
  reorderPoint: number | null;
  isLow: boolean;
  isOut: boolean;
  hasCost: boolean;
  locationCount: number;
};

type Meta = {
  groupBy: 'item' | 'location';
  totals: {
    onHand: number; committed: number; unavailable: number; incoming: number;
    available: number; costValue: number; retailValue: number;
    rowCount: number; lowCount: number; outCount: number; withoutCost: number;
  };
};

type Location = { id: string; name: string; code: string };

const qty = (n: number) => Number(n).toLocaleString(numberLocale());

export default function StockReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [groupBy, setGroupBy] = useState<'item' | 'location'>('item');
  const [locationId, setLocationId] = useState('');
  const [view, setView] = useState<'all' | 'low' | 'inStock'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, locs] = await Promise.all([
        api.get<{ data: Row[]; meta: Meta }>('/reports/stock', {
          groupBy,
          locationId: locationId || undefined,
          lowOnly: view === 'low',
          hideZero: view === 'inStock',
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
  }, [groupBy, locationId, view]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const sel = useRowSelection(rows);


  const t = meta?.totals;
  const byLocation = groupBy === 'location';

  function exportSpec() {
    const columns: Column<Row>[] = [
      { header: 'Item', value: (r) => r.item.name, width: 180 },
      { header: 'SKU', value: (r) => r.item.sku ?? '' },
      ...(byLocation
        ? [
            { header: 'Location', value: (r: Row) => r.location?.code ?? '' },
            { header: 'Bin', value: (r: Row) => r.binLocation ?? '' },
          ]
        : []),
      { header: 'Unit', value: (r) => r.item.unit },
      { header: 'On hand', value: (r) => r.onHand, align: 'right' },
      { header: 'Committed', value: (r) => r.committed, align: 'right' },
      { header: 'Unavailable', value: (r) => r.unavailable, align: 'right' },
      { header: 'Available', value: (r) => r.available, align: 'right' },
      { header: 'Incoming', value: (r) => r.incoming, align: 'right' },
      { header: 'Reorder point', value: (r) => r.reorderPoint ?? '', align: 'right' },
      { header: 'Cost', value: (r) => r.costPrice, money: true },
      { header: 'Stock value', value: (r) => r.costValue, money: true },
      { header: 'Status', value: (r) => (r.isOut ? 'Out of stock' : r.isLow ? 'Low' : '') },
    ];
    return {
      title: byLocation ? 'Stock by Location' : 'Stock on Hand',
      subtitle: `${t?.rowCount ?? 0} row(s) · valued at cost`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total', '',
        ...(byLocation ? ['', ''] : []),
        '',
        t?.onHand ?? 0, t?.committed ?? 0, t?.unavailable ?? 0,
        t?.available ?? 0, t?.incoming ?? 0, '', '',
        t?.costValue ?? 0, '',
      ],
      footnote:
        'Available is never stored — it is on hand minus committed minus unavailable, derived the ' +
        'same way everywhere. Valued at cost, because stock is an asset until it sells.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>

      <PageHeader
        title="Stock"
        subtitle="What is on the shelf, and how much of it can actually be sold"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Stock Value"
            value={money(t.costValue)}
            sub="at cost — an asset until it sells"
          />
          <StatCard
            label="Available"
            value={qty(t.available)}
            sub={`of ${qty(t.onHand)} on hand`}
            tone="green"
          />
          <StatCard
            label="Low or Out"
            value={String(t.lowCount + t.outCount)}
            sub={`${t.outCount} out, ${t.lowCount} below reorder point`}
            tone={t.outCount > 0 ? 'red' : t.lowCount > 0 ? 'amber' : 'slate'}
          />
          <StatCard
            label="Held Back"
            value={qty(t.committed + t.unavailable)}
            sub={`${qty(t.committed)} committed, ${qty(t.unavailable)} unavailable`}
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Where the money is sitting
            </h3>
            <RankChart
              points={rows.map((r) => ({ label: r.item.name, value: r.costValue }))}
              tone="blue"
              valueLabel="Stock value"
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cover against the reorder point
            </h3>
            <RankChart
              points={rows
                .filter((r) => r.reorderPoint != null)
                .map((r) => ({
                  label: r.item.name,
                  value: Math.round((r.available / Math.max(1, r.reorderPoint ?? 1)) * 100),
                }))}
              format={(n) => `${n}%`}
              tone="amber"
              valueLabel="Cover"
            />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Available as a share of the reorder point. Under 100% means it is time to buy.
            </p>
          </div>
        </div>
      )}


      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Group by
            </span>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'item' | 'location')}
              className="w-44"
            >
              <option value="item">Item</option>
              <option value="location">Item and location</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Location
            </span>
            <Select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-52"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Show
            </span>
            <Select
              value={view}
              onChange={(e) => setView(e.target.value as typeof view)}
              className="w-48"
            >
              <option value="all">Everything</option>
              <option value="inStock">In stock only</option>
              <option value="low">Needs reordering</option>
            </Select>
          </label>
          <p className="ml-auto max-w-sm pb-1 text-right text-xs text-muted-foreground">
            Low is judged on <strong>available</strong>, not on hand — stock already promised to an
            order will not save you when the next one arrives.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />
        {loading ? (
          <Loading />
        ) : (
          <Table minWidth={byLocation ? '1140px' : '1020px'}>
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllBox
                    allSelected={sel.allSelected}
                    someSelected={sel.someSelected}
                    onToggle={sel.toggleAll}
                  />
                </Th>
                <Th>ITEM</Th>
                {byLocation && <Th>LOCATION</Th>}
                <Th className="text-right">ON HAND</Th>
                <Th className="text-right">COMMITTED</Th>
                <Th className="text-right">UNAVAILABLE</Th>
                <Th className="text-right">AVAILABLE</Th>
                <Th className="text-right">INCOMING</Th>
                <Th className="text-right">COST</Th>
                <Th className="text-right">VALUE</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={byLocation ? 11 : 10} message="No tracked stock to show" />
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  <Td>
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, 0))}
                      onToggle={() => sel.toggle(sel.idOf(r, 0))}
                    />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/items/${r.item.id}`}
                      className="font-medium text-gold-ink hover:underline"
                    >
                      {r.item.name}
                    </Link>
                    {r.item.sku && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                        {r.item.sku}
                      </span>
                    )}
                    {!byLocation && r.locationCount > 1 && (
                      <span className="block text-[11px] text-muted-foreground">
                        across {r.locationCount} locations
                      </span>
                    )}
                  </Td>
                  {byLocation && (
                    <Td className="text-xs">
                      {r.location?.code ?? '—'}
                      {r.binLocation && (
                        <span className="block text-muted-foreground">
                          bin {r.binLocation}
                        </span>
                      )}
                    </Td>
                  )}
                  <Td className="text-right">{qty(r.onHand)}</Td>
                  <Td className="text-right text-muted-foreground">
                    {r.committed ? qty(r.committed) : '—'}
                  </Td>
                  <Td className="text-right">
                    {r.unavailable ? (
                      <span className="text-warning">
                        {qty(r.unavailable)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </Td>
                  <Td
                    className={`text-right font-semibold ${
                      r.isOut
                        ? 'text-destructive'
                        : r.isLow
                          ? 'text-warning'
                          : ''
                    }`}
                  >
                    {qty(r.available)}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {r.item.unit}
                    </span>
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    {r.incoming ? qty(r.incoming) : '—'}
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    {r.hasCost ? (
                      money(r.costPrice)
                    ) : (
                      <span className="text-warning">not set</span>
                    )}
                  </Td>
                  <Td className="text-right font-medium">{money(r.costValue)}</Td>
                  <Td>
                    {r.isOut ? (
                      <Badge tone="red">Out of stock</Badge>
                    ) : r.isLow ? (
                      <Badge tone="amber">Low</Badge>
                    ) : null}
                  </Td>
                </tr>
              ))}
              {t && rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  {byLocation && <Td />}
                  <Td className="text-right">{qty(t.onHand)}</Td>
                  <Td className="text-right">{t.committed ? qty(t.committed) : '—'}</Td>
                  <Td className="text-right">{t.unavailable ? qty(t.unavailable) : '—'}</Td>
                  <Td className="text-right">{qty(t.available)}</Td>
                  <Td className="text-right">{t.incoming ? qty(t.incoming) : '—'}</Td>
                  <Td />
                  <Td className="text-right">{money(t.costValue)}</Td>
                  <Td />
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>

      {t && t.withoutCost > 0 && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t.withoutCost} item(s) hold stock but have no cost price set, so they contribute nothing
          to the {money(t.costValue)} above. The real figure is higher.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Available is never stored anywhere — it is on hand minus committed minus unavailable,
        derived here exactly as it is everywhere else. Valued at cost, because stock is an asset
        until it sells; valuing it at the selling price would book profit that has not been earned.
      </p>
    </>
  );
}
