'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale, type Paged } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { CardList } from '@/components/CardList';
import { DateRange, presetRange, type Range } from '@/components/DateRange';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import { lotStatusOf } from '@/lib/quality';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type Figures = {
  received: number;
  sold: number;
  returned: number;
  adjusted: number;
  moved: number;
  rejected: number;
  left: number;
  inTransit: number;
  customers: number;
  receivedValue?: number;
  leftValue?: number;
};

type Row = Figures & {
  id: string;
  batchNo: string | null;
  item: { id: string; name: string; sku: string | null; unit: string };
  vendor: { id: string; displayName: string } | null;
  sourceType: string | null;
  location: { id: string; name: string; code: string } | null;
  receivedAt: string;
  expiryDate: string | null;
  status: string;
  unitCost?: number;
};

type Meta = {
  period: { from: string | null; to: string | null };
  totals: Figures & { batchCount: number };
};

type Vendor = { id: string; displayName: string };

const STATUSES = ['AVAILABLE', 'PENDING_QC', 'ON_HOLD', 'EXPIRED', 'RECALLED', 'REJECTED'];

const PRESETS = ['this-month', 'this-quarter', 'this-fy', 'last-fy'];

const qty = (n: number) => Number(n).toLocaleString(numberLocale());

const fromOf = (r: Row) =>
  r.vendor?.displayName ?? (r.sourceType === 'item_opening_stock' ? 'Opening stock' : '—');

function Count({ value, warn = false }: { value: number; warn?: boolean }) {
  if (!value) return <span className="text-muted-foreground/60">—</span>;
  return <span className={warn ? 'text-warning' : undefined}>{qty(value)}</span>;
}

function figuresOf(f: Figures, costs: boolean) {
  return [
    { label: 'Received', value: qty(f.received) },
    { label: 'Sold', value: qty(f.sold) },
    { label: 'Left', value: qty(f.left) },
    { label: 'Returned', value: qty(f.returned) },
    { label: 'Adjusted', value: qty(f.adjusted) },
    { label: 'Moved', value: qty(f.moved) },
    { label: 'Rejected', value: qty(f.rejected) },
    { label: 'Customers', value: qty(f.customers) },
    ...(costs ? [{ label: 'Value left', value: money(f.leftValue ?? 0) }] : []),
  ];
}

function FigureGrid({ figures }: { figures: { label: string; value: string }[] }) {
  return (
    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
      {figures.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="truncate text-muted-foreground">{f.label}</dt>
          <dd className="truncate font-medium tabular-nums text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function BatchHistoryReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState<Range>(() => presetRange('this-fy'));
  const [search, setSearch] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Row[]; meta: Meta }>('/reports/batch-trace', {
        from: range.from || undefined,
        to: range.to || undefined,
        search: search.trim() || undefined,
        vendorId: vendorId || undefined,
        status: status || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, search, vendorId, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const sel = useRowSelection(rows);

  const t = meta?.totals;
  const costs = t?.leftValue !== undefined;
  const filtered = Boolean(search || vendorId || status);
  const period = `${shortDate(range.from)} to ${shortDate(range.to)}`;
  const emptyMessage = filtered
    ? 'No batches match these filters'
    : `No batches received between ${shortDate(range.from)} and ${shortDate(range.to)}`;

  function exportSpec() {
    const columns: Column<Row>[] = [
      { header: 'Batch', value: (r) => r.batchNo ?? 'No batch no.', width: 110 },
      { header: 'Item', value: (r) => r.item.name, width: 170 },
      { header: 'SKU', value: (r) => r.item.sku ?? '' },
      { header: 'From', value: (r) => fromOf(r), width: 130 },
      { header: 'Received on', value: (r) => shortDate(r.receivedAt) },
      { header: 'Received', value: (r) => r.received, align: 'right' },
      { header: 'Sold', value: (r) => r.sold, align: 'right' },
      { header: 'Returned to vendor', value: (r) => r.returned, align: 'right' },
      { header: 'Adjusted', value: (r) => r.adjusted, align: 'right' },
      { header: 'Moved', value: (r) => r.moved, align: 'right' },
      { header: 'Rejected at QC', value: (r) => r.rejected, align: 'right' },
      { header: 'Left', value: (r) => r.left, align: 'right' },
      { header: 'Customers', value: (r) => r.customers, align: 'right' },
      { header: 'Status', value: (r) => lotStatusOf(r.status).label },
      ...(costs
        ? [
            { header: 'Unit cost', value: (r: Row) => r.unitCost ?? 0, money: true },
            { header: 'Batch cost', value: (r: Row) => r.receivedValue ?? 0, money: true },
            { header: 'Value left', value: (r: Row) => r.leftValue ?? 0, money: true },
          ]
        : []),
    ];
    return {
      title: 'Batch history',
      subtitle: `Batches received ${period}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total', '', '', '', '',
        t?.received ?? 0, t?.sold ?? 0, t?.returned ?? 0, t?.adjusted ?? 0,
        t?.moved ?? 0, t?.rejected ?? 0, t?.left ?? 0, t?.customers ?? 0, '',
        ...(costs ? ['', t?.receivedValue ?? 0, t?.leftValue ?? 0] : []),
      ],
      footnote:
        'Sold is units that went out on invoices, orders and delivery challans. Anything voided or ' +
        'cancelled is taken back off. Units moved to another location still count under Sold or Left.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Batch history"
        subtitle="Every batch you received, and where its units went"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className={`mb-5 grid grid-cols-2 gap-4 ${costs ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <StatCard
            label="Batches"
            value={qty(t.batchCount)}
            sub={`${qty(t.received)} units received`}
          />
          <StatCard
            label="Sold"
            value={qty(t.sold)}
            sub={`to ${qty(t.customers)} customer${t.customers === 1 ? '' : 's'}`}
            tone="green"
          />
          <StatCard
            label="Left in stock"
            value={qty(t.left)}
            sub={t.inTransit > 0 ? `${qty(t.inTransit)} on the way` : 'across all locations'}
          />
          <StatCard
            label="Rejected at QC"
            value={qty(t.rejected)}
            sub={`${qty(t.returned)} sent back to vendors`}
            tone={t.rejected > 0 ? 'amber' : 'slate'}
          />
          {costs && (
            <StatCard
              label="Value left"
              value={money(t.leftValue ?? 0)}
              sub={`at cost, of ${money(t.receivedValue ?? 0)} bought`}
            />
          )}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRange
            label="Received"
            from={range.from}
            to={range.to}
            presets={PRESETS}
            onChange={setRange}
          />
          <label className="block w-full sm:w-64">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Search</span>
            <Input
              placeholder="Batch number or item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </label>
          <label className="block w-full sm:w-auto">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Vendor</span>
            <Select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full sm:w-52"
            >
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.displayName}</option>
              ))}
            </Select>
          </label>
          <label className="block w-full sm:w-auto">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Status</span>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{lotStatusOf(s).label}</option>
              ))}
            </Select>
          </label>
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setVendorId('');
                setStatus('');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />
        {loading ? (
          <Loading />
        ) : (
          <>
            <CardList empty={emptyMessage}>
              {rows.length
                ? [
                    ...rows.map((r, i) => {
                      const s = lotStatusOf(r.status);
                      return (
                        <li key={r.id} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="pt-0.5">
                              <SelectBox
                                checked={sel.isSelected(sel.idOf(r, i))}
                                onToggle={() => sel.toggle(sel.idOf(r, i))}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <Link
                                  href={`/admin/batches/${r.id}`}
                                  className="min-w-0 truncate font-mono text-sm font-medium text-gold-ink"
                                >
                                  {r.batchNo ?? 'No batch no.'}
                                </Link>
                                <Badge tone={s.tone}>{s.label}</Badge>
                              </div>
                              <div className="mt-0.5 truncate text-sm text-foreground">{r.item.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {fromOf(r)} · received {shortDate(r.receivedAt)}
                              </div>
                              <FigureGrid figures={figuresOf(r, costs)} />
                              {r.inTransit > 0 && (
                                <div className="mt-1.5 text-xs text-muted-foreground">
                                  {qty(r.inTransit)} on the way to another location
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    }),
                    t && (
                      <li key="total" className="bg-muted/40 px-4 py-3">
                        <div className="text-sm font-semibold text-foreground">
                          Total · {qty(t.batchCount)} batch{t.batchCount === 1 ? '' : 'es'}
                        </div>
                        <FigureGrid figures={figuresOf(t, costs)} />
                      </li>
                    ),
                  ]
                : []}
            </CardList>

            <div className="hidden md:block">
              <Table minWidth={costs ? '1480px' : '1280px'}>
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
                    <Th>FROM</Th>
                    <Th>RECEIVED ON</Th>
                    <Th className="text-right">RECEIVED</Th>
                    <Th className="text-right">SOLD</Th>
                    <Th className="text-right">RETURNED</Th>
                    <Th className="text-right">ADJUSTED</Th>
                    <Th className="text-right">MOVED</Th>
                    <Th className="text-right">REJECTED</Th>
                    <Th className="text-right">LEFT</Th>
                    <Th className="text-right">CUSTOMERS</Th>
                    <Th>STATUS</Th>
                    {costs && <Th className="text-right">UNIT COST</Th>}
                    {costs && <Th className="text-right">VALUE LEFT</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <EmptyRow colSpan={costs ? 16 : 14} message={emptyMessage} />
                  )}
                  {rows.map((r, i) => {
                    const s = lotStatusOf(r.status);
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
                            className="whitespace-nowrap font-mono font-medium text-gold-ink hover:underline"
                          >
                            {r.batchNo ?? 'No batch no.'}
                          </Link>
                        </Td>
                        <Td>
                          <div className="min-w-40 font-medium">{r.item.name}</div>
                          {r.item.sku && (
                            <div className="font-mono text-[11px] text-muted-foreground">{r.item.sku}</div>
                          )}
                        </Td>
                        <Td className="text-muted-foreground">{fromOf(r)}</Td>
                        <Td className="whitespace-nowrap">
                          {shortDate(r.receivedAt)}
                          {r.location && (
                            <span className="block text-[11px] text-muted-foreground">at {r.location.name}</span>
                          )}
                        </Td>
                        <Td className="text-right">{qty(r.received)}</Td>
                        <Td className="text-right"><Count value={r.sold} /></Td>
                        <Td className="text-right"><Count value={r.returned} /></Td>
                        <Td className="text-right"><Count value={r.adjusted} /></Td>
                        <Td className="text-right"><Count value={r.moved} /></Td>
                        <Td className="text-right"><Count value={r.rejected} warn /></Td>
                        <Td className="whitespace-nowrap text-right font-semibold">
                          {qty(r.left)}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">{r.item.unit}</span>
                          {r.inTransit > 0 && (
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {qty(r.inTransit)} on the way
                            </span>
                          )}
                        </Td>
                        <Td className="text-right"><Count value={r.customers} /></Td>
                        <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
                        {costs && <Td className="text-right text-muted-foreground">{money(r.unitCost ?? 0)}</Td>}
                        {costs && <Td className="text-right font-medium">{money(r.leftValue ?? 0)}</Td>}
                      </tr>
                    );
                  })}
                  {t && rows.length > 0 && (
                    <tr className="border-t-2 border-border font-semibold">
                      <Td />
                      <Td>Total</Td>
                      <Td className="text-muted-foreground">
                        {qty(t.batchCount)} batch{t.batchCount === 1 ? '' : 'es'}
                      </Td>
                      <Td />
                      <Td />
                      <Td className="text-right">{qty(t.received)}</Td>
                      <Td className="text-right">{qty(t.sold)}</Td>
                      <Td className="text-right">{qty(t.returned)}</Td>
                      <Td className="text-right">{qty(t.adjusted)}</Td>
                      <Td className="text-right">{qty(t.moved)}</Td>
                      <Td className="text-right">{qty(t.rejected)}</Td>
                      <Td className="text-right">{qty(t.left)}</Td>
                      <Td className="text-right">{qty(t.customers)}</Td>
                      <Td />
                      {costs && <Td />}
                      {costs && <Td className="text-right">{money(t.leftValue ?? 0)}</Td>}
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Sold is units that went out on invoices, orders and delivery challans. Anything voided or
        cancelled is taken back off. Units moved to another location still count under Sold or
        Left. Rejected units sent back to the vendor show under both Rejected and
        Returned. Units a customer sends back are not matched to a batch, so they stay under Sold.
        The customer total counts each customer once.
      </p>
    </>
  );
}
