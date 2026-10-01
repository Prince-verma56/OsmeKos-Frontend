'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

type Crumb = { path: string; label: React.ReactNode } | null;

let current: Crumb = null;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const set = (next: Crumb) => {
  current = next;
  listeners.forEach((fn) => fn());
};

export function usePageCrumb(pathname: string): React.ReactNode | null {
  const crumb = useSyncExternalStore(subscribe, () => current, () => null);
  return crumb && crumb.path === pathname ? crumb.label : null;
}

export function PageCrumb({ label }: { label: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    set({ path: pathname, label });
  }, [pathname, label]);
  useEffect(
    () => () => {
      if (current?.path === pathname) set(null);
    },
    [pathname]
  );
  return null;
}
