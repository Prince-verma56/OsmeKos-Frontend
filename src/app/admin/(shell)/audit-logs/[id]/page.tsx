'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, dateTime, errorMessage } from '@/lib/api';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { AuditRecord } from '@/components/AuditRecord';

type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'OTHER';

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
  snapshot: { label: string | null; record: Record<string, unknown> } | null;
  method: string;
  path: string;
  statusCode: number;
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
  errorText: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

const ACTION_TONE: Record<Action, 'green' | 'blue' | 'red' | 'amber' | 'gray' | 'purple'> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red',
  LOGIN: 'gray', LOGOUT: 'gray', EXPORT: 'purple', OTHER: 'gray',
};

const ROUTE_BY_ENTITY: Record<string, string> = {
  Order: 'orders',
  Invoice: 'invoices',
  Bill: 'bills',
  Customer: 'customers',
  Vendor: 'vendors',
  Product: 'products',
  Item: 'items',
  'Purchase order': 'purchase-orders',
  'Purchase receive': 'purchase-receives',
  Batch: 'batches',
  'Credit note': 'credit-notes',
  'Vendor credit': 'vendor-credits',
  'Delivery challan': 'delivery-challans',
  Return: 'returns',
  'Payment received': 'payments-received',
  'e-Way bill': 'eway-bills',
  Collection: 'collections',
  Discount: 'discounts',
  'Admin user': 'admin-users',
  Role: 'roles',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm text-foreground">
        {children}
      </span>
    </div>
  );
}

export default function AuditEntryPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [related, setRelated] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<{ data: { entry: Entry; related: Entry[] } }>(`/audit-logs/${id}`);
      setEntry(res.data.entry);
      setRelated(res.data.related);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <Loading label="Loading entry…" />;
  if (error && !entry) return <ErrorBox message={error} onRetry={load} />;
  if (!entry) return null;

  const base = ROUTE_BY_ENTITY[entry.entity];
  const recordHref = base && entry.entityId ? `/${base}/${entry.entityId}` : null;
  const changeEntries = entry.changes ? Object.entries(entry.changes) : [];

  return (
    <>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin/audit-logs" className="hover:underline">
          Audit trail
        </Link>
        <span>/</span>
        <span className="text-foreground">{entry.summary}</span>
      </div>

      <PageHeader
        title={entry.summary}
        subtitle={`${dateTime(entry.occurredAt)} · ${entry.actorName ?? 'not signed in'}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={ACTION_TONE[entry.action]}>
              {entry.action.charAt(0) + entry.action.slice(1).toLowerCase()}
            </Badge>
            {recordHref && (
              <Link href={recordHref}>
                <Button variant="primary">Open the {entry.entity.toLowerCase()}</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          {entry.action === 'DELETE' && (
            <Card
              title={
                entry.snapshot
                  ? `The ${entry.entity.toLowerCase()} that was deleted`
                  : 'What was deleted'
              }
            >
              {entry.snapshot ? (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Copied the moment before it went. This is the only record left of it.
                  </p>
                  <AuditRecord record={entry.snapshot.record} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No copy was kept — this deletion predates the trail keeping one.
                </p>
              )}
            </Card>
          )}

          <Card title="What was sent">
            {changeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No body on this request — a delete or an action route carries everything it needs
                in the path.
              </p>
            ) : (
              <AuditRecord record={entry.changes as Record<string, unknown>} />
            )}
          </Card>

          {related.length > 0 && (
            <Card title={`Everything else that happened to this ${entry.entity.toLowerCase()}`} padded={false}>
              <ul className="divide-y divide-border">
                {related.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Badge tone={ACTION_TONE[r.action]}>
                      {r.action.charAt(0) + r.action.slice(1).toLowerCase()}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/audit-logs/${r.id}`}
                        className="text-sm text-gold-ink hover:underline"
                      >
                        {r.summary}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.actorName ?? 'not signed in'} · {dateTime(r.occurredAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Who">
            <div className="divide-y divide-border">
              <Row label="Name">{entry.actorName ?? 'Not signed in'}</Row>
              <Row label="Email">{entry.actorEmail ?? '—'}</Row>
              <Row label="Role">{entry.actorRole ?? '—'}</Row>
              <Row label="IP address">
                <span className="font-mono text-xs">{entry.ipAddress ?? '—'}</span>
              </Row>
            </div>
            {entry.userAgent && (
              <p className="mt-2 break-words text-[11px] text-muted-foreground">
                {entry.userAgent}
              </p>
            )}
          </Card>

          <Card title="The record">
            <div className="divide-y divide-border">
              <Row label="Area">{entry.entity}</Row>
              <Row label="Reference">{entry.entityLabel ?? '—'}</Row>
              <Row label="Id">
                {entry.entityId ? (
                  <span className="break-all font-mono text-[11px]">{entry.entityId}</span>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="When">{dateTime(entry.occurredAt)}</Row>
            </div>
            {recordHref ? (
              <div className="mt-3">
                <Link href={recordHref}>
                  <Button>Open the {entry.entity.toLowerCase()}</Button>
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {entry.action === 'DELETE'
                  ? 'The record was deleted, so there is nothing left to open — this entry is what remains of it.'
                  : 'This area has no detail page to open.'}
              </p>
            )}
          </Card>

          <Card title="The request">
            <div className="divide-y divide-border">
              <Row label="Method">
                <span className="font-mono text-xs">{entry.method}</span>
              </Row>
              <Row label="Path">
                <span className="break-all font-mono text-[11px]">{entry.path}</span>
              </Row>
              <Row label="Outcome">
                {entry.result === 'SUCCESS' ? (
                  <Badge tone="green">Succeeded {entry.statusCode}</Badge>
                ) : (
                  <Badge tone={entry.result === 'DENIED' ? 'amber' : 'red'}>
                    {entry.result === 'DENIED' ? 'Refused' : 'Failed'} {entry.statusCode}
                  </Badge>
                )}
              </Row>
            </div>
            {entry.errorText && (
              <p className="mt-2 text-xs text-destructive">{entry.errorText}</p>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
        This entry cannot be changed or removed — Postgres rejects any attempt, so what is written
        here is what happened. Passwords and tokens were replaced before anything was stored.
      </p>
    </>
  );
}
