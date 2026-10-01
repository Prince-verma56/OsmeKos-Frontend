'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useListParams<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  const values = useMemo(() => {
    const out = { ...defaults } as Record<string, string>;
    const sp = new URLSearchParams(query);
    for (const key of Object.keys(defaults)) {
      const v = sp.get(key);
      if (v !== null) out[key] = v;
    }
    return out as T;
  }, [defaults, query]);

  const replace = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const set = useCallback(
    (patch: Partial<T>, { resetPage = true }: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(query);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      replace(next);
    },
    [defaults, query, replace]
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(query);
    for (const key of Object.keys(defaults)) next.delete(key);
    replace(next);
  }, [defaults, query, replace]);

  const apply = useCallback((saved: string) => replace(new URLSearchParams(saved)), [replace]);

  const filtered = useMemo(
    () =>
      Object.keys(defaults).some(
        (key) => !['page', 'limit', 'sortBy', 'sortOrder'].includes(key) && values[key] !== defaults[key]
      ),
    [defaults, values]
  );

  return { values, set, reset, apply, query, filtered };
}
