'use client';

import { useEffect, useSyncExternalStore } from 'react';

type Pending = { href: string } | null;

const dirty = new Set<string>();
let pending: Pending = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

export const unsaved = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  isDirty: () => dirty.size > 0,
  mark(id: string, isDirty: boolean) {
    const had = dirty.has(id);
    if (isDirty) dirty.add(id);
    else dirty.delete(id);
    if (had !== isDirty) emit();
  },
  clearAll() {
    if (dirty.size === 0) return;
    dirty.clear();
    emit();
  },
  pending: () => pending,
  ask(href: string) {
    pending = { href };
    emit();
  },
  dismiss() {
    pending = null;
    emit();
  },
};

export function useUnsavedPending() {
  return useSyncExternalStore(unsaved.subscribe, unsaved.pending, () => null);
}

export function useAnyUnsaved() {
  return useSyncExternalStore(unsaved.subscribe, unsaved.isDirty, () => false);
}

export function useUnsavedChanges(id: string, isDirty: boolean) {
  useEffect(() => {
    unsaved.mark(id, isDirty);
  }, [id, isDirty]);

  useEffect(() => () => unsaved.mark(id, false), [id]);
}

export function useLeaveGuard() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsaved.isDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      if (!unsaved.isDirty() || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (anchor.closest('[data-leave-ok]')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      unsaved.ask(url.pathname + url.search + url.hash);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
}

export function notifyEdited(el: Element | null) {
  el?.dispatchEvent(new Event('osmekos:edit', { bubbles: true }));
}
