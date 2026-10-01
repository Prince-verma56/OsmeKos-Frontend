'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, dateTime, errorMessage, type Paged, todayIso } from '@/lib/api';
import { DateRange } from '@/components/DateRange';
import { ExportMenu } from '@/components/ExportMenu';
import type { Column } from '@/lib/export';
import {
  Badge, Card, EmptyRow, ErrorBox, Input, Loading,
  PageHeader, Pagination, Select, StatCard, Table, Td, Th,
} from '@/components/ui';

import { CardList, RecordCard, CardAction } from '@/components/CardList';
type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'OTHER';
type Result = 'SUCCESS' | 'DENIED' | 'FAILED';

type Entry = {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: Action;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  changes: Record<string, unknown> | null;
  method: string;
  path: string;
  statusCode: number;
  result: Result;
  errorText: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

type Actor = { id: string; name: string | null; email: string | null; entries: number };
type Stats = {
  total: number;
  last24h: number;
  refused: number;
  byAction: Record<string, number>;
  entities: string[];
};

const ACTION_TONE: Record<Action, 'green' | 'blue' | 'red' | 'amber' | 'gray' | 'purple'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'gray',
  LOGOUT: 'gray',
  EXPORT: 'purple',
  OTHER: 'gray',
};

const today = () => todayIso();
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [includeAuth, setIncludeAuth] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<Paged<Entry>>('/audit-logs', {
        page,
        limit: pageSize,
        search: search || undefined,
        actorId: actorId || undefined,
        action: action || undefined,
        entity: entity || undefined,
        result: result || undefined,
        includeAuth: includeAuth ? 'true' : undefined,
        from,
        to,
      });
      setRows(res.data);
      setMeta({ page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, actorId, action, entity, result, includeAuth, from, to]);

  const loadSide = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.get<{ data: Stats }>('/audit-logs/stats'),
        api.get<{ data: Actor[] }>('/audit-logs/actors'),
      ]);
      setStats(s.data);
      setActors(a.data);
    } catch {
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const t = setTimeout(loadSide, 0);
    return () => clearTimeout(t);
  }, [loadSide]);

  function exportSpec() {
    const columns: Column<Entry>[] = [
      { header: 'When', value: (r) => dateTime(r.occurredAt), width: 150 },
      { header: 'Who', value: (r) => r.actorName ?? 'Not signed in', width: 120 },
      { header: 'Email', value: (r) => r.actorEmail ?? '' },
      { header: 'Role', value: (r) => r.actorRole ?? '' },
      { header: 'Action', value: (r) => r.action },
      { header: 'Entity', value: (r) => r.entity },
      { header: 'Record', value: (r) => r.entityLabel ?? r.entityId ?? '' },
      { header: 'What happened', value: (r) => r.summary, width: 200 },
      { header: 'Result', value: (r) => r.result },
      { header: 'Status', value: (r) => r.statusCode, align: 'right' as const },
      { header: 'Method', value: (r) => r.method },
      { header: 'Path', value: (r) => r.path, width: 180 },
      { header: 'IP', value: (r) => r.ipAddress ?? '' },
    ];
    return {
      title: 'Audit trail',
      subtitle: `${from} to ${to} · ${meta.total} entr${meta.total === 1 ? 'y' : 'ies'}`,
      columns,
      rows,
      footnote:
        'The trail is append-only: the database refuses any attempt to change or remove an entry, ' +
        'so what is here is what happened. Sign-ins are recorded but hidden unless asked for.',
      orientation: 'landscape' as const,
    };
  }

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Who changed what, and when — append-only"
        actions={<ExportMenu spec={exportSpec} disabled={!rows.length} />}
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Entries recorded" value={stats.total} />
          <StatCard label="Last 24 hours" value={stats.last24h} tone="blue" />
          <StatCard
            label="Refused or failed"
            value={stats.refused}
            tone={stats.refused > 0 ? 'amber' : 'slate'}
            sub="blocked attempts and errors"
          />
          <StatCard label="People on record" value={actors.length} tone="purple" />
        </div>
      )}

      <Card padded={false} className="mb-5">
        <div className="flex flex-wrap items-end gap-3 p-3">
          <DateRange
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
              setPage(1);
            }}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Who
            </span>
            <Select
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Anyone</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email} ({a.entries})
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Action
            </span>
            <Select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Any action</option>
              {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'OTHER'].map((a) => (
                <option key={a} value={a}>
                  {a.charAt(0) + a.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Area
            </span>
            <Select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Everything</option>
              {(stats?.entities ?? []).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Result
            </span>
            <Select
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Any result</option>
              <option value="SUCCESS">Succeeded</option>
              <option value="DENIED">Refused</option>
              <option value="FAILED">Failed</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeAuth}
              onChange={(e) => {
                setIncludeAuth(e.target.checked);
                setPage(1);
              }}
            />
            Include sign-ins
          </label>
          <Input
            placeholder="Search summary, record or person…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        </div>
      </Card>

      <Card padded={false}>
        {loading ? (
          <Loading label="Loading the trail…" />
        ) : (
          <>
            <CardList empty="Nothing recorded in this period">
              {rows.map((r) => (
                <RecordCard
                  key={r.id}
                  href={`/admin/audit-logs/${r.id}`}
                  mono={false}
                  title={r.summary}
                  date={dateTime(r.occurredAt)}
                  primary={r.actorName ?? 'Not signed in'}
                  secondary={r.actorName ? (r.actorRole ?? r.actorEmail) : undefined}
                  footer={
                    <span className="font-mono">
                      {r.method} {r.path}
                      {r.ipAddress ? ` · ${r.ipAddress}` : ''}
                    </span>
                  }
                  badges={
                    <>
                      <Badge tone={ACTION_TONE[r.action]}>
                        {r.action.charAt(0) + r.action.slice(1).toLowerCase()}
                      </Badge>
                      {r.result === 'SUCCESS' ? (
                        <Badge tone="green">{r.statusCode}</Badge>
                      ) : (
                        <Badge tone={r.result === 'DENIED' ? 'amber' : 'red'}>
                          {r.result === 'DENIED' ? 'Refused' : 'Failed'} {r.statusCode}
                        </Badge>
                      )}
                    </>
                  }
                  actions={<CardAction href={`/admin/audit-logs/${r.id}`}>Details</CardAction>}
                />
              ))}
            </CardList>

            <div className="hidden md:block">
            <Table minWidth="900px">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>What happened</Th>
                  <Th>Result</Th>
                  <Th>From</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyRow colSpan={7} message="Nothing recorded in this period" />
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs">{dateTime(r.occurredAt)}</Td>
                    <Td>
                      {r.actorName ? (
                        <>
                          <div className="font-medium text-foreground">
                            {r.actorName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.actorRole ?? r.actorEmail}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not signed in</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={ACTION_TONE[r.action]}>
                        {r.action.charAt(0) + r.action.slice(1).toLowerCase()}
                      </Badge>
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/audit-logs/${r.id}`}
                        className="text-foreground hover:text-gold-ink hover:underline"
                      >
                        {r.summary}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {r.method} {r.path}
                      </div>
                    </Td>
                    <Td>
                      {r.result === 'SUCCESS' ? (
                        <Badge tone="green">{r.statusCode}</Badge>
                      ) : (
                        <Badge tone={r.result === 'DENIED' ? 'amber' : 'red'}>
                          {r.result === 'DENIED' ? 'Refused' : 'Failed'} {r.statusCode}
                        </Badge>
                      )}
                    </Td>
                    <Td className="font-mono text-[11px] text-muted-foreground">
                      {r.ipAddress ?? '—'}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/audit-logs/${r.id}`}
                        className="text-xs text-gold-ink hover:underline"
                      >
                        Details
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </div>
            <Pagination
              pageSize={pageSize}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        The trail is append-only and the database enforces it — an attempt to change, delete or
        truncate an entry is rejected by Postgres itself, not merely by this application. Passwords
        and tokens are replaced with <span className="font-mono">[redacted]</span> before anything
        is written. Reads are not recorded: only changes, sign-ins, and attempts that were refused.
      </p>
    </>
  );
}
