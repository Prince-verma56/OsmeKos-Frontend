'use client';

import * as React from 'react';
import type { DropdownProps } from 'react-day-picker';
import { CalendarDays, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, todayIso } from '@/lib/formatPrefs';
import { notifyEdited } from '@/lib/unsaved';
import { Calendar } from './calendar';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './popover';
import { Button } from './button';
import { Select } from './select';

const toDate = (iso?: string | null) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function CaptionDropdown({ options, value, onChange, 'aria-label': ariaLabel }: DropdownProps) {
  return (
    <Select
      value={value === undefined ? '' : String(value)}
      aria-label={ariaLabel}
      className="h-8 w-auto text-sm font-medium"
      onChange={(e) => onChange?.(e)}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  name,
  id,
  placeholder = 'Pick a date',
  className,
  clearable = true,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const today = toDate(todayIso());
  const todayAllowed = today && (!minDate || today >= minDate) && (!maxDate || today <= maxDate);

  const commit = (next: string) => {
    if (next !== value) notifyEdited(rootRef.current);
    onChange(next);
  };

  const now = new Date();
  const startMonth = minDate ?? new Date(now.getFullYear() - 10, 0, 1);
  const endMonth = maxDate ?? new Date(now.getFullYear() + 10, 11, 31);

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      {(required || name) && (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required={required}
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel ?? (selected ? `Date, ${formatDate(value)}` : placeholder)}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-foreground shadow-xs transition-[border-color,box-shadow] hover:border-muted-foreground/40 focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground',
              open && 'border-gold ring-2 ring-gold/30'
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className={cn('min-w-0 flex-1 truncate tabular-nums', !selected && 'text-muted-foreground')}>
              {selected ? formatDate(value) : placeholder}
            </span>
            {clearable && selected && !disabled && !required && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear date"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commit('');
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <X className="size-3.5" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={8} className="w-auto p-3">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? today}
            onSelect={(d) => {
              if (!d) return;
              commit(toIso(d));
              setOpen(false);
            }}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            weekStartsOn={1}
            components={{ Dropdown: CaptionDropdown }}
            classNames={{
              month_caption: 'flex h-9 items-center justify-center px-8',
              dropdowns: 'flex items-center gap-1.5',
              caption_label: 'hidden',
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2.5">
            <Button
              size="xs"
              variant="ghost"
              disabled={!todayAllowed}
              onClick={() => {
                commit(todayIso());
                setOpen(false);
              }}
            >
              Today
            </Button>
            {clearable && !required && (
              <Button
                size="xs"
                variant="ghost"
                disabled={!selected}
                onClick={() => {
                  commit('');
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
