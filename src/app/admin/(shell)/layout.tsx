import { AdminGate } from './gate';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
