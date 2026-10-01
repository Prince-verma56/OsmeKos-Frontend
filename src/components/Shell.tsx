'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useIsMac } from '@/lib/platform';
import {
  Menu, Search, Plus, Moon, Sun, LogOut, ChevronRight, PanelLeftClose, PanelLeftOpen, ChevronDown, User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { usePageCrumb } from '@/lib/crumbs';
import { useHiddenMenu } from '@/lib/menuVisibility';
import { NAV, QUICK_ACTIONS, breadcrumbs, findNav, type NavGroup } from '@/lib/nav';
import { Monogram, Wordmark } from './Brand';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { UnsavedChangesDialog } from './form/UnsavedChangesDialog';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from './ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Avatar, AvatarFallback } from './ui/misc';

const RAIL_KEY = 'osmekos.sidebar';

const railListeners = new Set<() => void>();
const subscribeRail = (fn: () => void) => {
  railListeners.add(fn);
  return () => {
    railListeners.delete(fn);
  };
};
const readRail = () => {
  try {
    return localStorage.getItem(RAIL_KEY) === 'rail';
  } catch {
    return false;
  }
};

function useRail() {
  const rail = useSyncExternalStore(subscribeRail, readRail, () => false);
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(RAIL_KEY, rail ? 'full' : 'rail');
    } catch {}
    railListeners.forEach((fn) => fn());
  }, [rail]);
  return { rail, toggle };
}

function SidebarNav({ groups, rail, pathname }: { groups: NavGroup[]; rail: boolean; pathname: string }) {
  const activeHref = findNav(pathname)?.href;
  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4" aria-label="Main">
      {groups.map((section) => (
        <div key={section.group || 'root'} className="mb-2">
          {section.group && (
            <div className="relative h-8" aria-hidden={rail || undefined}>
              <div
                className={cn(
                  'caps-label absolute inset-x-0 bottom-1.5 truncate whitespace-nowrap px-3.5 transition-opacity duration-150',
                  rail ? 'opacity-0' : 'opacity-100 delay-75'
                )}
              >
                {section.group}
              </div>
              <div
                className={cn(
                  'absolute bottom-3 left-3.5 h-px w-5 bg-border transition-opacity duration-150',
                  rail ? 'opacity-100 delay-75' : 'opacity-0'
                )}
              />
            </div>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === activeHref;
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-md px-3.5 py-1.75 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-card font-medium text-foreground shadow-xs'
                      : 'text-sidebar-foreground/75 hover:bg-card/60 hover:text-foreground'
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" />}
                  <item.icon
                    strokeWidth={1.5}
                    className={cn('size-4 shrink-0 transition-colors', active ? 'text-gold-ink' : 'text-muted-foreground group-hover:text-foreground')}
                  />
                  <span
                    className={cn(
                      'truncate transition-opacity duration-150',
                      rail ? 'pointer-events-none opacity-0' : 'opacity-100 delay-75'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
              return (
                <li key={item.href}>
                  {rail ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const pageLabel = usePageCrumb(pathname);
  const crumbs = breadcrumbs(pathname);
  const tail = crumbs[crumbs.length - 1];
  if (pageLabel && tail && !tail.href) tail.label = pageLabel;
  if (crumbs.length === 0) return <span className="font-display text-sm tracking-wide text-foreground">Dashboard</span>;
  return (
    <ol className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <li key={i} className={cn('min-w-0 items-center gap-1', last ? 'flex' : 'hidden sm:flex')}>
            {i > 0 && <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground/60', last && 'hidden sm:block')} aria-hidden />}
            {c.href && !last ? (
              <Link href={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={cn('truncate', last ? 'font-medium text-foreground' : 'text-muted-foreground')}>{c.label}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout, can } = useAuth();
  const { theme, toggle: toggleTheme, mounted } = useTheme();
  const { rail, toggle: toggleRail } = useRail();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMac = useIsMac();

  useEffect(() => {
    const t = setTimeout(() => setNavOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTheme]);

  const hidden = useHiddenMenu();
  const groups = useMemo(
    () =>
      NAV.map((g) => ({
        ...g,
        items: g.items.filter(
          (i) => !i.soon && !hidden.includes(i.href) && (!i.permission || can(i.permission))
        ),
      })).filter((g) => g.items.length > 0),
    [can, hidden]
  );
  const actions = useMemo(
    () => QUICK_ACTIONS.filter((a) => can(a.permission) && !hidden.includes(a.href)),
    [can, hidden]
  );
  const actionGroups = useMemo(() => {
    const m = new Map<string, typeof actions>();
    for (const a of actions) m.set(a.group, [...(m.get(a.group) ?? []), a]);
    return [...m.entries()];
  }, [actions]);

  const initials = (admin?.name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center overflow-hidden whitespace-nowrap border-b border-border/70 px-5">
        <Link
          href="/admin"
          aria-label="Dashboard"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Monogram className="h-6 w-auto shrink-0 text-foreground" />
          <span className={cn('transition-opacity duration-150', rail && !mobile ? 'opacity-0' : 'opacity-100 delay-75')}>
            <Wordmark size="sm" />
          </span>
        </Link>
      </div>
      <div
        className={cn(
          'caps-label overflow-hidden whitespace-nowrap px-5 pb-1 pt-3 text-[10px] transition-opacity duration-150',
          rail && !mobile ? 'opacity-0' : 'opacity-100 delay-75'
        )}
        aria-hidden={(rail && !mobile) || undefined}
      >
        Skincare essentials
      </div>
      <SidebarNav groups={groups} rail={rail && !mobile} pathname={pathname} />
      {!mobile && (
        <div className="flex shrink-0 justify-start border-t border-border/70 px-4 py-2">
          <Button variant="ghost" size="icon-sm" onClick={toggleRail} aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}>
            {rail ? <PanelLeftOpen strokeWidth={1.5} /> : <PanelLeftClose strokeWidth={1.5} />}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-border/70 transition-[width] duration-200 ease-out will-change-[width] motion-reduce:transition-none lg:block',
              rail ? 'w-16' : 'w-64'
            )}
          >
            {sidebar(false)}
          </aside>
          <SheetContent side="left" className="w-72 p-0" hideClose>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Move between areas of the admin</SheetDescription>
            {sidebar(true)}
          </SheetContent>

          <div className={cn('flex min-h-screen flex-col transition-[padding] duration-0', rail ? 'delay-200 lg:pl-16' : 'lg:pl-64')}>
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-md sm:px-5">
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
                  <Menu strokeWidth={1.5} />
                </Button>
              </SheetTrigger>

              <div className="min-w-0 flex-1">
                <Breadcrumbs pathname={pathname} />
              </div>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground shadow-xs transition-colors hover:border-muted-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex xl:w-72"
                aria-label="Open command palette"
              >
                <Search className="size-3.5" strokeWidth={1.5} />
                <span className="flex-1 text-left">Search or jump to…</span>
                {isMac !== null && (
                  <kbd className="rounded border border-border bg-muted px-1 font-sans text-[10px] text-muted-foreground">
                    {isMac ? '⌘K' : 'Ctrl K'}
                  </kbd>
                )}
              </button>
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
                <Search strokeWidth={1.5} />
              </Button>

              {actionGroups.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="primary" size="sm" className="gap-1">
                      <Plus className="size-3.5" />
                      <span className="hidden sm:inline">New</span>
                      <ChevronDown className="size-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
                    {actionGroups.map(([group, items], gi) => (
                      <DropdownMenuGroup key={group}>
                        {gi > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel>{group}</DropdownMenuLabel>
                        {items.map((a) => (
                          <DropdownMenuItem key={a.href} asChild>
                            <Link href={a.href}>
                              <a.icon strokeWidth={1.5} />
                              {a.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <NotificationBell />

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              >
                {mounted && theme === 'dark' ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-1 flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Account menu"
                  >
                    <Avatar>
                      <AvatarFallback>{initials || <User className="size-4" />}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <div className="truncate text-sm font-medium text-foreground">{admin?.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{admin?.email}</div>
                    <div className="mt-1 caps-label text-[10px]">{admin?.role?.name ?? 'No role'}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={toggleTheme}>
                    {theme === 'dark' ? <Sun /> : <Moon />}
                    {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => logout()}>
                    <LogOut />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>

            <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              <div className="mx-auto w-full max-w-350">
                <Suspense fallback={null}>{children}</Suspense>
              </div>
            </main>
          </div>
        </Sheet>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <UnsavedChangesDialog />
      </div>
    </TooltipProvider>
  );
}
