'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2, CalendarClock, ChevronRight, CircleAlert, CircleCheck, ClipboardCheck, FileWarning,
  OctagonAlert, PackageOpen, PackageSearch, Receipt, Tag, type LucideIcon,
} from 'lucide-react';
import { api, errorMessage, money, shortDate } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Card, ErrorBox, Spinner } from '@/components/ui';
import { Skeleton } from '@/components/ui/misc';

export type AttentionTone = 'red' | 'amber' | 'info';

export type AttentionItem = {
  key: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: AttentionTone;
  amount?: number;
  date?: string;
  units?: number;
};

const ICONS: Record<string, LucideIcon> = {
  qc: ClipboardCheck,
  labelling: Tag,
  toPack: PackageOpen,
  expiring: CalendarClock,
  expired: OctagonAlert,
  reorder: PackageSearch,
  overdueInvoices: FileWarning,
  billsDue: Receipt,
  b2bApprovals: Building2,
};

const ICON_TONE: Record<AttentionTone, string> = {
  red: 'bg-destructive/10 text-destructive',
  amber: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

const COUNT_TONE: Record<AttentionTone, string> = {
  red: 'text-destructive',
  amber: 'text-warning',
  info: 'text-info',
};

const detailLine = (item: AttentionItem) =>
  [item.amount != null ? money(item.amount) : '', item.detail, item.date ? shortDate(item.date) : '']
    .filter(Boolean)
    .join(' ');

export function NeedsAttention() {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: AttentionItem[] }>('/dashboard/attention');
      setItems(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const total = items?.length ?? 0;

  return (
    <Card
      title="Needs attention"
      padded={false}
      className="mb-5"
      action={
        loading && items ? (
          <Spinner />
        ) : total > 0 ? (
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? 'thing' : 'things'} to look at
          </span>
        ) : null
      }
    >
      {loading && !items ? (
        <div className="grid gap-2 p-3 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error && !items ? (
        <div className="p-3">
          <ErrorBox message={error} onRetry={load} />
        </div>
      ) : total === 0 ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success [&_svg]:size-4">
            <CircleCheck aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-2 p-3 md:grid-cols-2 2xl:grid-cols-3">
          {items?.map((item) => {
            const Icon = ICONS[item.key] ?? CircleAlert;
            return (
              <li key={item.key} className="min-w-0">
                <Link
                  href={item.href}
                  className="group flex h-full min-w-0 items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
                      ICON_TONE[item.tone]
                    )}
                  >
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{detailLine(item)}</span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-display text-xl font-medium leading-none tabular-nums',
                      COUNT_TONE[item.tone]
                    )}
                  >
                    {item.count}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
