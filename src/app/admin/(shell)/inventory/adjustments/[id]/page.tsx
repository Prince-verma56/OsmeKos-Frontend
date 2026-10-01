'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, money, shortDate, dateTime, errorMessage } from '@/lib/api';
import {
  Badge, Button, Card, ErrorBox, Loading, PageHeader, Spinner, Table, Td, Th,
} from '@/components/ui';
import { Thumb } from '@/components/SearchSelect';

type Line = {
  id: string;
  quantityAvailableSnapshot: string | null;
  newQuantityOnHand: string | null;
  quantityAdjusted: string | null;
  quantitySent: string | null;
  quantityReceived: string | null;
  currentValue: string | null;
  changedValue: string | null;
  notes: string | null;
  item: {
    id: string;
    name: string;
    sku: string | null;
    unit: string | null;
    imageUrls?: string[];
  } | null;
};

type Place = { id: string; name: string; code: string };

type Doc = {
  id: string;
  docNumber: string;
  type: 'ADJUSTMENT' | 'TRANSFER';
  mode: 'QUANTITY' | 'VALUE' | null;
  referenceNumber: string | null;
  documentDate: string;
  account: string | null;
  reason: string | null;
  description: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
  location: Place | null;
  toLocation?: Place | null;
  lines: Line[];
};

type Step = 'post' | 'cancel' | 'dispatch' | 'receive';

const REASON_LABEL: Record<string, string> = {
  REVALUATION: 'Revaluation',
  DAMAGED: 'Damaged',
  STOCK_RECEIVED: 'Stock received',
  MANUAL_CORRECTION: 'Manual correction',
  EXPIRED: 'Expired',
  STOLEN: 'Stolen',
  GIVEAWAY: 'Giveaway',
  SAMPLE: 'Sample',
};

const STEP_PATH: Record<Step, (id: string) => string> = {
  post: (id) => `/inventory/adjustments/${id}/post`,
  cancel: (id) => `/inventory/documents/${id}/cancel`,
  dispatch: (id) => `/inventory/transfers/${id}/dispatch`,
  receive: (id) => `/inventory/transfers/${id}/receive`,
};

const STEP_CONFIRM: Partial<Record<Step, string>> = {
  cancel: 'Cancel this draft? Nothing has moved yet, so no stock changes.',
  receive: 'Mark this transfer received? The stock becomes on hand at the destination.',
};

const N = (v: string | null) => (v == null ? null : Number(v));
const placeName = (p: Place | null | undefined) => (p ? `${p.name} (${p.code})` : '—');

export default function AdjustmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Step | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<{ data: Doc }>(`/inventory/documents/${id}`);
      setDoc(res.data);
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

  async function act(step: Step) {
    const question = STEP_CONFIRM[step];
    if (question && !confirm(question)) return;
    setBusy(step);
    setError('');
    try {
      await api.post(STEP_PATH[step](id));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading document…" />;
  if (error && !doc) return <ErrorBox message={error} onRetry={load} />;
  if (!doc) return null;

  const isTransfer = doc.type === 'TRANSFER';
  const isValue = doc.mode === 'VALUE';
  const valueChange = doc.lines.reduce((a, l) => a + (N(l.changedValue) ?? 0), 0);
  const unitChange = doc.lines.reduce((a, l) => a + (N(l.quantityAdjusted) ?? 0), 0);
  const unitsSent = doc.lines.reduce((a, l) => a + (N(l.quantitySent) ?? 0), 0);
  const lineCount = `${doc.lines.length} line${doc.lines.length === 1 ? '' : 's'}`;

  const meta: [string, React.ReactNode][] = isTransfer
    ? [
        ['Date', shortDate(doc.documentDate)],
        ['Reference', doc.referenceNumber ?? '—'],
        ['From', placeName(doc.location)],
        ['To', placeName(doc.toLocation)],
        ['Received', doc.completedAt ? dateTime(doc.completedAt) : 'Not yet'],
      ]
    : [
        ['Date', shortDate(doc.documentDate)],
        ['Reference', doc.referenceNumber ?? '—'],
        ['Location', placeName(doc.location)],
        ['Reason', doc.reason ? (REASON_LABEL[doc.reason] ?? doc.reason) : '—'],
        ['Account', doc.account ?? '—'],
        ['Posted', doc.completedAt ? dateTime(doc.completedAt) : 'Not posted'],
      ];

  const stepButton = (step: Step, label: string, variant: 'success' | 'danger' | 'primary') => (
    <Button size="sm" variant={variant} disabled={!!busy} onClick={() => act(step)}>
      {busy === step && <Spinner className="border-card/40 border-t-card" />}
      {label}
    </Button>
  );

  return (
    <>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin/inventory/adjustments" className="hover:underline">
          Inventory Adjustments
        </Link>
        <span>/</span>
        <span className="text-foreground">{doc.docNumber}</span>
      </div>

      <PageHeader
        title={doc.docNumber}
        subtitle={
          isTransfer
            ? `Stock transfer · ${doc.location?.code ?? '?'} → ${doc.toLocation?.code ?? '?'} · ${lineCount}`
            : `${isValue ? 'Value' : 'Quantity'} adjustment · ${lineCount}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={doc.status}>{doc.status.replaceAll('_', ' ')}</Badge>
            {isTransfer ? (
              <Badge tone="blue">Transfer</Badge>
            ) : (
              <Badge tone={isValue ? 'purple' : 'blue'}>{isValue ? 'Value' : 'Quantity'}</Badge>
            )}
            {doc.status === 'DRAFT' &&
              (isTransfer ? stepButton('dispatch', 'Send transfer', 'success') : stepButton('post', 'Post adjustment', 'success'))}
            {doc.status === 'DRAFT' && stepButton('cancel', 'Cancel draft', 'danger')}
            {isTransfer && doc.status === 'IN_TRANSIT' && stepButton('receive', 'Mark received', 'success')}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card title="Lines" padded={false}>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  {isTransfer ? (
                    <>
                      <Th className="text-right">Sent</Th>
                      <Th className="text-right">Received</Th>
                    </>
                  ) : isValue ? (
                    <>
                      <Th className="text-right">Value before</Th>
                      <Th className="text-right">Change</Th>
                      <Th className="text-right">Value after</Th>
                    </>
                  ) : (
                    <>
                      <Th className="text-right">Available then</Th>
                      <Th className="text-right">Change</Th>
                      <Th className="text-right">New on hand</Th>
                    </>
                  )}
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l) => {
                  const before = N(l.currentValue);
                  const change = N(l.changedValue);
                  const qty = N(l.quantityAdjusted);
                  const unit = l.item?.unit ? ` ${l.item.unit}` : '';
                  return (
                    <tr key={l.id} className="hover:bg-muted/60">
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Thumb url={l.item?.imageUrls?.[0]} label={l.item?.name ?? '?'} />
                          <div className="min-w-0">
                            {l.item ? (
                              <Link
                                href={`/admin/inventory/${l.item.id}`}
                                className="text-gold-ink hover:underline"
                              >
                                {l.item.name}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                Item removed
                              </span>
                            )}
                            <div className="font-mono text-xs text-muted-foreground">
                              {l.item?.sku ?? '—'}
                            </div>
                          </div>
                        </div>
                      </Td>

                      {isTransfer ? (
                        <>
                          <Td className="text-right tabular-nums">
                            {N(l.quantitySent) ?? '—'}
                            {unit}
                          </Td>
                          <Td className="text-right tabular-nums">
                            {N(l.quantityReceived) != null ? `${N(l.quantityReceived)}${unit}` : '—'}
                          </Td>
                        </>
                      ) : isValue ? (
                        <>
                          <Td className="text-right tabular-nums">
                            {before != null ? money(before) : '—'}
                          </Td>
                          <Td
                            className={`text-right font-medium tabular-nums ${
                              (change ?? 0) < 0
                                ? 'text-destructive'
                                : 'text-success'
                            }`}
                          >
                            {change != null ? `${change > 0 ? '+' : ''}${money(change)}` : '—'}
                          </Td>
                          <Td className="text-right tabular-nums">
                            {before != null && change != null ? money(before + change) : '—'}
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td className="text-right tabular-nums">
                            {N(l.quantityAvailableSnapshot) ?? '—'}
                          </Td>
                          <Td
                            className={`text-right font-medium tabular-nums ${
                              (qty ?? 0) < 0
                                ? 'text-destructive'
                                : 'text-success'
                            }`}
                          >
                            {qty != null ? `${qty > 0 ? '+' : ''}${qty}` : '—'}
                            {unit}
                          </Td>
                          <Td className="text-right tabular-nums">
                            {N(l.newQuantityOnHand) ?? '—'}
                          </Td>
                        </>
                      )}

                      <Td className="text-xs text-muted-foreground">
                        {l.notes ?? '—'}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          {doc.description && (
            <Card title="Description">
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {doc.description}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Details">
            <div className="divide-y divide-border">
              {meta.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 py-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {label}
                  </span>
                  <span className="min-w-0 text-right text-sm text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title={isTransfer ? 'Movement' : 'Net effect'}>
            {isTransfer ? (
              <>
                <div className="text-2xl font-semibold tabular-nums text-info">
                  {unitsSent}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.status === 'DRAFT'
                    ? `Units to move from ${doc.location?.code ?? 'the source'} to ${doc.toLocation?.code ?? 'the destination'}. Nothing has moved yet - send the transfer when the stock leaves.`
                    : doc.status === 'IN_TRANSIT'
                      ? `Units out of ${doc.location?.code ?? 'the source'} and on their way. They show as incoming at ${doc.toLocation?.code ?? 'the destination'} until received.`
                      : doc.status === 'RECEIVED'
                        ? `Units moved from ${doc.location?.code ?? 'the source'} to ${doc.toLocation?.code ?? 'the destination'}.`
                        : 'This transfer was cancelled before anything moved.'}
                </p>
              </>
            ) : isValue ? (
              <>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    valueChange < 0
                      ? 'text-destructive'
                      : 'text-success'
                  }`}
                >
                  {valueChange > 0 ? '+' : ''}
                  {money(valueChange)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Change in stock value across {lineCount}. Quantities are untouched by a value
                  adjustment.
                </p>
              </>
            ) : (
              <>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    unitChange < 0
                      ? 'text-destructive'
                      : 'text-success'
                  }`}
                >
                  {unitChange > 0 ? '+' : ''}
                  {unitChange}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Net units across {lineCount}.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
