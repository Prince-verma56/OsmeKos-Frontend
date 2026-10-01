'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { RankChart } from '@/components/ReportChart';
import { CardList, RecordCard } from '@/components/CardList';
import { ACCOUNTING_RANGES, DateRange, presetRange, type Range } from '@/components/DateRange';
import {
  useRowSelection, SelectAllBox, SelectBox, SelectionBar,
} from '@/components/RowSelect';
import type { Column } from '@/lib/export';
import {
  Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';

type Row = {
  id: string;
  name: string;
  contactName: string | null;
  gstin: string | null;
  invoiceCount: number;
  taxable: number;
  tax: number;
  invoiced: number;
  creditCount: number;
  credited: number;
  creditedTotal: number;
  netSales: number;
  received: number;
  due: number;
  dueInvoiceCount: number;
  overdue: number;
  overdueInvoiceCount: number;
  lastInvoiceDate: string | null;
  topProduct: { id: string | null; name: string; value: number } | null;
};

type Meta = {
  period: { from: string; to: string };
  overdueAsOf: string;
  totals: {
    accountCount: number;
    accountsBilled: number;
    accountsWithDues: number;
    accountsOverdue: number;
    invoiceCount: number;
    creditCount: number;
    taxable: number;
    tax: number;
    invoiced: number;
    credited: number;
    creditedTotal: number;
    netSales: number;
    received: number;
    due: number;
    overdue: number;
  };
};

type Show = 'all' | 'due';

const RANGES = [...ACCOUNTING_RANGES, 'last-fy'];

const dash = <span className="text-muted-foreground/60">—</span>;

const amountOrDash = (n: number, className = '') =>
  n ? <span className={className}>{money(n)}</span> : dash;

export default function B2bSalesReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState<Range>(() => presetRange('this-fy'));
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Row[]; meta: Meta }>('/reports/b2b-sales', {
        from: range.from || undefined,
        to: range.to || undefined,
        search: search.trim() || undefined,
        dueOnly: show === 'due' ? true : undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, search, show]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const sel = useRowSelection(rows);

  const t = meta?.totals;
  const from = meta?.period.from ?? range.from;
  const to = meta?.period.to ?? range.to;
  const filtering = Boolean(search || show !== 'all');

  const emptyMessage =
    show === 'due'
      ? 'No business account owes money right now'
      : search
        ? 'No business account matches that search'
        : `No business sales between ${shortDate(from)} and ${shortDate(to)}`;

  function exportSpec() {
    const columns: Column<Row>[] = [
      { header: 'Account', value: (r) => r.name, width: 170 },
      { header: 'GSTIN', value: (r) => r.gstin ?? '' },
      { header: 'Invoices', value: (r) => r.invoiceCount, align: 'right' },
      { header: 'Sales before GST', value: (r) => r.taxable, money: true },
      { header: 'GST', value: (r) => r.tax, money: true },
      { header: 'Invoice total', value: (r) => r.invoiced, money: true },
      { header: 'Credit notes', value: (r) => r.credited, money: true },
      { header: 'Net sales', value: (r) => r.netSales, money: true },
      { header: 'Received', value: (r) => r.received, money: true },
      { header: 'Due now', value: (r) => r.due, money: true },
      { header: 'Overdue', value: (r) => r.overdue, money: true },
      { header: 'Last invoice', value: (r) => (r.lastInvoiceDate ? shortDate(r.lastInvoiceDate) : '') },
      { header: 'Top product', value: (r) => r.topProduct?.name ?? '', width: 150 },
    ];
    return {
      title: 'B2B sales by account',
      subtitle: `${shortDate(from)} to ${shortDate(to)}`,
      columns,
      rows: sel.rowsToExport,
      totals: [
        'Total',
        '',
        t?.invoiceCount ?? 0,
        t?.taxable ?? 0,
        t?.tax ?? 0,
        t?.invoiced ?? 0,
        t?.credited ?? 0,
        t?.netSales ?? 0,
        t?.received ?? 0,
        t?.due ?? 0,
        t?.overdue ?? 0,
        '',
        '',
      ],
      footnote:
        'Sales and credit notes are before GST. Net sales is sales minus credit notes. Received ' +
        'counts payments dated in this period, including any TDS the customer kept back. Due now ' +
        'and overdue are what is still unpaid today on bills raised up to the end of this period.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="B2B sales"
        subtitle="What each business account bought, and what they still owe"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Accounts Billed"
            value={String(t.accountsBilled)}
            sub={`${t.invoiceCount} invoice(s)`}
          />
          <StatCard
            label="Net Sales"
            value={money(t.netSales)}
            sub="before GST, after credit notes"
            tone="green"
          />
          <StatCard
            label="Due"
            value={money(t.due)}
            sub={`${t.accountsWithDues} account(s) owe money`}
            tone={t.due > 0 ? 'amber' : 'slate'}
          />
          <StatCard
            label="Overdue"
            value={money(t.overdue)}
            sub={`${t.accountsOverdue} account(s) past the due date`}
            tone={t.overdue > 0 ? 'red' : 'slate'}
          />
        </div>
      )}

      {rows.some((r) => r.netSales !== 0) && (
        <div className="mb-5 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top accounts by net sales
          </h3>
          <RankChart
            points={rows.filter((r) => r.netSales !== 0).map((r) => ({ label: r.name, value: r.netSales }))}
            tone="emerald"
            valueLabel="Net sales"
          />
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 max-w-full">
            <DateRange
              from={range.from}
              to={range.to}
              presets={RANGES}
              onChange={setRange}
            />
          </div>
          <label className="block w-full sm:w-64">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Account
            </span>
            <Input
              placeholder="Company, GSTIN or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Show
            </span>
            <Select
              value={show}
              onChange={(e) => setShow(e.target.value as Show)}
              className="w-56"
            >
              <option value="all">All business accounts</option>
              <option value="due">Only accounts that owe money</option>
            </Select>
          </label>
          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setShow('all');
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
              {rows.map((r, i) => (
                <RecordCard
                  key={r.id}
                  href={`/admin/customers/${r.id}`}
                  title={r.name}
                  mono={false}
                  amount={money(r.netSales)}
                  date={r.lastInvoiceDate ? `Last invoice ${shortDate(r.lastInvoiceDate)}` : 'No invoice in this period'}
                  note={r.overdue > 0 ? `${money(r.overdue)} overdue` : undefined}
                  primary={`${r.invoiceCount} invoice(s) · ${money(r.invoiced)} with GST`}
                  secondary={[r.gstin, r.topProduct ? `Top: ${r.topProduct.name}` : null].filter(Boolean).join(' · ') || undefined}
                  footer={`Received ${money(r.received)} · Due ${money(r.due)}`}
                  select={
                    <SelectBox
                      checked={sel.isSelected(sel.idOf(r, i))}
                      onToggle={() => sel.toggle(sel.idOf(r, i))}
                    />
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
              <Table minWidth="1500px">
                <thead>
                  <tr>
                    <Th className="w-8">
                      <SelectAllBox
                        allSelected={sel.allSelected}
                        someSelected={sel.someSelected}
                        onToggle={sel.toggleAll}
                      />
                    </Th>
                    <Th>ACCOUNT</Th>
                    <Th className="text-right">INVOICES</Th>
                    <Th className="text-right">SALES</Th>
                    <Th className="text-right">GST</Th>
                    <Th className="text-right">INVOICE TOTAL</Th>
                    <Th className="text-right">CREDIT NOTES</Th>
                    <Th className="text-right">NET SALES</Th>
                    <Th className="text-right">RECEIVED</Th>
                    <Th className="text-right">DUE NOW</Th>
                    <Th className="text-right">OVERDUE</Th>
                    <Th>LAST INVOICE</Th>
                    <Th>TOP PRODUCT</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <EmptyRow colSpan={13} message={emptyMessage} />}
                  {rows.map((r, i) => (
                    <tr key={r.id} className="hover:bg-muted/60">
                      <Td>
                        <SelectBox
                          checked={sel.isSelected(sel.idOf(r, i))}
                          onToggle={() => sel.toggle(sel.idOf(r, i))}
                        />
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/customers/${r.id}`}
                          className="font-medium text-gold-ink hover:underline"
                        >
                          {r.name}
                        </Link>
                        {r.contactName && (
                          <span className="block text-[11px] text-muted-foreground">{r.contactName}</span>
                        )}
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {r.gstin ?? 'No GSTIN'}
                        </span>
                      </Td>
                      <Td className="text-right text-muted-foreground">{r.invoiceCount || dash}</Td>
                      <Td className="text-right">{amountOrDash(r.taxable)}</Td>
                      <Td className="text-right text-muted-foreground">{amountOrDash(r.tax)}</Td>
                      <Td className="text-right">{amountOrDash(r.invoiced)}</Td>
                      <Td className="text-right">
                        {r.credited ? (
                          <span className="text-warning">−{money(r.credited)}</span>
                        ) : (
                          dash
                        )}
                      </Td>
                      <Td className="text-right font-semibold">{money(r.netSales)}</Td>
                      <Td className="text-right">{amountOrDash(r.received)}</Td>
                      <Td className="text-right">{amountOrDash(r.due, 'font-medium')}</Td>
                      <Td className="text-right">{amountOrDash(r.overdue, 'font-medium text-destructive')}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {r.lastInvoiceDate ? shortDate(r.lastInvoiceDate) : dash}
                      </Td>
                      <Td className="max-w-56">
                        {r.topProduct ? (
                          <>
                            <span className="block truncate" title={r.topProduct.name}>{r.topProduct.name}</span>
                            <span className="block text-[11px] text-muted-foreground">{money(r.topProduct.value)}</span>
                          </>
                        ) : (
                          dash
                        )}
                      </Td>
                    </tr>
                  ))}
                  {t && rows.length > 0 && (
                    <tr className="border-t-2 border-border font-semibold">
                      <Td />
                      <Td>Total</Td>
                      <Td className="text-right">{t.invoiceCount}</Td>
                      <Td className="text-right">{money(t.taxable)}</Td>
                      <Td className="text-right">{money(t.tax)}</Td>
                      <Td className="text-right">{money(t.invoiced)}</Td>
                      <Td className="text-right">{t.credited ? `−${money(t.credited)}` : '—'}</Td>
                      <Td className="text-right">{money(t.netSales)}</Td>
                      <Td className="text-right">{money(t.received)}</Td>
                      <Td className="text-right">{money(t.due)}</Td>
                      <Td className="text-right">{money(t.overdue)}</Td>
                      <Td />
                      <Td />
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Sales and credit notes are shown before GST, and net sales is sales minus credit notes.
        Received counts payments dated in this period. Due now and overdue are what is still unpaid
        today on bills raised up to the end of this period.
      </p>
    </>
  );
}
