'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, money, shortDate, errorMessage, type Paged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  Button, Card, EmptyRow, ErrorBox, Input, Loading, PageHeader,
  Pagination, Select, StatCard, Table, Td, Th,
} from '@/components/ui';
import { ExpenseDialog, type ExpenseRow, type Head } from '@/components/expenses/ExpenseDialog';
import { HeadsDialog } from '@/components/expenses/HeadsDialog';

type Summary = {
  total: number;
  count: number;
  byHead: { id: string; name: string; total: number; subHeads: { id: string; name: string; total: number }[] }[];
  byMonth: { month: string; total: number }[];
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function ExpensesPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [meta, setMeta] = useState<Paged<ExpenseRow>['meta'] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [heads, setHeads] = useState<Head[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [headId, setHeadId] = useState('');
  const [month, setMonth] = useState('');
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [managingHeads, setManagingHeads] = useState(false);

  const canWrite = can('expenses:write');
  const canDelete = can('expenses:delete');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, sum, hd] = await Promise.all([
        api.get<Paged<ExpenseRow>>('/expenses', {
          page,
          limit: 50,
          ...(search && { search }),
          ...(headId && { headId }),
          ...(month && { month }),
        }),
        api.get<{ data: Summary }>('/expenses/summary'),
        api.get<{ data: Head[] }>('/expenses/heads'),
      ]);
      setRows(list.data);
      setMeta(list.meta);
      setSummary(sum.data);
      setHeads(hd.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, headId, month]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const months = useMemo(() => [...(summary?.byMonth ?? [])].map((m) => m.month).reverse(), [summary]);
  const shownTotal = Number(meta?.total ?? 0);

  async function remove(row: ExpenseRow) {
    if (!confirm(`Remove ${row.description || row.head.name} of ${money(row.amount)}?`)) return;
    try {
      await api.del(`/expenses/${row.id}`);
      toast.success('Expense removed');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="What the company spends, by head and by month"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManagingHeads(true)}>
              Heads
            </Button>
            {canWrite && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                + New
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Spent all time" value={money(summary?.total ?? 0)} sub={`${summary?.count ?? 0} entries`} />
        <StatCard
          label="This month"
          value={money(summary?.byMonth.find((m) => m.month === thisMonth())?.total ?? 0)}
          sub={monthLabel(thisMonth())}
          tone="blue"
        />
        <StatCard
          label="Biggest head"
          value={summary?.byHead[0]?.name ?? '—'}
          sub={summary?.byHead[0] ? money(summary.byHead[0].total) : 'nothing yet'}
          tone="green"
        />
        <StatCard label="In this view" value={money(shownTotal)} sub={`${meta?.total ?? 0} entries`} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="By head" padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Head</Th>
                <Th className="text-right">Spent</Th>
                <Th className="text-right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {!summary?.byHead.length && <EmptyRow colSpan={3} message="Nothing recorded yet" />}
              {summary?.byHead.map((h) => (
                <tr key={h.id}>
                  <Td>
                    <div className="font-medium text-foreground">{h.name}</div>
                    {h.subHeads.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {h.subHeads.map((s) => `${s.name} ${money(s.total)}`).join(' · ')}
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium">{money(h.total)}</Td>
                  <Td className="whitespace-nowrap text-right text-muted-foreground">
                    {summary.total > 0 ? `${((h.total / summary.total) * 100).toFixed(0)}%` : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="By month" padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th className="text-right">Spent</Th>
              </tr>
            </thead>
            <tbody>
              {!summary?.byMonth.length && <EmptyRow colSpan={2} message="Nothing recorded yet" />}
              {[...(summary?.byMonth ?? [])].reverse().map((m) => (
                <tr key={m.month}>
                  <Td>{monthLabel(m.month)}</Td>
                  <Td className="whitespace-nowrap text-right font-medium">{money(m.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            placeholder="Search payee or description…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={headId}
            onChange={(e) => {
              setHeadId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Every head</option>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
          <Select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Every month</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Loading />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Head</Th>
                <Th>Sub-head</Th>
                <Th>Vendor / Payee</Th>
                <Th>Description</Th>
                <Th className="text-right">Amount</Th>
                {canWrite && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {!rows.length && <EmptyRow colSpan={canWrite ? 7 : 6} message="No expenses match this view" />}
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap">{shortDate(row.spentOn)}</Td>
                  <Td>{row.head.name}</Td>
                  <Td className="text-muted-foreground">{row.subHead?.name ?? '—'}</Td>
                  <Td>{row.payee ?? '—'}</Td>
                  <Td className="text-muted-foreground">{row.description ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-right font-medium">{money(row.amount)}</Td>
                  {canWrite && (
                    <Td className="whitespace-nowrap text-right">
                      <button onClick={() => setEditing(row)} className="text-xs text-gold-ink hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => remove(row)}
                        className="ml-3 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {meta && meta.totalPages > 1 && (
          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
        )}
      </div>

      {managingHeads && (
        <HeadsDialog
          heads={heads}
          canWrite={canWrite}
          canDelete={canDelete}
          onClose={() => setManagingHeads(false)}
          onChanged={load}
        />
      )}

      {(adding || editing) && (
        <ExpenseDialog
          heads={heads}
          expense={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}
