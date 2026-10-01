'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, shortDate, errorMessage } from '@/lib/api';
import { stateLabel } from '@/lib/states';
import {
  Badge, Button, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { CardList, RecordCard, CardAction } from '@/components/CardList';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import { DateRange, type Range } from '@/components/DateRange';

type EwayBill = {
  id: string;
  ewayBillNumber: string | null;
  status: 'NOT_GENERATED' | 'GENERATED' | 'CANCELLED' | 'EXPIRED';
  generatedAt: string | null;
  validUntil: string | null;
  documentType: 'INVOICE' | 'CREDIT_NOTE' | 'DELIVERY_CHALLAN';
  vehicleNumber: string | null;
  transporter: string | null;
  invoice: {
    id: string; invoiceNumber: string; invoiceDate: string; grandTotal: string;
    gstin: string | null; customer: { id: string; displayName: string | null } | null;
  } | null;
  creditNote: { id: string; creditNumber: string; grandTotal: string } | null;
  challan: { id: string; challanNumber: string } | null;
  customer: { id: string; displayName: string | null } | null;
};

type Pending = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: string;
  gstin: string | null;
  placeOfSupplyCode: string | null;
  sourceOfSupplyCode: string | null;
  selfTransported: boolean;
  customer: { id: string; displayName: string | null } | null;
  order: { orderNumber: string; shipmentType: string | null; transporter: string | null } | null;
};

const STATUS_TONE: Record<string, 'gray' | 'green' | 'red' | 'amber'> = {
  NOT_GENERATED: 'gray',
  GENERATED: 'green',
  CANCELLED: 'red',
  EXPIRED: 'amber',
};

const STATUS_LABEL: Record<string, string> = {
  NOT_GENERATED: 'Not generated',
  GENERATED: 'Generated',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

const docLabel = (b: EwayBill) =>
  b.invoice?.invoiceNumber ?? b.creditNote?.creditNumber ?? b.challan?.challanNumber ?? '—';

const docHref = (b: EwayBill) =>
  b.invoice
    ? `/invoices/${b.invoice.id}`
    : b.creditNote
      ? `/credit-notes/${b.creditNote.id}`
      : b.challan
        ? `/delivery-challans/${b.challan.id}`
        : '#';

export default function EwayBillsPage() {
  const [tab, setTab] = useState<'pending' | 'recorded'>('pending');

  const [bills, setBills] = useState<EwayBill[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pendingMeta, setPendingMeta] = useState<{
    threshold: number; total: number; ours: number; viaShiprocket: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<Range>({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [b, p] = await Promise.all([
        api.get<{ data: EwayBill[]; meta: { counts: Record<string, number> } }>('/eway-bills', {
          status: status || undefined,
          documentType: documentType || undefined,
          search: search || undefined,
          from: range.from || undefined,
          to: range.to || undefined,
          limit: 100,
        }),
        api.get<{ data: Pending[]; meta: typeof pendingMeta }>('/eway-bills/pending'),
      ]);
      setBills(b.data);
      setCounts(b.meta?.counts ?? {});
      setPending(p.data);
      setPendingMeta(p.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, documentType, search, range]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function exportSpec() {
    const columns: Column<EwayBill>[] = [
      { header: 'e-Way bill', value: (r) => r.ewayBillNumber ?? 'Not issued', width: 110 },
      { header: 'Status', value: (r) => STATUS_LABEL[r.status] ?? r.status },
      { header: 'Document type', value: (r) => r.documentType },
      { header: 'Document', value: (r) => docLabel(r) },
      {
        header: 'Customer',
        value: (r) => r.customer?.displayName ?? r.invoice?.customer?.displayName ?? '',
        width: 150,
      },
      { header: 'Customer GSTIN', value: (r) => r.invoice?.gstin ?? '' },
      { header: 'Value', value: (r) => Number(r.invoice?.grandTotal ?? r.creditNote?.grandTotal ?? 0), money: true },
      { header: 'Transporter', value: (r) => r.transporter ?? '' },
      { header: 'Vehicle', value: (r) => r.vehicleNumber ?? '' },
      { header: 'Generated', value: (r) => (r.generatedAt ? shortDate(r.generatedAt) : '') },
      { header: 'Valid until', value: (r) => (r.validUntil ? shortDate(r.validUntil) : '') },
    ];
    return {
      title: 'e-Way bills',
      subtitle: `${bills.length} record(s)`,
      columns,
      rows: bills,
      footnote:
        'Only the NIC portal issues a valid number; this is the register of what was raised. ' +
        'A consignment over the threshold with no number here has not been covered.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="e-Way Bills"
        subtitle="Goods worth more than ₹50,000 cannot move without one"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu spec={exportSpec} disabled={tab !== 'recorded' || !bills.length} />
            <Link href="/admin/eway-bills/new">
              <Button variant="primary">+ New</Button>
            </Link>
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {pendingMeta && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Yours to raise"
            value={String(pendingMeta.ours)}
            sub="on your own transport"
            tone={pendingMeta.ours > 0 ? 'red' : 'green'}
          />
          <StatCard
            label="Shiprocket raises"
            value={String(pendingMeta.viaShiprocket)}
            sub="nothing for you to do"
          />
          <StatCard
            label="Recorded"
            value={String(counts.GENERATED ?? 0)}
            sub="live on the portal"
          />
          <StatCard
            label="Threshold"
            value={money(pendingMeta.threshold)}
            sub="per consignment"
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-5 border-b border-border px-4">
          {([
            ['pending', 'Awaiting a bill', pending.length],
            ['recorded', 'Recorded', counts.ALL ?? 0],
          ] as const).map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                tab === key
                  ? 'border-border font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {n > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'recorded' && (
          <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
            <Input
              placeholder="Search bill, vehicle or invoice number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <DateRange allowAll hideLabel label="Date" from={range.from} to={range.to} onChange={setRange} />
            <Select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-44">
              <option value="">All documents</option>
              <option value="INVOICE">Invoices</option>
              <option value="CREDIT_NOTE">Credit notes</option>
              <option value="DELIVERY_CHALLAN">Delivery challans</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        )}

        {loading ? (
          <Loading />
        ) : tab === 'pending' ? (
          <>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              Invoices above {money(pendingMeta?.threshold ?? 50000)} with no e-way bill recorded.
              Shiprocket consignments are listed but greyed — Shiprocket raises those itself.
            </p>
            <CardList empty="Nothing is waiting on an e-way bill — every consignment over the threshold has one">
              {pending.map((p) => (
                <RecordCard
                  key={p.id}
                  href={`/admin/invoices/${p.id}`}
                  title={p.invoiceNumber}
                  amount={money(p.grandTotal)}
                  date={shortDate(p.invoiceDate)}
                  primary={p.customer?.displayName ?? '—'}
                  secondary={
                    p.sourceOfSupplyCode && p.placeOfSupplyCode
                      ? `${stateLabel(p.sourceOfSupplyCode)} → ${stateLabel(
                          p.placeOfSupplyCode
                        )}`
                      : undefined
                  }
                  footer={p.gstin ?? (p.selfTransported ? undefined : 'Shiprocket raises this')}
                  actions={
                    p.selfTransported ? (
                      <CardAction href={`/admin/invoices/${p.id}`} variant="primary">
                        Record
                      </CardAction>
                    ) : (
                      <span />
                    )
                  }
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="920px">
              <thead>
                <tr>
                  <Th>INVOICE</Th>
                  <Th>DATE</Th>
                  <Th>CUSTOMER</Th>
                  <Th>CUSTOMER GSTIN</Th>
                  <Th>ROUTE</Th>
                  <Th className="text-right">TOTAL</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 && (
                  <EmptyRow
                    colSpan={7}
                    message="Nothing is waiting on an e-way bill — every consignment over the threshold has one"
                  />
                )}
                {pending.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-muted/60  ${
                      p.selfTransported ? '' : 'opacity-55'
                    }`}
                  >
                    <Td>
                      <Link
                        href={`/admin/invoices/${p.id}`}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {p.invoiceNumber}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {shortDate(p.invoiceDate)}
                    </Td>
                    <Td>{p.customer?.displayName ?? '—'}</Td>
                    <Td className="font-mono text-xs">{p.gstin ?? '—'}</Td>
                    <Td className="text-xs">
                      {p.sourceOfSupplyCode && p.placeOfSupplyCode ? (
                        <>
                          {stateLabel(p.sourceOfSupplyCode)} → {stateLabel(p.placeOfSupplyCode)}
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="text-right font-medium">{money(p.grandTotal)}</Td>
                    <Td className="text-right">
                      {p.selfTransported ? (
                        <Link href={`/admin/invoices/${p.id}`}>
                          <Button size="sm" variant="primary">Record</Button>
                        </Link>
                      ) : (
                        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                          Shiprocket raises this
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </div>
          </>
        ) : (
          <>
          <CardList empty="No e-way bills recorded yet">
            {bills.map((b) => {
              const expired =
                b.status === 'GENERATED' && b.validUntil && new Date(b.validUntil) < new Date();
              return (
                <RecordCard
                  key={b.id}
                  href={`/admin/eway-bills/${b.id}`}
                  title={b.ewayBillNumber ?? 'Not issued'}
                  amount={money(b.invoice?.grandTotal ?? b.creditNote?.grandTotal ?? 0)}
                  date={b.generatedAt ? shortDate(b.generatedAt) : undefined}
                  primary={b.customer?.displayName ?? b.invoice?.customer?.displayName ?? '—'}
                  secondary={docLabel(b)}
                  alert={
                    expired && b.validUntil ? `Expired ${shortDate(b.validUntil)}` : undefined
                  }
                  footer={[
                    b.vehicleNumber,
                    !expired && b.validUntil ? `valid to ${shortDate(b.validUntil)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  badges={<Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>}
                />
              );
            })}
          </CardList>

          <div className="hidden md:block">
          <Table minWidth="1000px">
            <thead>
              <tr>
                <Th>E-WAY BILL#</Th>
                <Th>DOCUMENT</Th>
                <Th>CUSTOMER</Th>
                <Th>VEHICLE</Th>
                <Th>GENERATED</Th>
                <Th>VALID UNTIL</Th>
                <Th>STATUS</Th>
                <Th className="text-right">VALUE</Th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 && (
                <EmptyRow colSpan={8} message="No e-way bills recorded yet" />
              )}
              {bills.map((b) => {
                const expired =
                  b.status === 'GENERATED' &&
                  b.validUntil &&
                  new Date(b.validUntil) < new Date();
                return (
                  <tr key={b.id} className="hover:bg-muted/60">
                    <Td className="font-mono text-xs">
                      <Link
                        href={`/admin/eway-bills/${b.id}`}
                        className="text-gold-ink hover:underline"
                      >
                        {b.ewayBillNumber ?? (
                          <span className="text-muted-foreground">not issued</span>
                        )}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={docHref(b)}
                        className="font-medium text-gold-ink hover:underline"
                      >
                        {docLabel(b)}
                      </Link>
                    </Td>
                    <Td>{b.customer?.displayName ?? b.invoice?.customer?.displayName ?? '—'}</Td>
                    <Td className="font-mono text-xs">{b.vehicleNumber ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {b.generatedAt ? shortDate(b.generatedAt) : '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {b.validUntil ? (
                        <span
                          className={
                            expired
                              ? 'font-medium text-destructive'
                              : 'text-muted-foreground'
                          }
                        >
                          {shortDate(b.validUntil)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                    </Td>
                    <Td className="text-right">
                      {money(b.invoice?.grandTotal ?? b.creditNote?.grandTotal ?? 0)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          </div>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Recorded here, generated on{' '}
        <a
          href="https://ewaybillgst.gov.in"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          ewaybillgst.gov.in
        </a>
        . Only the government portal issues a valid number, so this keeps the number beside the
        document it covers rather than filing anything itself.
      </p>
    </>
  );
}
