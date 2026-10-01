'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage, numberLocale } from '@/lib/api';
import { ExportMenu } from '@/components/ExportMenu';
import { DonutChart, GroupedBarChart } from '@/components/ReportChart';
import type { Column } from '@/lib/export';
import { stateName } from '@/lib/states';
import {
  Button, ErrorBox, Loading, PageHeader,
  StatCard, Table, Td, Th,
} from '@/components/ui';
import { ACCOUNTING_RANGES, DateRange } from '@/components/DateRange';

type Row = {
  id?: string;
  number?: string;
  date?: string;
  gstin?: string | null;
  party?: string;
  against?: string | null;
  reason?: string | null;
  placeOfSupply?: string | null;
  rates?: number[];
  rate?: number;
  type?: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total?: number;
  invoiceCount?: number;
  hsnCode?: string;
  description?: string;
  unit?: string;
  quantity?: number;
};

type Gst = {
  b2b: Row[];
  b2cl: Row[];
  b2cs: Row[];
  cdnr: Row[];
  cdnur: Row[];
  hsn: Row[];
  docs: { label: string; from: string; to: string; total: number }[];
};

type Meta = {
  period: { from: string; to: string };
  organisation: { gstin: string | null; name: string | null; stateCode: string | null };
  b2clThreshold: number;
  counts: Record<string, number>;
  totals: {
    outputCgst: number; outputSgst: number; outputIgst: number; outputTotal: number;
    inputCgst: number; inputSgst: number; inputIgst: number; inputTotal: number;
    netPayable: number; taxableValue: number; reverseChargeBills: number;
  };
};

const TABS = [
  { key: 'b2b', label: 'B2B', table: '4A', note: 'Sales to registered buyers — invoice by invoice' },
  { key: 'b2cl', label: 'B2C Large', table: '5A', note: 'Inter-state, unregistered, above the threshold' },
  { key: 'b2cs', label: 'B2C Small', table: '7', note: 'Everything else, summarised by place of supply and rate' },
  { key: 'cdnr', label: 'Credit Notes (Reg.)', table: '9B', note: 'Credit notes to registered buyers' },
  { key: 'cdnur', label: 'Credit Notes (Unreg.)', table: '9B', note: 'Credit notes to unregistered buyers' },
  { key: 'hsn', label: 'HSN Summary', table: '12', note: 'Quantity and tax per HSN code' },
  { key: 'docs', label: 'Documents', table: '13', note: 'Serials issued this period' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
};
const monthEnd = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

const place = (code?: string | null) =>
  code ? `${stateName(code)} (${code})` : '—';

export default function GstReportPage() {
  const [gst, setGst] = useState<Gst | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [tab, setTab] = useState<TabKey>('b2b');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Gst; meta: Meta }>('/reports/gst', { from, to });
      setGst(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function exportSpec() {
    const list = (gst?.[tab] ?? []) as Row[];
    const active = TABS.find((x) => x.key === tab)!;
    const subtitle = `Table ${active.table} · ${shortDate(from)} to ${shortDate(to)}`;
    const footnote =
      'Every figure is read back from the document that froze it. Nothing is recalculated, so ' +
      'this can never disagree with the invoice the customer holds.';

    const moneyCols: Column<Row>[] = [
      { header: 'Taxable', value: (r) => r.taxable, money: true },
      { header: 'CGST', value: (r) => r.cgst, money: true },
      { header: 'SGST', value: (r) => r.sgst, money: true },
      { header: 'IGST', value: (r) => r.igst, money: true },
    ];

    let columns: Column<Row>[];
    if (tab === 'docs') {
      const docs = (gst?.docs ?? []) as unknown as Row[];
      return {
        title: 'GSTR-1 Documents Issued',
        subtitle,
        columns: [
          { header: 'Document', value: (d: Row) => (d as unknown as { label: string }).label },
          { header: 'From', value: (d: Row) => (d as unknown as { from: string }).from },
          { header: 'To', value: (d: Row) => (d as unknown as { to: string }).to },
          { header: 'Total issued', value: (d: Row) => (d as unknown as { total: number }).total, align: 'right' as const },
        ],
        rows: docs,
        footnote,
        orientation: 'portrait' as const,
      };
    }

    if (tab === 'hsn') {
      columns = [
        { header: 'HSN', value: (r) => r.hsnCode ?? '' },
        { header: 'Description', value: (r) => r.description ?? '', width: 160 },
        { header: 'UQC', value: (r) => r.unit ?? '' },
        { header: 'Rate', value: (r) => r.rate ?? 0, align: 'right' },
        { header: 'Quantity', value: (r) => r.quantity ?? 0, align: 'right' },
        ...moneyCols,
      ];
    } else if (tab === 'b2cs') {
      columns = [
        { header: 'Place of supply', value: (r) => place(r.placeOfSupply) },
        { header: 'Type', value: (r) => (r.type === 'INTER' ? 'Inter-state' : 'Intra-state') },
        { header: 'Rate', value: (r) => r.rate ?? 0, align: 'right' },
        ...moneyCols,
      ];
    } else {
      const isCredit = tab.startsWith('cdn');
      columns = [
        ...(tab === 'b2b' || tab === 'cdnr'
          ? [{ header: 'GSTIN', value: (r: Row) => r.gstin ?? '' }]
          : []),
        { header: 'Party', value: (r) => r.party ?? '', width: 150 },
        { header: isCredit ? 'Credit note' : 'Invoice', value: (r) => r.number ?? '' },
        { header: 'Date', value: (r) => (r.date ?? '').slice(0, 10) },
        isCredit
          ? { header: 'Against', value: (r: Row) => r.against ?? '' }
          : { header: 'Place of supply', value: (r: Row) => place(r.placeOfSupply) },
        ...moneyCols,
        { header: 'Total', value: (r) => r.total ?? 0, money: true },
      ];
    }

    const sum = (f: 'taxable' | 'cgst' | 'sgst' | 'igst') =>
      list.reduce((n, r) => n + Number(r[f] ?? 0), 0);
    const lead = columns.length - 4 - (tab === 'b2b' || tab === 'cdnr' || tab === 'b2cl' || tab === 'cdnur' ? 1 : 0);

    return {
      title: `GSTR-1 ${active.label} (Table ${active.table})`,
      subtitle,
      columns,
      rows: list,
      totals: [
        'Total',
        ...Array(Math.max(0, lead - 1)).fill(''),
        sum('taxable'), sum('cgst'), sum('sgst'), sum('igst'),
        ...(columns.some((c) => c.header === 'Total') ? [''] : []),
      ],
      footnote,
      orientation: 'landscape' as const,
    };
  }

  const t = meta?.totals;
  const rows = (gst?.[tab] ?? []) as Row[];
  const active = TABS.find((x) => x.key === tab)!;

  const money0 = (n: number) => money(n);
  const totalOf = (field: 'taxable' | 'cgst' | 'sgst' | 'igst') =>
    rows.reduce((n, r) => n + Number(r[field] ?? 0), 0);

  return (
    <>

      <PageHeader
        title="GST Return"
        subtitle="Your outward supplies sorted into the tables GSTR-1 asks for, and the tax set against what suppliers charged you"
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
            label="Output Tax"
            value={money0(t.outputTotal)}
            sub="charged on sales, net of credit notes"
          />
          <StatCard
            label="Input Tax Credit"
            value={money0(t.inputTotal)}
            sub="charged to you on bills"
            tone="green"
          />
          <StatCard
            label={t.netPayable >= 0 ? 'Net Payable' : 'Credit Carried Forward'}
            value={money0(Math.abs(t.netPayable))}
            sub={t.netPayable >= 0 ? 'output minus input' : 'input exceeded output'}
            tone={t.netPayable > 0 ? 'amber' : 'green'}
          />
          <StatCard
            label="Taxable Value"
            value={money0(t.taxableValue)}
            sub={`${meta.counts.invoices} invoice(s) · ${meta.counts.creditNotes} credit note(s)`}
          />
        </div>
      )}

      {t && gst && !loading && (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Tax collected vs tax paid</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {t.netPayable >= 0
                ? `${money0(t.netPayable)} to pay after input credit`
                : `${money0(Math.abs(t.netPayable))} credit carried forward`}
            </p>
            <GroupedBarChart
              categoryKey="tax"
              series={[
                { key: 'output', label: 'Collected on sales', tone: 'teal' },
                { key: 'input', label: 'Paid on bills', tone: 'amber' },
              ]}
              data={[
                { tax: 'CGST', output: t.outputCgst, input: t.inputCgst },
                { tax: 'SGST', output: t.outputSgst, input: t.inputSgst },
                { tax: 'IGST', output: t.outputIgst, input: t.inputIgst },
              ]}
            />
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Sales by GST rate</h3>
            <p className="mb-3 text-xs text-muted-foreground">Taxable value from the HSN summary</p>
            <DonutChart
              centerLabel="taxable"
              slices={[
                ...gst.hsn
                  .reduce((m, r) => m.set(Number(r.rate ?? 0), (m.get(Number(r.rate ?? 0)) ?? 0) + Number(r.taxable ?? 0)), new Map<number, number>())
                  .entries(),
              ]
                .sort((a, b) => a[0] - b[0])
                .map(([rate, taxable]) => ({ label: `GST ${rate}%`, value: taxable }))}
            />
          </div>
        </div>
      )}

      {meta && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-end gap-3">
            <DateRange
              presets={ACCOUNTING_RANGES}
              from={from}
              to={to}
              onChange={(r) => {
                setFrom(r.from);
                setTo(r.to);
              }}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setFrom(monthStart());
                setTo(monthEnd());
              }}
            >
              This month
            </Button>
            <div className="ml-auto text-right text-xs text-muted-foreground">
              <div>
                Filing as <strong className="font-mono">{meta.organisation.gstin ?? 'no GSTIN set'}</strong>
              </div>
              <div className="text-muted-foreground">
                {meta.organisation.name ?? ''}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex gap-4 overflow-x-auto border-b border-border px-4">
          {TABS.map((x) => {
            const n = meta?.counts[x.key] ?? 0;
            return (
              <button
                key={x.key}
                type="button"
                aria-pressed={tab === x.key}
                onClick={() => setTab(x.key)}
                className={`shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                  tab === x.key
                    ? 'border-gold font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {x.label}
                {n > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>
                )}
              </button>
            );
          })}
        </div>

        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="mr-2 font-mono text-muted-foreground">
            Table {active.table}
          </span>
          {active.note}
          {tab === 'b2cl' && meta && (
            <span className="ml-1">
              — currently {money(meta.b2clThreshold)}.{' '}
              <strong>This threshold has changed before; confirm it with your accountant.</strong>
            </span>
          )}
        </p>

        {loading ? (
          <Loading />
        ) : tab === 'docs' ? (
          <Table>
            <thead>
              <tr>
                <Th>DOCUMENT</Th><Th>FROM</Th><Th>TO</Th><Th className="text-right">TOTAL ISSUED</Th>
              </tr>
            </thead>
            <tbody>
              {(gst?.docs ?? []).map((d) => (
                <tr key={d.label}>
                  <Td className="font-medium">{d.label}</Td>
                  <Td className="font-mono text-xs">{d.from}</Td>
                  <Td className="font-mono text-xs">{d.to}</Td>
                  <Td className="text-right">{d.total}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nothing in this table for {shortDate(from)} – {shortDate(to)}
          </div>
        ) : tab === 'hsn' ? (
          <Table minWidth="900px">
            <thead>
              <tr>
                <Th>HSN</Th><Th>DESCRIPTION</Th><Th>UQC</Th>
                <Th className="text-right">RATE</Th><Th className="text-right">QUANTITY</Th>
                <Th className="text-right">TAXABLE</Th><Th className="text-right">CGST</Th>
                <Th className="text-right">SGST</Th><Th className="text-right">IGST</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/60">
                  <Td className="font-mono">
                    {r.hsnCode === 'NOT SET' ? (
                      <span className="text-destructive">NOT SET</span>
                    ) : (
                      r.hsnCode
                    )}
                  </Td>
                  <Td className="text-xs">{r.description}</Td>
                  <Td className="text-xs">{r.unit}</Td>
                  <Td className="text-right">{r.rate}%</Td>
                  <Td className="text-right">{Number(r.quantity).toLocaleString(numberLocale())}</Td>
                  <Td className="text-right">{money(r.taxable)}</Td>
                  <Td className="text-right">{money(r.cgst)}</Td>
                  <Td className="text-right">{money(r.sgst)}</Td>
                  <Td className="text-right">{money(r.igst)}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <Td>Total</Td><Td /><Td /><Td /><Td />
                <Td className="text-right">{money(totalOf('taxable'))}</Td>
                <Td className="text-right">{money(totalOf('cgst'))}</Td>
                <Td className="text-right">{money(totalOf('sgst'))}</Td>
                <Td className="text-right">{money(totalOf('igst'))}</Td>
              </tr>
            </tbody>
          </Table>
        ) : tab === 'b2cs' ? (
          <Table minWidth="720px">
            <thead>
              <tr>
                <Th>PLACE OF SUPPLY</Th><Th>TYPE</Th><Th className="text-right">RATE</Th>
                <Th className="text-right">TAXABLE</Th><Th className="text-right">CGST</Th>
                <Th className="text-right">SGST</Th><Th className="text-right">IGST</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/60">
                  <Td>{place(r.placeOfSupply)}</Td>
                  <Td className="text-xs">{r.type === 'INTER' ? 'Inter-state' : 'Intra-state'}</Td>
                  <Td className="text-right">{r.rate}%</Td>
                  <Td className="text-right">{money(r.taxable)}</Td>
                  <Td className="text-right">{money(r.cgst)}</Td>
                  <Td className="text-right">{money(r.sgst)}</Td>
                  <Td className="text-right">{money(r.igst)}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <Td>Total</Td><Td /><Td />
                <Td className="text-right">{money(totalOf('taxable'))}</Td>
                <Td className="text-right">{money(totalOf('cgst'))}</Td>
                <Td className="text-right">{money(totalOf('sgst'))}</Td>
                <Td className="text-right">{money(totalOf('igst'))}</Td>
              </tr>
            </tbody>
          </Table>
        ) : (
          <Table minWidth="1020px">
            <thead>
              <tr>
                {(tab === 'b2b' || tab === 'cdnr') && <Th>GSTIN</Th>}
                <Th>PARTY</Th>
                <Th>{tab.startsWith('cdn') ? 'CREDIT NOTE' : 'INVOICE'}</Th>
                <Th>DATE</Th>
                {tab.startsWith('cdn') ? <Th>AGAINST</Th> : <Th>PLACE OF SUPPLY</Th>}
                <Th className="text-right">TAXABLE</Th>
                <Th className="text-right">CGST</Th>
                <Th className="text-right">SGST</Th>
                <Th className="text-right">IGST</Th>
                <Th className="text-right">TOTAL</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  {(tab === 'b2b' || tab === 'cdnr') && (
                    <Td className="whitespace-nowrap font-mono text-xs">{r.gstin ?? '—'}</Td>
                  )}
                  <Td>{r.party}</Td>
                  <Td>
                    <Link
                      href={`${tab.startsWith('cdn') ? '/credit-notes' : '/invoices'}/${r.id}`}
                      className="whitespace-nowrap font-medium text-gold-ink hover:underline"
                    >
                      {r.number}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {shortDate(r.date!)}
                  </Td>
                  {tab.startsWith('cdn') ? (
                    <Td className="text-xs">{r.against ?? '—'}</Td>
                  ) : (
                    <Td className="text-xs">{place(r.placeOfSupply)}</Td>
                  )}
                  <Td className="text-right">{money(r.taxable)}</Td>
                  <Td className="text-right">{money(r.cgst)}</Td>
                  <Td className="text-right">{money(r.sgst)}</Td>
                  <Td className="text-right">{money(r.igst)}</Td>
                  <Td className="text-right font-medium">{money(r.total ?? 0)}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <Td>Total</Td>
                {(tab === 'b2b' || tab === 'cdnr') && <Td />}
                <Td /><Td /><Td />
                <Td className="text-right">{money(totalOf('taxable'))}</Td>
                <Td className="text-right">{money(totalOf('cgst'))}</Td>
                <Td className="text-right">{money(totalOf('sgst'))}</Td>
                <Td className="text-right">{money(totalOf('igst'))}</Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        )}
      </div>

      {t && t.reverseChargeBills > 0 && (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t.reverseChargeBills} bill(s) in this period are marked reverse charge. Their tax is
          <strong> not</strong> counted as input credit above — you pay it yourself, and it is
          reported separately.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Every figure here is read back from the document that froze it. Nothing is recalculated,
        so this can never disagree with the invoice the customer holds.
      </p>
    </>
  );
}
