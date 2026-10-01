'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { api, money, errorMessage, type Paged, numberLocale } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { CardList, RecordCard } from '@/components/CardList';
import type { Column } from '@/lib/export';
import {
  Badge, Button, EmptyRow, ErrorBox, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type StockType = 'FINISHED_GOOD' | 'PACKAGING' | 'RAW_MATERIAL' | 'CONSUMABLE';

type Quantities = {
  onHand: number;
  committed: number;
  unavailable: number;
  available: number;
  waitingQc: number;
  notLabelled: number;
  otherHeld: number;
};

type ItemRow = Quantities & {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  locationCount: number;
  salePrice: number;
  priceSource: 'SELLING_PRICE' | 'MRP' | null;
  saleValue: number;
  unitCost?: number;
  costValue?: number;
};

type Totals = Quantities & {
  itemCount: number;
  saleValue: number;
  withoutPrice: number;
  costValue?: number;
  withoutCost?: number;
};

type TypeRow = Totals & { category: StockType; items: ItemRow[] };

type Meta = { locationId: string | null; hideZero: boolean; totals: Totals };

type Location = { id: string; name: string; code: string };

const TYPE_LABEL: Record<StockType, string> = {
  FINISHED_GOOD: 'Finished products',
  PACKAGING: 'Packaging',
  RAW_MATERIAL: 'Raw materials',
  CONSUMABLE: 'Consumables',
};

const qty = (n: number) => Number(n).toLocaleString(numberLocale());

function Dash({ value, tone = '' }: { value: number; tone?: string }) {
  if (!value) return <span className="text-muted-foreground/60">—</span>;
  return <span className={tone}>{qty(value)}</span>;
}

export default function StockByTypeReportPage() {
  const [rows, setRows] = useState<TypeRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [locationId, setLocationId] = useState('');
  const [view, setView] = useState<'inStock' | 'all'>('inStock');
  const [picked, setPicked] = useState<StockType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, locs] = await Promise.all([
        api.get<{ data: TypeRow[]; meta: Meta }>('/reports/stock-by-type', {
          locationId: locationId || undefined,
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
  }, [locationId, view]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const t = meta?.totals;
  const showCost = t?.costValue !== undefined;
  const current: StockType =
    picked ?? rows.find((r) => r.itemCount > 0)?.category ?? 'FINISHED_GOOD';
  const selected = rows.find((r) => r.category === current);
  const items = selected?.items ?? [];
  const place = locations.find((l) => l.id === locationId);
  const placeLabel = place ? `${place.code} — ${place.name}` : 'All locations';

  function typesExportSpec() {
    const columns: Column<TypeRow>[] = [
      { header: 'Type', value: (r) => TYPE_LABEL[r.category], width: 150 },
      { header: 'Items', value: (r) => r.itemCount, align: 'right' },
      { header: 'On hand', value: (r) => r.onHand, align: 'right' },
      { header: 'Kept for orders', value: (r) => r.committed, align: 'right' },
      { header: 'Waiting for QC', value: (r) => r.waitingQc, align: 'right' },
      { header: 'Not labelled', value: (r) => r.notLabelled, align: 'right' },
      { header: 'Other held back', value: (r) => r.otherHeld, align: 'right' },
      { header: 'Available', value: (r) => r.available, align: 'right' },
      { header: 'Sale value', value: (r) => r.saleValue, money: true },
    ];
    if (showCost) columns.push({ header: 'Cost value', value: (r) => r.costValue ?? 0, money: true });
    return {
      title: 'Stock by Type',
      subtitle: placeLabel,
      columns,
      rows,
      totals: [
        'Total',
        t?.itemCount ?? 0,
        t?.onHand ?? 0,
        t?.committed ?? 0,
        t?.waitingQc ?? 0,
        t?.notLabelled ?? 0,
        t?.otherHeld ?? 0,
        t?.available ?? 0,
        t?.saleValue ?? 0,
        ...(showCost ? [t?.costValue ?? 0] : []),
      ],
      footnote:
        'Sale value uses each item\'s selling price with GST, or its MRP when no selling price is set. ' +
        'Everything on the shelf is counted, including units held back.',
      orientation: 'landscape' as const,
    };
  }

  function itemsExportSpec() {
    const columns: Column<ItemRow>[] = [
      { header: 'Item', value: (r) => r.name, width: 180 },
      { header: 'SKU', value: (r) => r.sku ?? '' },
      { header: 'Unit', value: (r) => r.unit },
      { header: 'On hand', value: (r) => r.onHand, align: 'right' },
      { header: 'Kept for orders', value: (r) => r.committed, align: 'right' },
      { header: 'Waiting for QC', value: (r) => r.waitingQc, align: 'right' },
      { header: 'Not labelled', value: (r) => r.notLabelled, align: 'right' },
      { header: 'Other held back', value: (r) => r.otherHeld, align: 'right' },
      { header: 'Available', value: (r) => r.available, align: 'right' },
      { header: 'Sale price', value: (r) => r.salePrice, money: true },
      { header: 'Sale value', value: (r) => r.saleValue, money: true },
    ];
    if (showCost) {
      columns.push(
        { header: 'Unit cost', value: (r) => r.unitCost ?? 0, money: true },
        { header: 'Cost value', value: (r) => r.costValue ?? 0, money: true },
      );
    }
    return {
      title: `${TYPE_LABEL[current]} Stock`,
      subtitle: placeLabel,
      columns,
      rows: items,
      totals: [
        'Total', '', '',
        selected?.onHand ?? 0,
        selected?.committed ?? 0,
        selected?.waitingQc ?? 0,
        selected?.notLabelled ?? 0,
        selected?.otherHeld ?? 0,
        selected?.available ?? 0,
        '',
        selected?.saleValue ?? 0,
        ...(showCost ? ['', selected?.costValue ?? 0] : []),
      ],
      footnote:
        'Sale value uses each item\'s selling price with GST, or its MRP when no selling price is set.',
      orientation: 'landscape' as const,
    };
  }

  const typeCards = rows.map((r) => {
    const active = r.category === current;
    return (
      <RecordCard
        key={r.category}
        mono={false}
        title={TYPE_LABEL[r.category]}
        amount={money(r.saleValue)}
        primary={`${qty(r.available)} available of ${qty(r.onHand)} on hand`}
        secondary={showCost ? `Cost ${money(r.costValue)}` : undefined}
        badges={
          r.waitingQc > 0 || r.notLabelled > 0 ? (
            <>
              {r.waitingQc > 0 && <Badge tone="amber">{qty(r.waitingQc)} waiting for QC</Badge>}
              {r.notLabelled > 0 && <Badge tone="amber">{qty(r.notLabelled)} not labelled</Badge>}
            </>
          ) : undefined
        }
        footer={`${r.itemCount} item(s)`}
        actions={
          <Button
            size="sm"
            variant={active ? 'primary' : 'outline'}
            onClick={() => setPicked(r.category)}
            aria-pressed={active}
          >
            {active ? 'Showing items' : 'Show items'}
          </Button>
        }
      />
    );
  });

  const totalCard = t ? (
    <RecordCard
      key="total"
      mono={false}
      title="All types"
      amount={money(t.saleValue)}
      primary={`${qty(t.available)} available of ${qty(t.onHand)} on hand`}
      secondary={showCost ? `Cost ${money(t.costValue)}` : undefined}
      footer={`${t.itemCount} item(s)`}
    />
  ) : null;

  const typeCols = showCost ? 11 : 10;
  const itemCols = showCost ? 11 : 9;

  return (
    <>
      <PageHeader
        title="Stock by type"
        subtitle="How much you hold in finished products, packaging, raw materials and consumables"
        actions={<ExportMenu spec={typesExportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Value at sale price"
            value={money(t.saleValue)}
            sub="what it would sell for today"
            tone="green"
          />
          {showCost ? (
            <StatCard
              label="Value at cost"
              value={money(t.costValue)}
              sub="what you paid for it"
            />
          ) : (
            <StatCard
              label="Items"
              value={qty(t.itemCount)}
              sub="across all types"
            />
          )}
          <StatCard
            label="Available"
            value={qty(t.available)}
            sub={`of ${qty(t.onHand)} on hand`}
          />
          <StatCard
            label="Held back"
            value={qty(t.unavailable)}
            sub={`${qty(t.waitingQc)} waiting for QC, ${qty(t.notLabelled)} not labelled`}
            tone={t.unavailable > 0 ? 'amber' : 'slate'}
          />
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
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
              <option value="inStock">Items with stock</option>
              <option value="all">All items</option>
            </Select>
          </label>
          <p className="ml-auto max-w-sm pb-1 text-right text-xs text-muted-foreground">
            Pick a type to see the items inside it.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty="No stock to show">
              {t && rows.length > 0 ? [...typeCards, totalCard] : typeCards}
            </CardList>
            <div className="hidden md:block">
              <Table minWidth={showCost ? '1100px' : '980px'}>
                <thead>
                  <tr>
                    <Th>TYPE</Th>
                    <Th className="text-right">ITEMS</Th>
                    <Th className="text-right">ON HAND</Th>
                    <Th className="text-right">FOR ORDERS</Th>
                    <Th className="text-right">WAITING FOR QC</Th>
                    <Th className="text-right">NOT LABELLED</Th>
                    <Th className="text-right">OTHER HELD</Th>
                    <Th className="text-right">AVAILABLE</Th>
                    <Th className="text-right">SALE VALUE</Th>
                    {showCost && <Th className="text-right">COST VALUE</Th>}
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <EmptyRow colSpan={typeCols} message="No stock to show" />}
                  {rows.map((r) => {
                    const active = r.category === current;
                    return (
                      <tr key={r.category} className={active ? 'bg-muted/60' : 'hover:bg-muted/60'}>
                        <Td>
                          <button
                            type="button"
                            onClick={() => setPicked(r.category)}
                            aria-pressed={active}
                            className="font-medium text-gold-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {TYPE_LABEL[r.category]}
                          </button>
                        </Td>
                        <Td className="text-right text-muted-foreground">{r.itemCount}</Td>
                        <Td className="text-right">{qty(r.onHand)}</Td>
                        <Td className="text-right text-muted-foreground"><Dash value={r.committed} /></Td>
                        <Td className="text-right"><Dash value={r.waitingQc} tone="text-warning" /></Td>
                        <Td className="text-right"><Dash value={r.notLabelled} tone="text-warning" /></Td>
                        <Td className="text-right"><Dash value={r.otherHeld} tone="text-warning" /></Td>
                        <Td className="text-right font-semibold">{qty(r.available)}</Td>
                        <Td className="text-right font-medium">{money(r.saleValue)}</Td>
                        {showCost && <Td className="text-right">{money(r.costValue)}</Td>}
                        <Td className="w-8">
                          <button
                            type="button"
                            onClick={() => setPicked(r.category)}
                            aria-label={`Show items in ${TYPE_LABEL[r.category]}`}
                            className="flex text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ChevronRight className={`size-4 ${active ? 'text-gold-ink' : ''}`} />
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                  {t && rows.length > 0 && (
                    <tr className="border-t-2 border-border font-semibold">
                      <Td>Total</Td>
                      <Td className="text-right">{t.itemCount}</Td>
                      <Td className="text-right">{qty(t.onHand)}</Td>
                      <Td className="text-right"><Dash value={t.committed} /></Td>
                      <Td className="text-right"><Dash value={t.waitingQc} /></Td>
                      <Td className="text-right"><Dash value={t.notLabelled} /></Td>
                      <Td className="text-right"><Dash value={t.otherHeld} /></Td>
                      <Td className="text-right">{qty(t.available)}</Td>
                      <Td className="text-right">{money(t.saleValue)}</Td>
                      {showCost && <Td className="text-right">{money(t.costValue)}</Td>}
                      <Td />
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>

      {!loading && selected && (
        <div className="mt-5 rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-medium tracking-wide text-foreground">
                Items in {TYPE_LABEL[current]}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selected.itemCount} item(s), worth {money(selected.saleValue)} at sale price
              </p>
            </div>
            <ExportMenu spec={itemsExportSpec} disabled={!items.length} label="Export items" />
          </div>

          <CardList empty={`No ${TYPE_LABEL[current].toLowerCase()} to show`}>
            {items.map((r) => (
              <RecordCard
                key={r.id}
                href={`/admin/items/${r.id}`}
                mono={false}
                title={r.name}
                amount={money(r.saleValue)}
                date={r.sku ?? undefined}
                primary={`${qty(r.available)} ${r.unit} available of ${qty(r.onHand)} on hand`}
                secondary={
                  showCost
                    ? `Cost ${money(r.costValue)}`
                    : r.priceSource === 'MRP'
                      ? 'Valued at MRP'
                      : undefined
                }
                badges={
                  r.waitingQc > 0 || r.notLabelled > 0 || r.otherHeld > 0 || !r.priceSource ? (
                    <>
                      {r.waitingQc > 0 && <Badge tone="amber">{qty(r.waitingQc)} waiting for QC</Badge>}
                      {r.notLabelled > 0 && <Badge tone="amber">{qty(r.notLabelled)} not labelled</Badge>}
                      {r.otherHeld > 0 && <Badge tone="sand">{qty(r.otherHeld)} other held</Badge>}
                      {!r.priceSource && <Badge tone="red">No price set</Badge>}
                    </>
                  ) : undefined
                }
              />
            ))}
          </CardList>
          <div className="hidden md:block">
            <Table minWidth={showCost ? '1260px' : '1060px'}>
              <thead>
                <tr>
                  <Th>ITEM</Th>
                  <Th className="text-right">ON HAND</Th>
                  <Th className="text-right">FOR ORDERS</Th>
                  <Th className="text-right">WAITING FOR QC</Th>
                  <Th className="text-right">NOT LABELLED</Th>
                  <Th className="text-right">OTHER HELD</Th>
                  <Th className="text-right">AVAILABLE</Th>
                  <Th className="text-right">SALE PRICE</Th>
                  <Th className="text-right">SALE VALUE</Th>
                  {showCost && <Th className="text-right">UNIT COST</Th>}
                  {showCost && <Th className="text-right">COST VALUE</Th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <EmptyRow
                    colSpan={itemCols}
                    message={`No ${TYPE_LABEL[current].toLowerCase()} to show`}
                  />
                )}
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/60">
                    <Td>
                      <Link
                        href={`/admin/items/${r.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {r.name}
                      </Link>
                      {r.sku && (
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {r.sku}
                        </span>
                      )}
                      {r.locationCount > 1 && (
                        <span className="block text-[11px] text-muted-foreground">
                          across {r.locationCount} locations
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {qty(r.onHand)}
                      <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>
                    </Td>
                    <Td className="text-right text-muted-foreground"><Dash value={r.committed} /></Td>
                    <Td className="text-right"><Dash value={r.waitingQc} tone="text-warning" /></Td>
                    <Td className="text-right"><Dash value={r.notLabelled} tone="text-warning" /></Td>
                    <Td className="text-right"><Dash value={r.otherHeld} tone="text-warning" /></Td>
                    <Td className={`text-right font-semibold ${r.available <= 0 ? 'text-destructive' : ''}`}>
                      {qty(r.available)}
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {r.priceSource ? (
                        <>
                          {money(r.salePrice)}
                          {r.priceSource === 'MRP' && (
                            <span className="block text-[11px]">MRP</span>
                          )}
                        </>
                      ) : (
                        <span className="text-warning">not set</span>
                      )}
                    </Td>
                    <Td className="text-right font-medium">{money(r.saleValue)}</Td>
                    {showCost && (
                      <Td className="text-right text-muted-foreground">
                        {r.unitCost ? money(r.unitCost) : <span className="text-warning">not set</span>}
                      </Td>
                    )}
                    {showCost && <Td className="text-right">{money(r.costValue)}</Td>}
                  </tr>
                ))}
                {items.length > 0 && (
                  <tr className="border-t-2 border-border font-semibold">
                    <Td>Total</Td>
                    <Td className="text-right">{qty(selected.onHand)}</Td>
                    <Td className="text-right"><Dash value={selected.committed} /></Td>
                    <Td className="text-right"><Dash value={selected.waitingQc} /></Td>
                    <Td className="text-right"><Dash value={selected.notLabelled} /></Td>
                    <Td className="text-right"><Dash value={selected.otherHeld} /></Td>
                    <Td className="text-right">{qty(selected.available)}</Td>
                    <Td />
                    <Td className="text-right">{money(selected.saleValue)}</Td>
                    {showCost && <Td />}
                    {showCost && <Td className="text-right">{money(selected.costValue)}</Td>}
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {t && t.withoutPrice > 0 && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t.withoutPrice} item(s) have stock but no selling price or MRP, so they add nothing to the
          sale value. The real figure is higher.
        </p>
      )}

      {t && showCost && (t.withoutCost ?? 0) > 0 && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t.withoutCost} item(s) have stock but no cost price, so they add nothing to the cost value.
          The real figure is higher.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Sale value uses each item&apos;s selling price with GST, or its MRP when no selling price is set.
        Everything on the shelf is counted, including units waiting for QC, not yet labelled, or held
        back for another reason. Available is what is left after orders and held back units.
      </p>
    </>
  );
}
