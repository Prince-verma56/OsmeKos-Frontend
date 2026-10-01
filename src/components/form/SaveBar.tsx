'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useUnsavedChanges } from '@/lib/unsaved';
import { goToField, problemMessage, validateWithin } from '@/lib/validation';
import { useToast } from '@/lib/toast';

export function SaveBar({
  children,
  className,
  dirty,
  aside,
}: {
  children: React.ReactNode;
  className?: string;
  dirty?: boolean;
  aside?: React.ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [edited, setEdited] = useState(false);
  const isDirty = dirty ?? edited;
  const toast = useToast();

  useEffect(() => {
    const bar = ref.current;
    const scope = bar?.parentElement;
    if (!bar || !scope) return;
    const onClick = (e: MouseEvent) => {
      const button = (e.target as HTMLElement | null)?.closest('button');
      if (!button || button.disabled) return;
      const label = (button.textContent ?? '').trim().toLowerCase();
      if (/^(cancel|discard|back)$/.test(label) || button.closest('a')) return;
      const firstBad = validateWithin(scope);
      if (!firstBad) return;
      e.preventDefault();
      e.stopPropagation();
      goToField(firstBad);
      toast.error(problemMessage(scope, firstBad));
    };
    bar.addEventListener('click', onClick, true);
    return () => bar.removeEventListener('click', onClick, true);
  }, [toast]);

  useUnsavedChanges(id, isDirty);

  useEffect(() => {
    if (dirty !== undefined) return;
    const scope = ref.current?.parentElement;
    if (!scope) return;
    const onEdit = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-no-dirty]')) return;
      if (ref.current?.contains(target)) return;
      setEdited(true);
    };
    scope.addEventListener('input', onEdit);
    scope.addEventListener('change', onEdit);
    scope.addEventListener('osmekos:edit', onEdit);
    return () => {
      scope.removeEventListener('input', onEdit);
      scope.removeEventListener('change', onEdit);
      scope.removeEventListener('osmekos:edit', onEdit);
    };
  }, [dirty]);

  return (
    <div
      ref={ref}
      className={cn(
        'sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
        className
      )}
    >
      {children}
      <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 text-xs" aria-live="polite">
            <span className="size-1.5 rounded-full bg-warning" aria-hidden />
            Unsaved changes
          </span>
        )}
        {aside}
      </div>
    </div>
  );
}
