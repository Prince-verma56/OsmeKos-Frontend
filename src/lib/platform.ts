'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};
const readIsMac = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export function useIsMac() {
  return useSyncExternalStore<boolean | null>(noopSubscribe, readIsMac, () => null);
}
