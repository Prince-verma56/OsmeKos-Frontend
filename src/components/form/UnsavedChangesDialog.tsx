'use client';

import { useRouter } from 'next/navigation';
import { unsaved, useLeaveGuard, useUnsavedPending } from '@/lib/unsaved';
import { ConfirmModal } from '../Modal';

export function UnsavedChangesDialog() {
  const router = useRouter();
  const pending = useUnsavedPending();
  useLeaveGuard();

  return (
    <ConfirmModal
      open={Boolean(pending)}
      onClose={() => unsaved.dismiss()}
      onConfirm={() => {
        const href = pending?.href;
        unsaved.clearAll();
        unsaved.dismiss();
        if (href) router.push(href);
      }}
      title="Leave without saving?"
      message="You have changes on this page that are not saved yet. If you leave now they will be lost."
      confirmLabel="Discard and leave"
    />
  );
}
