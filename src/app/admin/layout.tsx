import type { Metadata } from 'next';
import { RootFrame } from '../root-frame';

export const metadata: Metadata = {
  title: 'OsmeKos Admin',
  description: 'OsmeKos back office',
  icons: { icon: '/favicon.svg' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RootFrame>{children}</RootFrame>;
}
