'use client';

import { Toaster, toast as sonner } from 'sonner';
import { useTheme } from './theme';

type Tone = 'success' | 'error' | 'info';

type Api = {
  show: (message: string, tone?: Tone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

function show(message: string, tone: Tone = 'success') {
  if (!message) return;
  if (tone === 'error') sonner.error(message);
  else if (tone === 'info') sonner(message);
  else sonner.success(message);
}

const api: Api = {
  show,
  success: (m) => show(m, 'success'),
  error: (m) => show(m, 'error'),
  info: (m) => show(m, 'info'),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <>
      {children}
      <Toaster
        theme={theme}
        position="bottom-right"
        closeButton
        duration={4000}
        toastOptions={{
          classNames: {
            toast:
              '!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-lg !font-sans',
            title: '!text-sm !font-medium',
            description: '!text-xs !text-muted-foreground',
            success: '[&_[data-icon]]:!text-success',
            error: '[&_[data-icon]]:!text-destructive',
          },
        }}
      />
    </>
  );
}

export function useToast(): Api {
  return api;
}

export const toast = api;
