'use client';

import { ThemeProvider as NextThemes, useTheme as useNextTheme } from 'next-themes';
import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'osmekos.theme';

const noop = () => () => {};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" storageKey={STORAGE_KEY} defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  const theme: 'light' | 'dark' = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return { theme, toggle, setTheme, mounted };
}
