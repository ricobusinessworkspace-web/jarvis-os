import { type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

/**
 * Reine Hülle — **keine Datenbankabfrage.** Jede Navigation spart so die
 * Runden über den Pooler; der Inhalt lädt in den Reitern selbst.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
