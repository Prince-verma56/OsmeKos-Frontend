'use client';

import { shortDate } from '@/lib/api';

export function ExpiryCell({ date, days }: { date: string | null; days: number | null }) {
  if (!date) return <span className="text-muted-foreground">No expiry</span>;
  const tone = days === null ? '' : days < 0 ? 'text-destructive' : days <= 90 ? 'text-warning' : 'text-muted-foreground';
  return (
    <span className="whitespace-nowrap">
      {shortDate(date)}
      {days !== null && (
        <span className={`block text-xs ${tone}`}>{days < 0 ? `expired ${-days} days ago` : days === 0 ? 'expires today' : `${days} days left`}</span>
      )}
    </span>
  );
}
