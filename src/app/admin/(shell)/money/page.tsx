'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, errorMessage } from '@/lib/api';
import {
  Badge, EmptyRow, ErrorBox, Input, Loading, PageHeader, StatCard, Table, Td, Th,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { PageCrumb } from '@/lib/crumbs';

type Row = {
  id: string;
  name: string;
  customerType?: string;
  invoices?: number;
  bills?: number;
  billed: string;
  paid: string;
  credits: string;
  outstanding: string;
};

type Totals = { billed: string; paid: string; credits: string; outstanding: string };

type Side = 'customers' | 'vendors';

export default function MoneyPage() {
  const { can } = useAuth();
  const maySeeCustomers = can('reports:receivables');
  const maySeeVendors = can('reports:payables');

  const [side, setSide] = useState<Side>(maySeeCustomers ? 'customers' : 'vendors');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: { rows: Row[]; totals: Totals } }>(
        `/reports/money/${side}`,
        { search: search.trim() || undefined }
      );
      setRows(res.data.rows);
      setTotals(res.data.totals);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [side, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  if (!maySeeCustomers && !maySeeVendors) {
    return (
      <>
        <PageHeader title="Paid & outstanding" />
        <ErrorBox message="Your role does not include receivables or payables." />
      </>
    );
  }

  const isCustomers = side === 'customers';
  const tabs: { key: Side; label: string; allowed: boolean }[] = [
    { key: 'customers', label: 'Customers owe you', allowed: maySeeCustomers },
    { key: 'vendors', label: 'You owe vendors', allowed: maySeeVendors },
  ];

  return (
    <>
      <PageCrumb label="Paid & outstanding" />
      <PageHeader
        title="Paid & outstanding"
        subtitle="What has been billed, what has been paid and what is still due"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Billed" value={money(totals?.billed ?? 0)} />
        <StatCard label="Total paid" value={money(totals?.paid ?? 0)} tone="green" />
        <StatCard label="Total outstanding" value={money(totals?.outstanding ?? 0)} tone="amber" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-3">
          {tabs
            .filter((t) => t.allowed)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSide(t.key)}
                className={`relative -mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${
                  side === t.key
                    ? 'border-border font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          <Input
            placeholder={isCustomers ? 'Search a customer…' : 'Search a vendor…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="my-2 ml-auto max-w-xs"
          />
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBox message={error} onRetry={load} />
          </div>
        ) : loading && rows.length === 0 ? (
          <Loading />
        ) : (
          <Table minWidth="720px">
            <thead>
              <tr>
                <Th>{isCustomers ? 'Customer' : 'Vendor'}</Th>
                <Th className="text-right">{isCustomers ? 'Invoices' : 'Bills'}</Th>
                <Th className="text-right">Billed</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">{isCustomers ? 'Credit notes' : 'Vendor credits'}</Th>
                <Th className="text-right">Outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={6} message={isCustomers ? 'No invoices yet' : 'No bills yet'} />
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/60">
                  <Td>
                    <Link
                      href={isCustomers ? `/customers/${r.id}` : `/vendors/${r.id}`}
                      className="font-medium text-gold-ink hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.customerType === 'B2B' && <Badge tone="purple" className="ml-2">B2B</Badge>}
                  </Td>
                  <Td className="text-right tabular-nums text-muted-foreground">
                    {r.invoices ?? r.bills ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">{money(r.billed)}</Td>
                  <Td className="text-right tabular-nums text-success">{money(r.paid)}</Td>
                  <Td className="text-right tabular-nums text-muted-foreground">
                    {Number(r.credits) > 0 ? money(r.credits) : '—'}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {Number(r.outstanding) > 0 ? money(r.outstanding) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
