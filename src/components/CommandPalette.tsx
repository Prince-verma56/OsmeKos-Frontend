'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Moon, Sun, LogOut, ShoppingBag, FileText, Users, Package, Store, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useIsMac } from '@/lib/platform';
import { NAV, QUICK_ACTIONS } from '@/lib/nav';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from './ui/command';

type Hit = { id: string; label: string; sub?: string; href: string; kind: string };

type Source = {
  kind: string;
  permission: string;
  endpoint: string;
  icon: typeof ShoppingBag;
  map: (row: Record<string, unknown>) => Hit;
};

const SOURCES: Source[] = [
  {
    kind: 'Orders',
    permission: 'orders:read',
    endpoint: '/orders',
    icon: ShoppingBag,
    map: (r) => ({
      id: String(r.id),
      label: String(r.orderNumber ?? ''),
      sub: String((r.customer as { displayName?: string } | null)?.displayName ?? (r.customerSnapshot as { displayName?: string } | null)?.displayName ?? ''),
      href: `/admin/orders/${r.id}`,
      kind: 'Orders',
    }),
  },
  {
    kind: 'Invoices',
    permission: 'invoices:read',
    endpoint: '/invoices',
    icon: FileText,
    map: (r) => ({
      id: String(r.id),
      label: String(r.invoiceNumber ?? ''),
      sub: String((r.customer as { displayName?: string } | null)?.displayName ?? ''),
      href: `/admin/invoices/${r.id}`,
      kind: 'Invoices',
    }),
  },
  {
    kind: 'Customers',
    permission: 'customers:read',
    endpoint: '/customers',
    icon: Users,
    map: (r) => ({
      id: String(r.id),
      label: String(r.displayName ?? [r.firstName, r.lastName].filter(Boolean).join(' ')),
      sub: String(r.phone ?? r.email ?? ''),
      href: `/admin/customers/${r.id}`,
      kind: 'Customers',
    }),
  },
  {
    kind: 'Products',
    permission: 'products:read',
    endpoint: '/products',
    icon: Package,
    map: (r) => ({ id: String(r.id), label: String(r.title ?? r.name ?? ''), sub: String(r.sku ?? ''), href: `/admin/products/${r.id}`, kind: 'Products' }),
  },
  {
    kind: 'Vendors',
    permission: 'vendors:read',
    endpoint: '/vendors',
    icon: Store,
    map: (r) => ({ id: String(r.id), label: String(r.displayName ?? ''), sub: String(r.gstin ?? ''), href: `/admin/vendors/${r.id}`, kind: 'Vendors' }),
  },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { can, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const isMac = useIsMac();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);

  const change = useCallback((v: boolean) => {
    if (!v) {
      setQuery('');
      setHits([]);
      setSearching(false);
    }
    onOpenChange(v);
  }, [onOpenChange]);

  const onQuery = useCallback((v: string) => {
    setQuery(v);
    const short = v.trim().length < 2;
    setSearching(!short);
    if (short) setHits([]);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const sources = SOURCES.filter((s) => can(s.permission));
      const results = await Promise.all(
        sources.map(async (s) => {
          try {
            const res = await api.get<{ data: Record<string, unknown>[] }>(s.endpoint, { search: q, limit: 5, pageSize: 5 });
            return (res.data ?? []).slice(0, 5).map(s.map);
          } catch {
            return [];
          }
        })
      );
      if (!cancelled) {
        setHits(results.flat());
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, can]);

  const go = useCallback(
    (href: string) => {
      change(false);
      router.push(href);
    },
    [change, router]
  );

  const pages = useMemo(
    () => NAV.flatMap((g) => g.items.filter((i) => !i.soon && (!i.permission || can(i.permission))).map((i) => ({ ...i, group: g.group }))),
    [can]
  );
  const actions = useMemo(() => QUICK_ACTIONS.filter((a) => can(a.permission)), [can]);
  const hitGroups = useMemo(() => {
    const m = new Map<string, Hit[]>();
    for (const h of hits) m.set(h.kind, [...(m.get(h.kind) ?? []), h]);
    return [...m.entries()];
  }, [hits]);

  return (
    <CommandDialog open={open} onOpenChange={change}>
      <CommandInput placeholder="Search orders, invoices, customers, products… or jump to a page" value={query} onValueChange={onQuery} />
      <CommandList>
        <CommandEmpty>{searching ? 'Searching…' : 'Nothing found'}</CommandEmpty>
        {hitGroups.map(([kind, rows]) => {
          const Icon = SOURCES.find((s) => s.kind === kind)?.icon ?? ArrowRight;
          return (
            <CommandGroup key={kind} heading={kind}>
              {rows.map((h) => (
                <CommandItem key={`${kind}-${h.id}`} value={`${kind} ${h.label} ${h.sub ?? ''} ${h.id}`} onSelect={() => go(h.href)}>
                  <Icon />
                  <span className="truncate">{h.label}</span>
                  {h.sub && <span className="ml-1 truncate text-xs text-muted-foreground">{h.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        <CommandGroup heading="Go to">
          {pages.map((p) => (
            <CommandItem key={p.href} value={`go ${p.group} ${p.label}`} onSelect={() => go(p.href)}>
              <p.icon />
              <span>{p.label}</span>
              {p.group && <span className="ml-1 text-xs text-muted-foreground">{p.group}</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        {actions.length > 0 && (
          <CommandGroup heading="Create">
            {actions.map((a) => (
              <CommandItem key={a.href} value={`new create ${a.label}`} onSelect={() => go(a.href)}>
                <Plus />
                <span>New {a.label.toLowerCase()}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Preferences">
          <CommandItem
            value="toggle theme dark light mode"
            onSelect={() => {
              toggle();
              change(false);
            }}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span>
            {isMac !== null && <CommandShortcut>{isMac ? '⌘ ⇧ L' : 'Ctrl Shift L'}</CommandShortcut>}
          </CommandItem>
          <CommandItem
            value="log out sign out"
            onSelect={() => {
              change(false);
              logout();
            }}
          >
            <LogOut />
            <span>Log out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
