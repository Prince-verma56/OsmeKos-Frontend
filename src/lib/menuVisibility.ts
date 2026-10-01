'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export const MENU_SCOPE = 'navigation';
export const MENU_KEY = 'hidden';

let cache: Promise<string[]> | null = null;
const listeners = new Set<(hidden: string[]) => void>();

export function loadHiddenMenu(refresh = false) {
  if (!cache || refresh) {
    cache = api
      .get<{ data: { key: string; value: unknown }[] }>('/shared/settings', { scope: MENU_SCOPE })
      .then((res) => {
        const value = res.data.find((s) => s.key === MENU_KEY)?.value;
        return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
      })
      .catch(() => [] as string[]);
  }
  return cache;
}

export async function saveHiddenMenu(hidden: string[]) {
  await api.put('/shared/settings', {
    scope: MENU_SCOPE,
    key: MENU_KEY,
    value: hidden,
    description: 'Menu entries hidden from the sidebar',
  });
  cache = Promise.resolve(hidden);
  listeners.forEach((fn) => fn(hidden));
}

export function useHiddenMenu() {
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    let dropped = false;
    loadHiddenMenu().then((saved) => {
      if (!dropped) setHidden(saved);
    });
    const listener = (next: string[]) => setHidden(next);
    listeners.add(listener);
    return () => {
      dropped = true;
      listeners.delete(listener);
    };
  }, []);

  return hidden;
}
