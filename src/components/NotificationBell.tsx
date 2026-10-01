'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { api, dateTime } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './ui/popover';
import { Skeleton } from './ui/misc';

type Notification = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type Response = { data: Notification[]; meta: { unreadCount: number } };

const KEY = ['notifications', 'bell'];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<Response>('/shared/notifications', { limit: 15 }),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const markRead = useMutation({ mutationFn: (id: string) => api.post(`/shared/notifications/${id}/read`), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => api.post('/shared/notifications/read-all'), onSuccess: refresh });

  const unread = query.data?.meta.unreadCount ?? 0;
  const items = query.data?.data ?? [];

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-none text-white dark:text-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div>
            <div className="font-display text-sm font-medium tracking-wide text-foreground">Notifications</div>
            <div className="text-xs text-muted-foreground">{unread ? `${unread} unread` : 'All caught up'}</div>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {query.isLoading ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : query.isError ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Could not load notifications. They will retry in a minute.</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-gold/60 text-gold-ink">
                <BellOff className="size-4" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-foreground">Nothing new</p>
              <p className="mt-1 text-xs text-muted-foreground">Low labels, near-expiry batches and other alerts will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const body = (
                  <div className="flex gap-2.5 px-3 py-2.5">
                    <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-gold')} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm', n.readAt ? 'text-foreground/80' : 'font-medium text-foreground')}>{n.title ?? n.type}</div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                      <div className="mt-1 text-[11px] text-muted-foreground/80">{dateTime(n.createdAt)}</div>
                    </div>
                  </div>
                );
                const onOpen = () => {
                  if (!n.readAt) markRead.mutate(n.id);
                  setOpen(false);
                };
                return (
                  <li key={n.id} className="transition-colors hover:bg-muted/60">
                    {n.link ? (
                      <Link href={n.link} onClick={onOpen} className="block focus-visible:bg-muted focus-visible:outline-none">
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={onOpen} className="block w-full text-left focus-visible:bg-muted focus-visible:outline-none">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
