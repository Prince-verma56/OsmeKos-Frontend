'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { checkValue, ruleFor, VALIDATE_EVENT } from '@/lib/validation';
import { Button as ButtonBase, type ButtonProps as ButtonBaseProps } from './ui/button';
import { Input as InputBase, Select as SelectBase, Textarea as TextareaBase } from './ui/input';
import { BadgePill, type BadgeTone } from './ui/badge';
import { Skeleton } from './ui/misc';

export type ButtonProps = ButtonBaseProps;
export const Button = ButtonBase;
export const Input = InputBase;
export const Select = SelectBase;
export const Textarea = TextareaBase;

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className = '',
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLLabelElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const check = (withEmpty: boolean) => {
      if (withEmpty) asked.current = true;
      const inputs = [...root.querySelectorAll<HTMLInputElement>('input:not([type=hidden]):not([aria-hidden])')];
      const values = [
        ...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]), textarea'),
      ].filter((el) => !el.disabled);
      let first: string | null = null;
      for (const input of inputs) {
        const message = input.disabled || input.readOnly ? null : checkValue(ruleFor(input, label), input.value);
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        if (message && !first) first = inputs.length > 1 && input.placeholder ? `${input.placeholder}: ${message}` : message;
      }
      if (!first && required && asked.current && values.length > 0 && values.every((el) => !el.value.trim())) {
        first = 'this is needed';
        for (const el of inputs) el.setAttribute('aria-invalid', 'true');
      }
      root.dataset.invalid = first ? 'true' : 'false';
      root.dataset.label = label;
      root.dataset.problem = first ?? '';
      setProblem(first);
    };

    const onBlur = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) check(false);
    };
    const onInput = () => {
      if (root.dataset.invalid === 'true' || asked.current) check(asked.current);
    };
    const onAsk = () => check(true);

    root.addEventListener('focusout', onBlur);
    root.addEventListener('input', onInput);
    root.addEventListener(VALIDATE_EVENT, onAsk);
    return () => {
      root.removeEventListener('focusout', onBlur);
      root.removeEventListener('input', onInput);
      root.removeEventListener(VALIDATE_EVENT, onAsk);
    };
  }, [label, required]);

  const shown = error ?? problem;

  return (
    <label ref={ref} data-field="" className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {shown ? (
        <span role="alert" className="mt-1 block text-xs text-destructive">{shown}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted-foreground/80">{hint}</span>
      )}
    </label>
  );
}

export function Derived({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'bad';
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          'h-9 rounded-md border border-dashed border-border bg-muted/30 px-3 py-1.5 text-sm tabular-nums',
          value == null ? 'text-muted-foreground/50' : tone === 'bad' ? 'font-medium text-destructive' : 'font-medium text-foreground'
        )}
      >
        {value ?? '—'}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground/80">{hint}</span>}
    </div>
  );
}

export function statusTone(status?: string | null): BadgeTone {
  switch (status) {
    case 'ACTIVE': case 'PAID': case 'FULFILLED': case 'DELIVERED': case 'RECEIVED':
    case 'ADJUSTED': case 'APPROVED': case 'CLOSED': case 'COMPLETED': case 'CONFIRMED':
    case 'AUTO_CONFIRMED': case 'FULL': case 'APPLIED': case 'AVAILABLE': case 'ACCEPTED':
      return 'green';
    case 'DRAFT': case 'UNFULFILLED': case 'NOT_SHIPPED': case 'REQUESTED':
    case 'NONE': case 'NOT_REQUIRED': case 'INACTIVE': case 'PLANNED':
      return 'sand';
    case 'PENDING': case 'PENDING_QC': case 'IN_PROGRESS':
      return 'amber';
    case 'ON_HOLD':
      return 'amber-outline';
    case 'PARTIALLY_PAID': case 'PARTIALLY_FULFILLED': case 'PARTIALLY_RECEIVED':
    case 'PARTIAL': case 'IN_TRANSIT': case 'OUT_FOR_DELIVERY':
    case 'PARTIALLY_APPLIED':
      return 'gold';
    case 'OVERDUE': case 'EXPIRED':
      return 'red';
    case 'CANCELLED': case 'REJECTED': case 'VOID': case 'FAILED': case 'RTO': case 'BLOCKED':
      return 'red';
    case 'RECALLED':
      return 'red-outline';
    case 'ISSUED': case 'OPEN': case 'ARCHIVED':
      return 'blue';
    case 'UNAPPLIED':
      return 'purple';
    default:
      return 'sand';
  }
}

export function Badge({
  children,
  tone,
  status,
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  status?: string | null;
  dot?: boolean;
  className?: string;
}) {
  return (
    <BadgePill tone={tone ?? statusTone(status)} dot={dot} className={className}>
      {children}
    </BadgePill>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
  padded = true,
  collapsible = false,
  defaultOpen = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shut = collapsible && !open;

  const heading = title && (
    <h2 className="flex items-center gap-1.5 font-display text-[15px] font-medium tracking-wide text-foreground">
      {collapsible && (
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-150', !open && '-rotate-90')}
        />
      )}
      {title}
    </h2>
  );

  return (
    <div className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-xs', className)}>
      {(title || action) && (
        <div className={cn('flex items-center justify-between gap-3 px-4 py-2.5', !shut && 'border-b border-border')}>
          {collapsible && title ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="-mx-1 flex min-w-0 items-center rounded px-1 text-left transition-colors hover:text-gold-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {heading}
            </button>
          ) : (
            heading
          )}
          {action}
        </div>
      )}
      <div className={cn(shut && 'hidden', padded && 'p-4')}>{children}</div>
    </div>
  );
}

export type StatDetailGroup = {
  heading: string;
  rows: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode }[];
};

const STAT_TONES = {
  slate: 'text-foreground',
  blue: 'text-info',
  green: 'text-success',
  amber: 'text-warning',
  red: 'text-destructive',
  purple: 'text-gold-ink',
  gold: 'text-gold-ink',
};

const STAT_VALUE_MIN_PX = 14;

const spills = (el: HTMLElement) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth;

function fitStat(label: HTMLElement | null, value: HTMLElement | null) {
  if (label) {
    label.style.letterSpacing = '';
    label.style.overflowWrap = '';
    if (spills(label)) {
      label.style.letterSpacing = '0.02em';
      if (spills(label)) label.style.overflowWrap = 'anywhere';
    }
  }
  if (value) {
    value.style.fontSize = '';
    value.style.whiteSpace = '';
    if (spills(value)) {
      const base = parseFloat(getComputedStyle(value).fontSize);
      let size = Math.max(STAT_VALUE_MIN_PX, Math.floor((base * value.clientWidth) / value.scrollWidth));
      value.style.fontSize = `${size}px`;
      while (size > STAT_VALUE_MIN_PX && spills(value)) {
        size -= 1;
        value.style.fontSize = `${size}px`;
      }
      if (spills(value)) value.style.whiteSpace = 'normal';
    }
  }
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'slate',
  details,
  align = 'left',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: keyof typeof STAT_TONES;
  details?: StatDetailGroup[];
  align?: 'left' | 'right';
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const pointer = useRef('mouse');
  const groups = (details ?? []).filter((g) => g.rows.length > 0);
  const hasDetails = groups.length > 0;

  useLayoutEffect(() => {
    fitStat(labelRef.current, valueRef.current);
  });

  useEffect(() => {
    const card = box.current;
    if (!card) return;
    const refit = () => fitStat(labelRef.current, valueRef.current);
    let width = card.clientWidth;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (card.clientWidth === width) return;
            width = card.clientWidth;
            refit();
          });
    observer?.observe(card);
    document.fonts?.ready.then(refit).catch(() => {});
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div
      ref={box}
      className="relative min-w-0"
      onPointerEnter={
        hasDetails
          ? (e) => {
              pointer.current = e.pointerType;
              if (e.pointerType === 'mouse') setOpen(true);
            }
          : undefined
      }
      onPointerLeave={hasDetails ? (e) => e.pointerType === 'mouse' && setOpen(false) : undefined}
    >
      <div
        role={hasDetails ? 'button' : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        aria-expanded={hasDetails ? open : undefined}
        onPointerDown={hasDetails ? (e) => { pointer.current = e.pointerType; } : undefined}
        onClick={hasDetails ? () => setOpen((o) => (pointer.current === 'mouse' ? true : !o)) : undefined}
        onKeyDown={
          hasDetails
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen((o) => !o);
                }
              }
            : undefined
        }
        className={cn(
          'h-full min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow',
          hasDetails && 'cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'shadow-md ring-1 ring-gold/40'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div ref={labelRef} className="caps-label leading-snug tracking-[0.12em]" title={label}>{label}</div>
            <div
              ref={valueRef}
              className={cn(
                'mt-1.5 overflow-hidden whitespace-nowrap font-display text-[26px] font-medium leading-none tabular-nums [overflow-wrap:anywhere]',
                STAT_TONES[tone]
              )}
            >
              {value}
            </div>
            {sub && <div className="mt-1.5 break-words text-xs text-muted-foreground">{sub}</div>}
          </div>
          {icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/60 text-gold-ink [&_svg]:size-4">
              {icon}
            </span>
          ) : hasDetails ? (
            <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          ) : null}
        </div>
      </div>
      {hasDetails && open && (
        <div
          role="dialog"
          aria-label={`${label} breakdown`}
          className={cn('absolute top-full z-30 w-72 max-w-[calc(100vw-2rem)] pt-2', align === 'right' ? 'right-0' : 'left-0')}
        >
          <div className="fade-up max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-popover p-3 shadow-lg">
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.heading}>
                  <div className="caps-label mb-1">{g.heading}</div>
                  <dl className="space-y-1">
                    {g.rows.map((r, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
                        <dt className="min-w-0 text-muted-foreground">
                          {r.label}
                          {r.note && <span className="ml-1 text-[11px] text-muted-foreground/70">{r.note}</span>}
                        </dt>
                        <dd className="shrink-0 text-right font-medium tabular-nums text-foreground">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Table({ children, minWidth, dense = false }: { children: React.ReactNode; minWidth?: string; dense?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn('data-table w-full text-sm', dense && '[&_td]:px-2 [&_th]:px-2')}
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'sticky top-0 z-1 whitespace-nowrap border-b border-border bg-muted px-3 py-2 text-left font-display text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = '',
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn('border-b border-border/70 px-3 py-2 text-foreground/90 tabular-nums', className)}>
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, message = 'Nothing here yet' }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn('size-4 animate-spin rounded-full border-2 border-border border-t-gold', className)}
      aria-hidden
    />
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Spinner />
      {label}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-destructive">{message}</p>
        {onRetry && (
          <Button size="sm" className="mt-2" onClick={onRetry}>
            <RotateCcw /> Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="caps-label mb-1.5">{eyebrow}</div>}
        <h1 className="font-display text-[26px] font-medium leading-tight tracking-wide text-foreground sm:text-[28px]">
          {title}
        </h1>
        <span className="hairline mt-2.5" aria-hidden />
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-gold/60 text-gold-ink [&_svg]:size-5">
          {icon}
        </span>
      )}
      <h3 className="font-display text-lg font-medium tracking-wide text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const PAGE_SIZES = [20, 50, 100];

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  pageSize,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  pageSize?: number;
  onPageSize?: (n: number) => void;
}) {
  if (total === 0) return null;
  const last = Math.max(totalPages, 1);
  const first = pageSize ? (page - 1) * pageSize + 1 : null;
  const upTo = pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2">
      <span className="text-xs text-muted-foreground">
        {first !== null ? (
          <>
            Showing <span className="tabular-nums">{first}</span>–<span className="tabular-nums">{upTo}</span> of{' '}
            <span className="tabular-nums">{total}</span>
          </>
        ) : (
          <>
            Page {page} of {last} · {total} total
          </>
        )}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {pageSize !== undefined && onPageSize && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Rows
            <Select
              value={String(pageSize)}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="w-18 text-xs"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button size="sm" disabled={page <= 1} onClick={() => onPage(1)} title="First page">
            «
          </Button>
          <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <span className="whitespace-nowrap px-1.5 text-xs tabular-nums text-muted-foreground">
            {page} / {last}
          </span>
          <Button size="sm" disabled={page >= last} onClick={() => onPage(page + 1)}>
            Next
          </Button>
          <Button size="sm" disabled={page >= last} onClick={() => onPage(last)} title="Last page">
            »
          </Button>
        </div>
      </div>
    </div>
  );
}
