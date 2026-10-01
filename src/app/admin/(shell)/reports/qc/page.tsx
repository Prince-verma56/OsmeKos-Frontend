'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { CardList, RecordCard } from '@/components/CardList';
import { DateRange, presetRange } from '@/components/DateRange';
import type { Column } from '@/lib/export';
import {
  Badge, Card, EmptyRow, ErrorBox, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type Named = { id: string; name: string };

type VendorRow = {
  id: string | null;
  name: string;
  inspections: number;
  unitsInspected: number;
  accepted: number;
  rejected: number;
  rejectionRate: number;
  rejectedValue?: number;
};

type ReasonRow = {
  id: string | null;
  name: string;
  timesUsed: number;
  rejected: number;
  share: number;
};

type Rejection = {
  id: string;
  inspectionNumber: string;
  inspectedAt: string;
  batch: { id: string; batchNo: string | null };
  item: { id: string; name: string; sku: string | null; unit: string; itemCategory: string };
  vendor: Named | null;
  quantityRejected: number;
  reason: string;
  credit: {
    state: 'NONE' | 'PART' | 'FULL';
    quantity: number;
    credits: { id: string; creditNumber: string }[];
  };
  unitCost?: number;
  rejectedValue?: number;
};

type Totals = {
  inspections: number;
  unitsInspected: number;
  accepted: number;
  rejected: number;
  rejectionRate: number;
  rejectionCount: number;
  vendorCount: number;
  creditedUnits: number;
  uncreditedUnits: number;
  rejectedValue?: number;
  uncreditedValue?: number;
};

type Report = {
  data: { byVendor: VendorRow[]; byReason: ReasonRow[]; rejections: Rejection[] };
  meta: {
    period: { from: string | null; to: string | null };
    vendors: Named[];
    totals: Totals;
  };
};

const KINDS = [
  { value: '', label: 'All kinds' },
  { value: 'FINISHED_GOOD', label: 'Finished products' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'RAW_MATERIAL', label: 'Raw materials' },
  { value: 'CONSUMABLE', label: 'Consumables' },
];

const qty = (n: number) => Number(n).toLocaleString(numberLocale());
const pct = (n: number) =>
  `${Number(n).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })}%`;

const creditText = (r: Rejection) =>
  r.credit.state === 'FULL'
    ? 'Credited'
    : r.credit.state === 'PART'
      ? `${qty(r.credit.quantity)} of ${qty(r.quantityRejected)} credited`
      : 'Not credited';

function CreditBadge({ r }: { r: Rejection }) {
  const tone = r.credit.state === 'FULL' ? 'green' : r.credit.state === 'PART' ? 'amber' : 'sand';
  return <Badge tone={tone}>{creditText(r)}</Badge>;
}

function CreditLinks({ r }: { r: Rejection }) {
  if (!r.credit.credits.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
      {r.credit.credits.map((c) => (
        <Link
          key={c.id}
          href={`/admin/vendor-credits/${c.id}`}
          className="font-mono text-gold-ink hover:underline"
        >
          {c.creditNumber}
        </Link>
      ))}
    </span>
  );
}

export default function QcRejectionsReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState(() => presetRange('last-30'));
  const [vendorId, setVendorId] = useState('');
  const [itemCategory, setItemCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Report>('/reports/qc', {
        from: range.from,
        to: range.to,
        vendorId: vendorId || undefined,
        itemCategory: itemCategory || undefined,
      });
      setReport(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, vendorId, itemCategory]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const t = report?.meta.totals;
  const byVendor = report?.data.byVendor ?? [];
  const byReason = report?.data.byReason ?? [];
  const rejections = report?.data.rejections ?? [];
  const vendors = report?.meta.vendors ?? [];
  const showCosts = t?.rejectedValue !== undefined;
  const period = `${shortDate(range.from)} to ${shortDate(range.to)}`;
  const between = `between ${shortDate(range.from)} and ${shortDate(range.to)}`;
  const peakShare = byReason.reduce((n, r) => Math.max(n, r.share), 0);

  function exportSpec() {
    const columns: Column<Rejection>[] = [
      { header: 'Date', value: (r) => shortDate(r.inspectedAt) },
      { header: 'QC number', value: (r) => r.inspectionNumber },
      { header: 'Batch', value: (r) => r.batch.batchNo ?? '' },
      { header: 'Item', value: (r) => r.item.name, width: 170 },
      { header: 'SKU', value: (r) => r.item.sku ?? '' },
      { header: 'Vendor', value: (r) => r.vendor?.name ?? 'No vendor on record', width: 140 },
      { header: 'Units rejected', value: (r) => r.quantityRejected, align: 'right' },
      { header: 'Reason', value: (r) => r.reason, width: 140 },
      {
        header: 'Vendor credit',
        value: (r) =>
          [creditText(r), r.credit.credits.map((c) => c.creditNumber).join(', ')]
            .filter(Boolean)
            .join(' - '),
        width: 150,
      },
      ...(showCosts
        ? [{ header: 'Value at cost', value: (r: Rejection) => r.rejectedValue ?? 0, money: true }]
        : []),
    ];
    return {
      title: 'QC Rejections',
      subtitle: `${period} · ${t?.rejectionCount ?? 0} rejection(s) · ${pct(t?.rejectionRate ?? 0)} of units checked`,
      columns,
      rows: rejections,
      totals: [
        'Total', '', '', '', '', '',
        t?.rejected ?? 0,
        '', '',
        ...(showCosts ? [t?.rejectedValue ?? 0] : []),
      ],
      footnote:
        'Only finished QC checks are counted. Checks that were undone are left out.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="QC rejections"
        subtitle="What failed quality checks, which vendor sent it, and why"
        actions={<ExportMenu spec={exportSpec} disabled={!rejections.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div
          className={`mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 ${
            showCosts ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
          }`}
        >
          <StatCard
            label="QC Checks"
            value={qty(t.inspections)}
            sub={`${t.vendorCount} vendor(s)`}
          />
          <StatCard
            label="Units Checked"
            value={qty(t.unitsInspected)}
            sub="in these QC checks"
          />
          <StatCard
            label="Accepted"
            value={qty(t.accepted)}
            sub="passed and kept"
            tone="green"
          />
          <StatCard
            label="Rejected"
            value={qty(t.rejected)}
            sub={`${t.rejectionCount} rejection(s)`}
            tone={t.rejected > 0 ? 'red' : 'slate'}
          />
          <StatCard
            label="Rejection Rate"
            value={pct(t.rejectionRate)}
            sub="of units checked"
            tone={t.rejectionRate > 0 ? 'amber' : 'green'}
          />
          {showCosts && (
            <StatCard
              label="Rejected Value"
              value={money(t.rejectedValue ?? 0)}
              sub={`${money(t.uncreditedValue ?? 0)} not yet credited`}
              tone={(t.uncreditedValue ?? 0) > 0 ? 'amber' : 'slate'}
            />
          )}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRange from={range.from} to={range.to} onChange={setRange} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Vendor
            </span>
            <Select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-56"
            >
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Kind of item
            </span>
            <Select
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              className="w-44"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card">
          <Loading />
        </div>
      ) : report && (
        <div className="space-y-5">
          <Card title="By vendor" padded={false}>
            <Table minWidth={showCosts ? '720px' : '600px'}>
              <thead>
                <tr>
                  <Th>VENDOR</Th>
                  <Th className="text-right">QC CHECKS</Th>
                  <Th className="text-right">UNITS CHECKED</Th>
                  <Th className="text-right">REJECTED</Th>
                  <Th className="text-right">REJECTION RATE</Th>
                  {showCosts && <Th className="text-right">VALUE AT COST</Th>}
                </tr>
              </thead>
              <tbody>
                {byVendor.length === 0 && (
                  <EmptyRow
                    colSpan={showCosts ? 6 : 5}
                    message={`No QC checks were finished ${between}`}
                  />
                )}
                {byVendor.map((v) => (
                  <tr key={v.id ?? 'none'} className="hover:bg-muted/60">
                    <Td>
                      {v.id ? (
                        <Link
                          href={`/admin/vendors/${v.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {v.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{v.name}</span>
                      )}
                    </Td>
                    <Td className="text-right text-muted-foreground">{qty(v.inspections)}</Td>
                    <Td className="text-right">{qty(v.unitsInspected)}</Td>
                    <Td className="text-right">
                      {v.rejected ? (
                        <span className="font-semibold text-destructive">{qty(v.rejected)}</span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </Td>
                    <Td className={`text-right ${v.rejectionRate > 0 ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
                      {pct(v.rejectionRate)}
                    </Td>
                    {showCosts && (
                      <Td className="text-right">
                        {v.rejectedValue ? money(v.rejectedValue) : <span className="text-muted-foreground/60">—</span>}
                      </Td>
                    )}
                  </tr>
                ))}
                {t && byVendor.length > 1 && (
                  <tr className="border-t-2 border-border font-semibold">
                    <Td>Total</Td>
                    <Td className="text-right">{qty(t.inspections)}</Td>
                    <Td className="text-right">{qty(t.unitsInspected)}</Td>
                    <Td className="text-right">{qty(t.rejected)}</Td>
                    <Td className="text-right">{pct(t.rejectionRate)}</Td>
                    {showCosts && <Td className="text-right">{money(t.rejectedValue ?? 0)}</Td>}
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>

          <Card title="By reason" padded={false}>
            <Table minWidth="520px">
              <thead>
                <tr>
                  <Th>REASON</Th>
                  <Th className="text-right">TIMES USED</Th>
                  <Th className="text-right">UNITS REJECTED</Th>
                  <Th className="text-right">SHARE OF REJECTIONS</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {byReason.length === 0 && (
                  <EmptyRow colSpan={5} message={`Nothing was rejected ${between}`} />
                )}
                {byReason.map((r) => (
                  <tr key={r.id ?? `name-${r.name}`} className="hover:bg-muted/60">
                    <Td className="font-medium">{r.name}</Td>
                    <Td className="text-right text-muted-foreground">{qty(r.timesUsed)}</Td>
                    <Td className="text-right">{qty(r.rejected)}</Td>
                    <Td className="text-right font-semibold">{pct(r.share)}</Td>
                    <Td>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-destructive/60"
                          style={{ width: peakShare > 0 ? `${Math.max(2, (r.share / peakShare) * 100)}%` : '0%' }}
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card title="Every rejection" padded={false}>
            <CardList empty={`Nothing was rejected ${between}`}>
              {rejections.map((r) => (
                <RecordCard
                  key={r.id}
                  href={`/admin/batches/${r.batch.id}`}
                  title={r.batch.batchNo ?? 'No batch no.'}
                  amount={`${qty(r.quantityRejected)} ${r.item.unit}`}
                  date={`${shortDate(r.inspectedAt)} · ${r.inspectionNumber}`}
                  primary={r.item.name}
                  secondary={`${r.vendor?.name ?? 'No vendor on record'} · ${r.reason}`}
                  badges={<CreditBadge r={r} />}
                  footer={r.rejectedValue !== undefined ? `${money(r.rejectedValue)} at cost` : undefined}
                />
              ))}
            </CardList>
            <div className="hidden md:block">
              <Table minWidth={showCosts ? '1080px' : '960px'}>
                <thead>
                  <tr>
                    <Th>DATE</Th>
                    <Th>QC NO.</Th>
                    <Th>BATCH</Th>
                    <Th>ITEM</Th>
                    <Th>VENDOR</Th>
                    <Th className="text-right">REJECTED</Th>
                    <Th>REASON</Th>
                    <Th>VENDOR CREDIT</Th>
                    {showCosts && <Th className="text-right">VALUE AT COST</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rejections.length === 0 && (
                    <EmptyRow
                      colSpan={showCosts ? 9 : 8}
                      message={`Nothing was rejected ${between}`}
                    />
                  )}
                  {rejections.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/60">
                      <Td className="whitespace-nowrap text-muted-foreground">{shortDate(r.inspectedAt)}</Td>
                      <Td className="whitespace-nowrap font-mono text-xs">{r.inspectionNumber}</Td>
                      <Td>
                        <Link
                          href={`/admin/batches/${r.batch.id}`}
                          className="font-mono font-medium text-gold-ink hover:underline"
                        >
                          {r.batch.batchNo ?? 'No batch no.'}
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/items/${r.item.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.item.name}
                        </Link>
                        {r.item.sku && (
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {r.item.sku}
                          </span>
                        )}
                      </Td>
                      <Td className="text-muted-foreground">{r.vendor?.name ?? 'No vendor on record'}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold text-destructive">
                        {qty(r.quantityRejected)}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          {r.item.unit}
                        </span>
                      </Td>
                      <Td>{r.reason}</Td>
                      <Td>
                        <CreditBadge r={r} />
                        <CreditLinks r={r} />
                      </Td>
                      {showCosts && (
                        <Td className="text-right">{money(r.rejectedValue ?? 0)}</Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Only finished QC checks are counted. Checks that were undone are left out. Vendor credit
        shows whether the rejected units have been sent back to the vendor on a vendor credit.
      </p>
    </>
  );
}
