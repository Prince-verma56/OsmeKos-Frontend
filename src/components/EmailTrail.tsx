'use client';

import { useEffect, useState } from 'react';
import { api, dateTime } from '@/lib/api';
import { Badge, Card } from '@/components/ui';

type EmailRow = {
  id: string;
  toAddress: string;
  subject: string;
  template: string | null;
  status: 'RECORDED' | 'QUEUED' | 'SENT' | 'FAILED';
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  sentByName: string | null;
};

const TEMPLATE: Record<string, string> = {
  invoice_sent: 'Invoice',
  order_confirmation: 'Order confirmation',
  order_shipped: 'Shipped',
  payment_receipt: 'Payment receipt',
  manual: 'Message',
};

const TONE = { SENT: 'green', FAILED: 'red', QUEUED: 'amber', RECORDED: 'gray' } as const;
const LABEL = { SENT: 'Sent', FAILED: 'Failed', QUEUED: 'Sending', RECORDED: 'Not sent' } as const;

export function EmailTrail({
  ownerType,
  ownerId,
  refreshKey = 0,
}: {
  ownerType: string;
  ownerId: string;
  refreshKey?: number;
}) {
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let live = true;
    api
      .get<{ data: EmailRow[]; meta: { transportConfigured: boolean } }>('/emails', { ownerType, ownerId })
      .then((r) => {
        if (!live) return;
        setEmails(r.data);
        setEnabled(r.meta.transportConfigured);
      })
      .catch(() => {
        if (live) setEmails([]);
      });
    return () => {
      live = false;
    };
  }, [ownerType, ownerId, refreshKey]);

  if (emails === null) return null;

  return (
    <Card title={`Emails (${emails.length})`}>
      {!enabled && (
        <p className="mb-3 text-xs text-muted-foreground">
          Email is not set up yet - add the Brevo key to <code>backend/.env</code> to start sending.
        </p>
      )}
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing emailed yet</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {emails.map((e) => (
            <li key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">
                    {TEMPLATE[e.template ?? 'manual'] ?? 'Message'}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    to {e.toAddress}
                  </span>
                </span>
                <Badge tone={TONE[e.status]}>{LABEL[e.status]}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {dateTime(e.sentAt ?? e.createdAt)}
                {e.sentByName ? ` · ${e.sentByName}` : ''}
              </div>
              {e.status === 'FAILED' && e.error && (
                <div className="mt-1 text-xs text-destructive">{e.error}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
