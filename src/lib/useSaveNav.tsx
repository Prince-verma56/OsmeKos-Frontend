'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function useSaveNav() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [stalledHref, setStalledHref] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const begin = useCallback(() => {
    setStalledHref(null);
    setSaving(true);
  }, []);

  const fail = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaving(false);
  }, []);

  const done = useCallback(
    (href: string) => {
      router.push(href);
      timer.current = setTimeout(() => {
        setSaving(false);
        setStalledHref(href);
      }, 6000);
    },
    [router]
  );

  return { saving, stalledHref, begin, done, fail };
}

export function SaveStalled({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
      Saved — but the page is taking a while to open.{' '}
      <Link href={href} className="font-medium underline">
        Open it now
      </Link>
      . Do not save again, or you will create a second copy.
    </div>
  );
}
