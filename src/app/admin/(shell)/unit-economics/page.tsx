'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, money, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  StatCard, Table, Td, Th,
} from '@/components/ui';
import { AssumptionsCard } from '@/components/costs/AssumptionsCard';
import { MarginBreakdown } from '@/components/costs/MarginBreakdown';
import type { Assumptions, MarginRow } from '@/components/costs/types';

type Payload = {
  assumptions: Assumptions;
  rows: MarginRow[];
  totals: {
    count: number;
    missingCost: number;
    losingMoney: number;
    averageNetMargin: number | null;
  };
};

const marginTone = (margin: number | null) => {
  if (margin == null) return 'text-muted-foreground';
  if (margin < 0) return 'text-destructive';
  if (margin < 20) return 'text-warning';
  return 'text-success';
};

export default function UnitEconomicsPage() {
  const { can } = useAuth();
  const canWrite = can('costs:write');

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<MarginRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Payload }>('/costs/unit-economics', {
        ...(search && { search }),
      });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const totals = data?.totals;

  return (
    <>
      <PageHeader
        title="Unit economics"
        subtitle="What every size actually earns once GST, cost and running costs come off"
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sizes priced" value={String(totals?.count ?? 0)} sub="active and on sale" />
        <StatCard
          label="Average net margin"
          value={totals?.averageNetMargin == null ? '—' : `${totals.averageNetMargin}%`}
          sub="where a cost is known"
          tone="green"
        />
        <StatCard
          label="Losing money"
          value={String(totals?.losingMoney ?? 0)}
          sub="priced below what they cost"
          tone={totals?.losingMoney ? 'red' : undefined}
        />
        <StatCard
          label="No cost recorded"
          value={String(totals?.missingCost ?? 0)}
          sub="margin cannot be trusted"
          tone={totals?.missingCost ? 'blue' : undefined}
        />
      </div>

      {data && (
        <div className="mb-5">
          <AssumptionsCard assumptions={data.assumptions} canWrite={canWrite} onSaved={load} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <Input
            placeholder="Search a product, size or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground">Worst margin first</span>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">GST</Th>
                <Th className="text-right">We keep</Th>
                <Th className="text-right">Cost</Th>
                <Th className="text-right">Running costs</Th>
                <Th className="text-right">Profit</Th>
                <Th className="text-right">Margin</Th>
              </tr>
            </thead>
            <tbody>
              {!data?.rows.length && <EmptyRow colSpan={8} message="Nothing priced to compare yet" />}
              {data?.rows.map((row) => (
                <tr
                  key={row.variantId}
                  onClick={() => setOpen(row)}
                  className="cursor-pointer hover:bg-muted/40"
                >
                  <Td>
                    <div className="font-medium text-foreground">{row.product}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.variant}
                      {row.sku ? ` · ${row.sku}` : ''}
                      {row.opexOverridden ? ' · own running costs' : ''}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{money(row.sellingPrice)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {money(row.gstCollected)}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{money(row.netRevenue)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {row.cogs > 0 ? (
                      money(row.cogs)
                    ) : (
                      <Badge tone="blue">not set</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {money(row.opex)}
                  </Td>
                  <Td className={`whitespace-nowrap text-right tabular-nums font-medium ${marginTone(row.netMargin)}`}>
                    {money(row.netProfit)}
                  </Td>
                  <Td className={`whitespace-nowrap text-right tabular-nums font-medium ${marginTone(row.netMargin)}`}>
                    {row.netMargin == null ? '—' : `${row.netMargin}%`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {open && (
        <MarginBreakdown
          row={open}
          canWrite={canWrite}
          assumptions={data?.assumptions ?? { opex: [] }}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </>
  );
}
