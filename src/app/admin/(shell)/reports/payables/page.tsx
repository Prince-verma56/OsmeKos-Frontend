'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, todayIso } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { AgeingBucketsChart, RankChart } from '@/components/ReportChart';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import {
  Badge, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type Bucket = { key: string; label: string };

type Vendor = {
  id: string;
  displayName: string | null;
  companyName: string | null;
  gstin: string | null;
  paymentTerms: string | null;
};

type VendorRow = {
  id: string;
  vendor: Vendor | null;
  buckets: Record<string, number>;
  outstanding: number;
  unusedCredits: number;
  unappliedAdvances: number;
  netPayable: number;
  billCount: number;
  oldestDays: number;
};

type BillRow = {
  id: string;
  billNumber: string;
  billDate: string;
  dueDate: string | null;
  status: string;
  isReverseCharge: boolean;
  vendor: Vendor | null;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  daysPastDue: number;
  bucket: string;
};

type Meta = {
  asOf: string;
  groupBy: 'vendor' | 'bill';
  buckets: Bucket[];
  totals: {
    outstanding: number;
    overdue: number;
    unusedCredits: number;
    unappliedAdvances: number;
    netPayable: number;
    reverseCharge: number;
    vendorCount: number;
    billCount: number;
  } & Record<string, number>;
};

const today = () => todayIso();

function bucketTone(key: string, value: number): string {
  if (value <= 0) return 'text-muted-foreground/60';
  if (key === 'current') return 'text-muted-foreground';
  if (key === 'd90_plus') return 'font-semibold text-destructive';
  if (key === 'd61_90') return 'text-destructive';
  return 'text-warning';
}

const vendorName = (v: Vendor | null) =>
  v?.companyName || v?.displayName || 'Unassigned';

export default function PayablesReportPage() {
  const [rows, setRows] = useState<(VendorRow | BillRow)[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [groupBy, setGroupBy] = useState<'vendor' | 'bill'>('vendor');
  const [asOf, setAsOf] = useState(today());
  const [hideZero, setHideZero] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: (VendorRow | BillRow)[]; meta: Meta }>(
        '/reports/payables',
        { groupBy, asOf, hideZero }
      );
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [groupBy, asOf, hideZero]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const buckets = meta?.buckets ?? [];
  const sel = useRowSelection(rows);

  const t = meta?.totals;
  const byVendor = groupBy === 'vendor';

  function exportSpec() {
    const subtitle = `As at ${shortDate(asOf)} · grouped by ${byVendor ? 'vendor' : 'bill'}`;
    const footnote =
      'Bucketed by days past due, not by age — a bill on 60-day terms is not late in its first month. ' +
      'Figures are read back from each bill; nothing is recalculated.';

    if (byVendor) {
      const list = sel.rowsToExport as VendorRow[];
      const columns: Column<VendorRow>[] = [
        { header: 'Vendor', value: (r) => vendorName(r.vendor), width: 150 },
        { header: 'GSTIN', value: (r) => r.vendor?.gstin ?? '' },
        { header: 'Bills', value: (r) => r.billCount, align: 'right' },
        { header: 'Oldest (days)', value: (r) => r.oldestDays, align: 'right' },
        ...buckets.map((b) => ({
          header: b.label,
          value: (r: VendorRow) => r.buckets[b.key] ?? 0,
          money: true,
        })),
        { header: 'Outstanding', value: (r) => r.outstanding, money: true },
        { header: 'Credits held', value: (r) => r.unusedCredits, money: true },
        { header: 'Advances paid', value: (r) => r.unappliedAdvances, money: true },
        { header: 'Net payable', value: (r) => r.netPayable, money: true },
      ];
      return {
        title: 'Payables Ageing',
        subtitle,
        columns,
        rows: list,
        totals: [
          'Total',
          '',
          t?.billCount ?? 0,
          '',
          ...buckets.map((b) => t?.[b.key] ?? 0),
          t?.outstanding ?? 0,
          t?.unusedCredits ?? 0,
          t?.unappliedAdvances ?? 0,
          t?.netPayable ?? 0,
        ],
        footnote,
        orientation: 'landscape' as const,
      };
    }

    const list = sel.rowsToExport as BillRow[];
    const columns: Column<BillRow>[] = [
      { header: 'Bill #', value: (r) => r.billNumber },
      { header: 'Vendor', value: (r) => vendorName(r.vendor), width: 150 },
      { header: 'Bill date', value: (r) => r.billDate.slice(0, 10) },
      { header: 'Due date', value: (r) => r.dueDate?.slice(0, 10) ?? '' },
      { header: 'Days past due', value: (r) => r.daysPastDue, align: 'right' },
      { header: 'Ageing', value: (r) => buckets.find((b) => b.key === r.bucket)?.label ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Reverse charge', value: (r) => (r.isReverseCharge ? 'Yes' : '') },
      { header: 'Bill total', value: (r) => r.grandTotal, money: true },
      { header: 'Paid', value: (r) => r.amountPaid, money: true },
      { header: 'Balance due', value: (r) => r.balanceDue, money: true },
    ];
    return {
      title: 'Payables Ageing by Bill',
      subtitle,
      columns,
      rows: list,
      totals: ['Total', '', '', '', '', '', '', '', '', '', t?.outstanding ?? 0],
      footnote,
      orientation: 'landscape' as const,
    };
  }

  return (
    <>

      <PageHeader
        title="Payables Ageing"
        subtitle="What we owe suppliers, and how late it is — the mirror of receivables"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Outstanding"
            value={money(t.outstanding)}
            sub={`${t.billCount} bill(s) across ${t.vendorCount} vendor(s)`}
          />
          <StatCard
            label="Overdue"
            value={money(t.overdue)}
            sub="past its due date"
            tone={t.overdue > 0 ? 'red' : 'slate'}
          />
          <StatCard
            label="Held against it"
            value={money(t.unusedCredits + t.unappliedAdvances)}
            sub="vendor credits and advances already paid"
            tone="green"
          />
          <StatCard
            label="Net payable"
            value={money(t.netPayable)}
            sub="what you would actually hand over today"
            tone="amber"
          />
        </div>
      )}

      {t && meta && !loading && (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">How late our payments are</h3>
            <p className="mb-3 text-xs text-muted-foreground">Outstanding by days past the due date</p>
            <AgeingBucketsChart
              buckets={meta.buckets.map((b) => ({ key: b.key, label: b.label, value: t[b.key] ?? 0 }))}
            />
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {groupBy === 'vendor' ? 'Who we owe the most' : 'Largest unpaid bills'}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">Top 6 by balance due</p>
            <RankChart
              tone="amber"
              valueLabel="Balance due"
              points={
                groupBy === 'vendor'
                  ? (rows as VendorRow[]).map((r) => ({ label: vendorName(r.vendor), value: r.outstanding }))
                  : (rows as BillRow[]).map((r) => ({
                      label: `${r.billNumber} · ${vendorName(r.vendor)}`,
                      value: r.balanceDue,
                    }))
              }
            />
          </div>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              As at
            </span>
            <Input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="w-44"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Group by
            </span>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'vendor' | 'bill')}
              className="w-40"
            >
              <option value="vendor">Vendor</option>
              <option value="bill">Bill</option>
            </Select>
          </label>
          {byVendor && (
            <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(e) => setHideZero(e.target.checked)}
              />
              Hide settled vendors
            </label>
          )}
          <p className="ml-auto max-w-sm pb-1 text-right text-xs text-muted-foreground">
            Bucketed by days past due, not by age — a bill on 60-day terms is not late in its first
            month.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />
        {loading ? (
          <Loading />
        ) : byVendor ? (
          <Table minWidth="1080px">
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllBox
                    allSelected={sel.allSelected}
                    someSelected={sel.someSelected}
                    onToggle={sel.toggleAll}
                  />
                </Th>
                <Th>VENDOR</Th>
                <Th className="text-right">BILLS</Th>
                {buckets.map((b) => (
                  <Th key={b.key} className="text-right">{b.label.toUpperCase()}</Th>
                ))}
                <Th className="text-right">OUTSTANDING</Th>
                <Th className="text-right">HELD</Th>
                <Th className="text-right">NET PAYABLE</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={buckets.length + 6} message="Nothing owed to anyone" />
              )}
              {(rows as VendorRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  <Td>
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, 0))}
                      onToggle={() => sel.toggle(sel.idOf(r, 0))}
                    />
                  </Td>
                  <Td>
                    {r.vendor ? (
                      <Link
                        href={`/admin/vendors/${r.vendor.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {vendorName(r.vendor)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                    {r.oldestDays > 0 && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        oldest {r.oldestDays}d
                      </span>
                    )}
                  </Td>
                  <Td className="text-right text-muted-foreground">{r.billCount}</Td>
                  {buckets.map((b) => (
                    <Td key={b.key} className={`text-right ${bucketTone(b.key, r.buckets[b.key] ?? 0)}`}>
                      {r.buckets[b.key] ? money(r.buckets[b.key]) : '—'}
                    </Td>
                  ))}
                  <Td className="text-right font-medium">{money(r.outstanding)}</Td>
                  <Td className="text-right text-success">
                    {r.unusedCredits + r.unappliedAdvances
                      ? money(r.unusedCredits + r.unappliedAdvances)
                      : '—'}
                  </Td>
                  <Td className="text-right font-semibold">{money(r.netPayable)}</Td>
                </tr>
              ))}
              {t && rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  <Td className="text-right">{t.billCount}</Td>
                  {buckets.map((b) => (
                    <Td key={b.key} className="text-right">
                      {t[b.key] ? money(t[b.key]) : '—'}
                    </Td>
                  ))}
                  <Td className="text-right">{money(t.outstanding)}</Td>
                  <Td className="text-right">
                    {money(t.unusedCredits + t.unappliedAdvances)}
                  </Td>
                  <Td className="text-right">{money(t.netPayable)}</Td>
                </tr>
              )}
            </tbody>
          </Table>
        ) : (
          <Table minWidth="1020px">
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllBox
                    allSelected={sel.allSelected}
                    someSelected={sel.someSelected}
                    onToggle={sel.toggleAll}
                  />
                </Th>
                <Th>BILL #</Th>
                <Th>VENDOR</Th>
                <Th>BILL DATE</Th>
                <Th>DUE DATE</Th>
                <Th className="text-right">PAST DUE</Th>
                <Th>AGEING</Th>
                <Th className="text-right">BILL TOTAL</Th>
                <Th className="text-right">PAID</Th>
                <Th className="text-right">BALANCE</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={10} message="No open bills" />}
              {(rows as BillRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  <Td>
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, 0))}
                      onToggle={() => sel.toggle(sel.idOf(r, 0))}
                    />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/bills/${r.id}`}
                      className="font-medium text-gold-ink hover:underline"
                    >
                      {r.billNumber}
                    </Link>
                    {r.isReverseCharge && (
                      <span className="ml-1.5 text-[10px] text-warning">
                        RCM
                      </span>
                    )}
                  </Td>
                  <Td>{vendorName(r.vendor)}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {shortDate(r.billDate)}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.dueDate ? shortDate(r.dueDate) : '—'}
                  </Td>
                  <Td className={`text-right ${bucketTone(r.bucket, r.balanceDue)}`}>
                    {r.daysPastDue > 0 ? `${r.daysPastDue}d` : '—'}
                  </Td>
                  <Td>
                    <Badge tone={r.bucket === 'current' ? 'gray' : r.bucket === 'd90_plus' ? 'red' : 'amber'}>
                      {buckets.find((b) => b.key === r.bucket)?.label ?? r.bucket}
                    </Badge>
                  </Td>
                  <Td className="text-right">{money(r.grandTotal)}</Td>
                  <Td className="text-right text-muted-foreground">
                    {r.amountPaid ? money(r.amountPaid) : '—'}
                  </Td>
                  <Td className="text-right font-medium">{money(r.balanceDue)}</Td>
                </tr>
              ))}
              {t && rows.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  <Td /><Td /><Td /><Td /><Td /><Td /><Td />
                  <Td className="text-right">{money(t.outstanding)}</Td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>

      {t && t.reverseCharge > 0 && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {money(t.reverseCharge)} of this sits on reverse-charge bills. You pay that GST yourself
          rather than to the supplier, so it does not become input credit until you have.
        </p>
      )}
    </>
  );
}
