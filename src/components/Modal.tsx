'use client';

import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { goToField, problemMessage, validateWithin } from '@/lib/validation';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { Button } from './ui';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const guardSave = (e: React.MouseEvent<HTMLDivElement>) => {
    const button = (e.target as HTMLElement).closest('button');
    if (!button || button.disabled) return;
    if (/^(cancel|close|discard|back)$/i.test((button.textContent ?? '').trim())) return;
    const firstBad = validateWithin(bodyRef.current);
    if (!firstBad) return;
    e.preventDefault();
    e.stopPropagation();
    goToField(firstBad);
    toast.error(problemMessage(bodyRef.current!, firstBad));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(width)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <DialogBody ref={bodyRef} className="max-h-[70vh]">{children}</DialogBody>
        {footer && <DialogFooter onClickCapture={guardSave}>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  busy = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {danger && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/40 text-destructive">
            <AlertTriangle className="size-4" strokeWidth={1.5} />
          </span>
        )}
        <div className="pt-1 text-sm text-muted-foreground">{message}</div>
      </div>
    </Modal>
  );
}
