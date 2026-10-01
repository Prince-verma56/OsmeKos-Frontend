import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset [&>[data-dot]]:size-1.5 [&>[data-dot]]:shrink-0 [&>[data-dot]]:rounded-full',
  {
    variants: {
      tone: {
        sand: 'bg-muted text-foreground/80 ring-border [&>[data-dot]]:bg-muted-foreground/60',
        gray: 'bg-muted text-foreground/80 ring-border [&>[data-dot]]:bg-muted-foreground/60',
        gold: 'bg-gold-soft text-gold-ink ring-gold/30 [&>[data-dot]]:bg-gold',
        green: 'bg-success/10 text-success ring-success/25 [&>[data-dot]]:bg-success',
        amber: 'bg-warning/10 text-warning ring-warning/25 [&>[data-dot]]:bg-warning',
        red: 'bg-destructive/10 text-destructive ring-destructive/25 [&>[data-dot]]:bg-destructive',
        blue: 'bg-info/10 text-info ring-info/25 [&>[data-dot]]:bg-info',
        purple: 'bg-gold-soft text-gold-ink ring-gold/30 [&>[data-dot]]:bg-gold-ink',
        'amber-outline': 'bg-transparent text-warning ring-warning/50 [&>[data-dot]]:bg-warning',
        'red-outline': 'bg-transparent text-destructive ring-destructive/50 [&>[data-dot]]:bg-destructive',
        dark: 'bg-primary text-primary-foreground ring-primary [&>[data-dot]]:bg-gold',
      },
    },
    defaultVariants: { tone: 'sand' },
  }
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function BadgePill({
  className,
  tone,
  dot = true,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span data-badge="" className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span data-dot="" aria-hidden />}
      {children}
    </span>
  );
}
