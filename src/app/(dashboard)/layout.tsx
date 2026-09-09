import { type ReactNode } from 'react';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { DashboardShell } from '@/components/layout/DashboardShell';

/**
 * Reine Hülle — **keine Datenbankabfrage.**
 *
 * Hier hing vorher ein Zustand-Store, den das Layout bei jeder Revalidierung
 * neu befüllte. Gelesen hat ihn zuletzt nur noch das Content-Kanban und die
 * tote Suchleiste; beide sind weg, der Store damit auch. Jede Navigation spart
 * so zwei Abfragen über den Pooler.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
