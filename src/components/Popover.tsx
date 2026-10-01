'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Chevron } from './SearchSelect';
import { Icon } from './Icon';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './ui/popover';

export function Popover({
  label,
  children,
  align = 'left',
  disabled = false,
  className = '',
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (disabled) return <>{label}</>;

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-popover-trigger=""
          className={cn(
            'group -mx-1 inline-flex max-w-full items-center gap-1 rounded px-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'bg-muted',
            className
          )}
        >
          <span className="min-w-0">{label}</span>
          <Chevron open={open} className="opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align === 'right' ? 'end' : 'start'}
        collisionPadding={8}
        className="w-[300px] overflow-hidden p-0"
      >
        {children}
      </PopoverContent>
    </PopoverRoot>
  );
}

export function PopoverHead({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
      {icon && <Icon name={icon} className="size-4 text-gold-ink" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PopoverRow({ icon, children, className = '' }: { icon: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <Icon name={icon} className="mt-0.5 size-3.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PopoverBody({ children }: { children: React.ReactNode }) {
  return <div className="max-h-72 overflow-y-auto p-3">{children}</div>;
}

export function PopoverFoot({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-border px-3 py-2">{children}</div>;
}
