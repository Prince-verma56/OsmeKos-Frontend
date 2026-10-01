'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale, todayIso } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { AgeingBucketsChart, RankChart } from '@/components/ReportChart';
import type { Column } from '@/lib/export';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type Bucket = { key: string; label: string };

type CustomerRow = {
  id: string;
  customer: { id: string; displayName: string | null; customerType: string | null } | null;
  buckets: Record<string, number>;
  outstanding: number;
  unusedCredits: number;
  invoiceCount: number;
  oldestDays: number;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  customer: { id: string; displayName: string | null } | null;
  grandTotal: number;
  amountPaid: number;
  creditsApplied: number;
  balanceDue: number;
  daysPastDue: number;
  bucket: string;
};

type Meta = {
  asOf: string;
  groupBy: 'customer' | 'invoice';
  buckets: Bucket[];
  totals: {
    outstanding: number;
    overdue: number;
    unusedCredits: number;
    customerCount: number;
    invoiceCount: number;
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

export default function ReceivablesReportPage() {
  const [rows, setRows] = useState<(CustomerRow | InvoiceRow)[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [groupBy, setGroupBy] = useState<'customer' | 'invoice'>('customer');
  const [asOf, setAsOf] = useState(today());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: (CustomerRow | InvoiceRow)[]; meta: Meta }>(
        '/reports/receivables',
        { groupBy, asOf }
      );
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [groupBy, asOf]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const view = meta?.groupBy ?? groupBy;
  const sel = useRowSelection(rows);

  function exportSpec() {
    const buckets = meta?.buckets ?? [];
    const subtitle = `As at ${shortDate(asOf)} · grouped by ${view}`;
    const footnote =
      'Bucketed by how far past due each invoice is, not by how old it is - an invoice on ' +
      '90-day terms is not overdue in its second month. Figures are read back from each ' +
      'invoice; nothing is recalculated.';

    if (view === 'customer') {
      const list = sel.rowsToExport as CustomerRow[];
      const columns: Column<CustomerRow>[] = [
        { header: 'Customer', value: (r) => r.customer?.displayName ?? 'Unassigned', width: 160 },
        { header: 'Type', value: (r) => r.customer?.customerType ?? '' },
        { header: 'Invoices', value: (r) => r.invoiceCount, align: 'right' },
        { header: 'Oldest (days)', value: (r) => r.oldestDays, align: 'right' },
        ...buckets.map((b) => ({
          header: b.label,
          value: (r: CustomerRow) => r.buckets[b.key] ?? 0,
          money: true,
        })),
        { header: 'Outstanding', value: (r) => r.outstanding, money: true },
        { header: 'Unused credits', value: (r) => r.unusedCredits, money: true },
      ];
      return {
        title: 'Receivables Ageing',
        subtitle,
        columns,
        rows: list,
        totals: [
          'Total', '', t?.invoiceCount ?? 0, '',
          ...buckets.map((b) => t?.[b.key] ?? 0),
          t?.outstanding ?? 0,
          t?.unusedCredits ?? 0,
        ],
        footnote,
        orientation: 'landscape' as const,
      };
    }

    const list = sel.rowsToExport as InvoiceRow[];
    const columns: Column<InvoiceRow>[] = [
      { header: 'Invoice', value: (r) => r.invoiceNumber },
      { header: 'Customer', value: (r) => r.customer?.displayName ?? '', width: 150 },
      { header: 'Invoice date', value: (r) => r.invoiceDate.slice(0, 10) },
      { header: 'Due date', value: (r) => r.dueDate?.slice(0, 10) ?? '' },
      { header: 'Days past due', value: (r) => r.daysPastDue, align: 'right' },
      { header: 'Ageing', value: (r) => buckets.find((b) => b.key === r.bucket)?.label ?? r.bucket },
      { header: 'Invoice total', value: (r) => r.grandTotal, money: true },
      { header: 'Paid', value: (r) => r.amountPaid, money: true },
      { header: 'Credits', value: (r) => r.creditsApplied, money: true },
      { header: 'Balance due', value: (r) => r.balanceDue, money: true },
    ];
    return {
      title: 'Receivables Ageing by Invoice',
      subtitle,
      columns,
      rows: list,
      totals: ['Total', '', '', '', '', '', '', '', '', t?.outstanding ?? 0],
      footnote,
      orientation: 'landscape' as const,
    };
  }

  const t = meta?.totals;

  return (
    <>
      <div className="print:hidden">

        <PageHeader
          title="Receivables Ageing"
          subtitle="Who owes you, and how late — bucketed by days past the due date, not by invoice age"
          actions={
            <ExportMenu spec={exportSpec} disabled={!rows.length} />
          }
        />

        {error && (
          <div className="mb-4">
            <ErrorBox message={error} onRetry={load} />
          </div>
        )}

        {t && (
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Outstanding"
              value={money(t.outstanding)}
              sub={`${t.invoiceCount} invoice(s) · ${t.customerCount} customer(s)`}
              tone={t.outstanding > 0 ? 'amber' : 'green'}
            />
            <StatCard
              label="Overdue"
              value={money(t.overdue)}
              sub="past the due date"
              tone={t.overdue > 0 ? 'red' : 'green'}
            />
            <StatCard
              label="90+ Days"
              value={money(t.d90_plus ?? 0)}
              sub="chase these first"
              tone={(t.d90_plus ?? 0) > 0 ? 'red' : 'slate'}
            />
            <StatCard
              label="Unused Credits"
              value={money(t.unusedCredits)}
              sub="credit notes not yet applied"
              tone={t.unusedCredits > 0 ? 'purple' : 'slate'}
            />
          </div>
        )}

        {t && meta && !loading && (
          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">How late the money is</h3>
              <p className="mb-3 text-xs text-muted-foreground">Outstanding by days past the due date</p>
              <AgeingBucketsChart
                buckets={meta.buckets.map((b) => ({ key: b.key, label: b.label, value: t[b.key] ?? 0 }))}
              />
            </div>
            <div className="min-w-0 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {view === 'customer' ? 'Who owes the most' : 'Largest unpaid invoices'}
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">Top 6 by balance due</p>
              <RankChart
                tone="amber"
                valueLabel="Balance due"
                points={
                  view === 'customer'
                    ? (rows as CustomerRow[]).map((r) => ({
                        label: r.customer?.displayName ?? 'Unassigned',
                        value: r.outstanding,
                      }))
                    : (rows as InvoiceRow[]).map((r) => ({
                        label: `${r.invoiceNumber} · ${r.customer?.displayName ?? 'Unassigned'}`,
                        value: r.balanceDue,
                      }))
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-3 print:hidden">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Group by
            </span>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'customer' | 'invoice')}
            >
              <option value="customer">Customer</option>
              <option value="invoice">Invoice</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              As at
            </span>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
          </label>
          {asOf !== today() && (
            <Button variant="ghost" onClick={() => setAsOf(today())}>Back to today</Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Ageing is measured against the due date as at {shortDate(asOf)}
          </span>
        </div>

        <SelectionBar count={sel.count} total={rows.length} onClear={sel.clear} />

        {loading ? (
          <Loading />
        ) : view === 'customer' ? (
          <Table minWidth="980px">
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllBox
                    allSelected={sel.allSelected}
                    someSelected={sel.someSelected}
                    onToggle={sel.toggleAll}
                  />
                </Th>
                <Th>CUSTOMER</Th>
                <Th className="text-right">INVOICES</Th>
                {meta?.buckets.map((b) => (
                  <Th key={b.key} className="text-right">{b.label.toUpperCase()}</Th>
                ))}
                <Th className="text-right">OUTSTANDING</Th>
                <Th className="text-right">UNUSED CREDIT</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={10} message="Nobody owes you anything — nothing outstanding" />
              )}
              {(rows as CustomerRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  <Td>
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, 0))}
                      onToggle={() => sel.toggle(sel.idOf(r, 0))}
                    />
                  </Td>
                  <Td>
                    {r.customer ? (
                      <Link
                        href={`/admin/customers/${r.customer.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {r.customer.displayName ?? 'Customer'}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                    {r.oldestDays > 0 && (
                      <div className="text-[11px] text-muted-foreground">
                        oldest {r.oldestDays.toLocaleString(numberLocale())} days late
                      </div>
                    )}
                  </Td>
                  <Td className="text-right text-xs text-muted-foreground">
                    {r.invoiceCount}
                  </Td>
                  {meta?.buckets.map((b) => (
                    <Td key={b.key} className={`whitespace-nowrap text-right ${bucketTone(b.key, r.buckets[b.key] ?? 0)}`}>
                      {(r.buckets[b.key] ?? 0) > 0 ? money(r.buckets[b.key]) : '—'}
                    </Td>
                  ))}
                  <Td className="whitespace-nowrap text-right font-semibold">
                    {money(r.outstanding)}
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-gold-ink">
                    {r.unusedCredits > 0 ? money(r.unusedCredits) : '—'}
                  </Td>
                </tr>
              ))}
              {rows.length > 0 && meta && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  <Td className="text-right text-xs">{meta.totals.invoiceCount}</Td>
                  {meta.buckets.map((b) => (
                    <Td key={b.key} className="whitespace-nowrap text-right">
                      {money(meta.totals[b.key] ?? 0)}
                    </Td>
                  ))}
                  <Td className="whitespace-nowrap text-right">{money(meta.totals.outstanding)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {money(meta.totals.unusedCredits)}
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        ) : (
          <Table minWidth="1000px">
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllBox
                    allSelected={sel.allSelected}
                    someSelected={sel.someSelected}
                    onToggle={sel.toggleAll}
                  />
                </Th>
                <Th>INVOICE#</Th>
                <Th>CUSTOMER</Th>
                <Th>INVOICE DATE</Th>
                <Th>DUE DATE</Th>
                <Th className="text-right">DAYS LATE</Th>
                <Th>STATUS</Th>
                <Th className="text-right">TOTAL</Th>
                <Th className="text-right">SETTLED</Th>
                <Th className="text-right">BALANCE DUE</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={10} message="No open invoices as at this date" />
              )}
              {(rows as InvoiceRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  <Td>
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, 0))}
                      onToggle={() => sel.toggle(sel.idOf(r, 0))}
                    />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/invoices/${r.id}`}
                      className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                  </Td>
                  <Td>{r.customer?.displayName ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {shortDate(r.invoiceDate)}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.dueDate ? shortDate(r.dueDate) : '—'}
                  </Td>
                  <Td className={`whitespace-nowrap text-right ${bucketTone(r.bucket, 1)}`}>
                    {r.daysPastDue > 0 ? r.daysPastDue.toLocaleString(numberLocale()) : '—'}
                  </Td>
                  <Td>
                    <Badge status={r.status}>{r.status.replaceAll('_', ' ')}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">{money(r.grandTotal)}</Td>
                  <Td className="whitespace-nowrap text-right text-xs text-muted-foreground">
                    {money(r.amountPaid + r.creditsApplied)}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold">
                    {money(r.balanceDue)}
                  </Td>
                </tr>
              ))}
              {rows.length > 0 && meta && (
                <tr className="border-t-2 border-border font-semibold">
                  <Td />
                  <Td>Total</Td>
                  <Td /><Td /><Td /><Td /><Td /><Td /><Td />
                  <Td className="whitespace-nowrap text-right">{money(meta.totals.outstanding)}</Td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
