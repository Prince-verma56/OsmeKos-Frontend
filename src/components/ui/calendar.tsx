'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, components, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        root: 'relative',
        months: 'flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'font-display text-sm font-medium tracking-wide text-foreground',
        nav: 'absolute inset-x-1 top-1 flex items-center justify-between',
        button_previous:
          'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        button_next:
          'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 pb-1 text-center font-display text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground',
        week: 'mt-0.5 flex w-full',
        day: 'relative size-9 p-0 text-center text-sm tabular-nums [&:has([aria-selected])]:bg-gold-soft first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
        day_button:
          'inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        range_start: 'rounded-l-md bg-gold-soft [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_end: 'rounded-r-md bg-gold-soft [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_middle: 'bg-gold-soft [&>button]:rounded-none [&>button]:hover:bg-gold/20',
        selected: '[&>button]:font-medium',
        today: '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-gold',
        outside: 'text-muted-foreground/50 [&>button]:text-muted-foreground/60',
        disabled: 'opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="size-4" strokeWidth={1.5} /> : <ChevronRight className="size-4" strokeWidth={1.5} />,
        ...components,
      }}
      {...props}
    />
  );
}
