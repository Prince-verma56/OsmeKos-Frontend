'use client';

import { useMemo, useRef, useState } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { notifyEdited } from '@/lib/unsaved';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './ui/popover';

export type SearchOption = {
  value: string;
  label: string;
  group?: string;
  hint?: string;
  nested?: boolean;
  imageUrl?: string | null;
  tag?: string | null;
  disabled?: boolean;
};

const SEARCH_THRESHOLD = 8;

export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  emptyMessage = 'No results found',
  action,
  disabled = false,
  className = '',
  triggerClassName = '',
  clearable = false,
  onSearch,
  required = false,
  name,
  id,
  ariaLabel,
  searchable = 'auto',
  style,
}: {
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  action?: { label: string; onClick: () => void };
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  clearable?: boolean;
  onSearch?: (query: string) => void;
  required?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
  searchable?: boolean | 'auto';
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const showSearch = Boolean(onSearch) || searchable === true || (searchable === 'auto' && options.length >= SEARCH_THRESHOLD);
  const itemValue = (v: string) => (v === '' ? '__empty__' : v);

  const groups = useMemo(() => {
    const out: { group: string | undefined; items: SearchOption[] }[] = [];
    for (const opt of options) {
      const last = out[out.length - 1];
      if (last && last.group === opt.group) last.items.push(opt);
      else out.push({ group: opt.group, items: [opt] });
    }
    return out;
  }, [options]);

  function change(next: boolean) {
    if (next) {
      setQuery('');
      setHighlight(itemValue(value));
    }
    setOpen(next);
  }

  function choose(option: SearchOption) {
    if (option.disabled) return;
    if (option.value !== value) notifyEdited(rootRef.current);
    onChange(option.value);
    setOpen(false);
  }

  const isPlaceholder = !selected || selected.value === '';

  return (
    <div ref={rootRef} className={cn('relative', className)} style={style}>
      {(required || name) && (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required={required}
          value={value}
          onChange={() => {}}
          size={1}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full min-w-0 opacity-0"
        />
      )}
      <PopoverRoot open={open} onOpenChange={change}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            onKeyDown={(e) => {
              if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
                e.preventDefault();
                change(true);
              }
            }}
            aria-haspopup="listbox"
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-foreground shadow-xs transition-[border-color,box-shadow] hover:border-muted-foreground/40 focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground disabled:hover:border-input',
              open && 'border-gold ring-2 ring-gold/30',
              triggerClassName
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected && selected.imageUrl !== undefined && <Thumb url={selected.imageUrl} label={selected.label} small />}
              <span className={cn('truncate', isPlaceholder && 'text-muted-foreground')}>{selected ? selected.label : placeholder}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {clearable && selected && selected.value !== '' && !disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Clear"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    notifyEdited(rootRef.current);
                    onChange('');
                    setOpen(false);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="size-3.5" />
                </span>
              )}
              <Chevron open={open} />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={8}
          className="w-max min-w-[max(var(--radix-popover-trigger-width),11rem)] max-w-[min(26rem,calc(100vw-1rem))] overflow-hidden p-0"
        >
          <CommandPrimitive
            shouldFilter={!onSearch}
            value={highlight}
            onValueChange={setHighlight}
            loop
            filter={(v, search, keywords) => {
              const q = search.trim().toLowerCase();
              if (!q) return 1;
              return (keywords ?? []).some((k) => k.toLowerCase().includes(q)) ? 1 : 0;
            }}
          >
            {showSearch ? (
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <CommandPrimitive.Input
                  autoFocus
                  value={query}
                  onValueChange={(v) => {
                    setQuery(v);
                    onSearch?.(v);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            ) : (
              <CommandPrimitive.Input autoFocus value="" onValueChange={() => {}} className="sr-only" aria-label={ariaLabel ?? 'Options'} />
            )}
            <CommandPrimitive.List className="max-h-72 overflow-y-auto overflow-x-hidden p-1">
              <CommandPrimitive.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</CommandPrimitive.Empty>
              {groups.map(({ group, items }, gi) => (
                <CommandPrimitive.Group
                  key={`${group ?? 'ungrouped'}-${gi}`}
                  heading={group}
                  className="[&_[cmdk-group-heading]]:caps-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px]"
                >
                  {items.map((o) => {
                    const picked = o.value === value;
                    return (
                      <CommandPrimitive.Item
                        key={`${o.group ?? ''}::${o.value}`}
                        value={itemValue(o.value)}
                        keywords={[o.label, o.tag ?? '', o.hint ?? '', o.group ?? '']}
                        disabled={o.disabled}
                        onSelect={() => choose(o)}
                        data-checked={picked || undefined}
                        className={cn(
                          'flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45 data-[selected=true]:bg-muted data-[checked]:font-medium',
                          o.nested && 'pl-6',
                          o.value === '' && 'text-muted-foreground'
                        )}
                      >
                        {o.imageUrl !== undefined && <Thumb url={o.imageUrl} label={o.label} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {o.nested && <span className="mr-1 text-muted-foreground">•</span>}
                            {o.label}
                          </span>
                          {o.tag && <span className="block truncate font-mono text-[11px] text-muted-foreground">{o.tag}</span>}
                        </span>
                        {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
                        <Check className={cn('size-3.5 shrink-0 text-gold-ink', picked ? 'opacity-100' : 'opacity-0')} />
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
          {action && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium text-gold-ink transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <Plus className="size-3.5" />
              {action.label.replace(/^\+\s*/, '')}
            </button>
          )}
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}

export function Thumb({ url, label, small = false }: { url?: string | null; label: string; small?: boolean }) {
  const size = small ? 'size-5' : 'size-7';
  if (url) {
    return <img src={url} alt="" className={cn(size, 'shrink-0 rounded border border-border object-cover')} />;
  }
  return (
    <span
      className={cn(
        size,
        'flex shrink-0 items-center justify-center rounded border border-border bg-muted/60 font-display text-[11px] font-medium text-muted-foreground'
      )}
      aria-hidden="true"
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Chevron({ open = false, className = '' }: { open?: boolean; className?: string }) {
  return (
    <ChevronDown
      aria-hidden="true"
      strokeWidth={1.5}
      className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-180', className)}
    />
  );
}
