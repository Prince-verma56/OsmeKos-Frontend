'use client';

import Link from 'next/link';
import { Button } from './ui';

export function CardList({
  empty,
  children,
}: {
  empty?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.flat() : children;
  const isEmpty = !rows || (Array.isArray(rows) && rows.length === 0);
  return (
    <ul className="divide-y divide-border md:hidden">
      {isEmpty ? (
        <li className="px-4 py-10 text-center text-sm text-muted-foreground">
          {empty ?? 'Nothing to show'}
        </li>
      ) : (
        rows
      )}
    </ul>
  );
}

export function RecordCard({
  href,
  title,
  amount,
  strike = false,
  mono = true,
  date,
  note,
  primary,
  secondary,
  badges,
  alert,
  footer,
  actions,
  select,
  thumb,
}: {
  href?: string;
  title: React.ReactNode;
  amount?: React.ReactNode;
  strike?: boolean;
  mono?: boolean;
  date?: React.ReactNode;
  note?: React.ReactNode;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  badges?: React.ReactNode;
  alert?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  select?: React.ReactNode;
  thumb?: React.ReactNode;
}) {
  const struck = strike ? 'line-through opacity-70' : '';
  const heading = (
    <span className={`${mono ? 'font-mono' : ''} text-sm font-medium text-gold-ink
       ${struck}`}
    >
      {title}
    </span>
  );

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        {select && <span className="pt-0.5">{select}</span>}
        {thumb && <span className="pt-0.5">{thumb}</span>}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {href ? <Link href={href}>{heading}</Link> : heading}
            </span>
            {amount != null && (
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums text-foreground
                   ${struck}`}
              >
                {amount}
              </span>
            )}
          </div>

          {(date != null || note != null) && (
            <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-muted-foreground">{date}</span>
              {note != null && (
                <span className="shrink-0 tabular-nums text-warning">
                  {note}
                </span>
              )}
            </div>
          )}

          {primary != null && (
            <div className="mt-1.5 truncate text-sm text-foreground">
              {primary}
            </div>
          )}
          {secondary != null && (
            <div className="truncate text-xs text-muted-foreground">{secondary}</div>
          )}

          {badges && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
          )}

          {alert != null && (
            <div className="mt-1.5 text-xs text-warning">{alert}</div>
          )}

          {(footer != null || actions || href) && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {footer}
              </span>
              <div className="flex shrink-0 gap-1.5">
                {actions ?? (
                  href && (
                    <Link href={href}>
                      <Button size="sm">View</Button>
                    </Link>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function CardAction({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost' | 'success';
}) {
  return (
    <Link href={href}>
      <Button size="sm" variant={variant}>
        {children}
      </Button>
    </Link>
  );
}
