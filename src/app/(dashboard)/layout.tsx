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
/**
 * Die Uhrzeit wird **hier** gebildet, nicht erst nach der Hydration.
 *
 * Vorher hing sie in der TopBar hinter `now && …` und erschien erst, wenn
 * React übernommen hatte — rechts oben blieb eine Lücke, dann sprang das Datum
 * hinein und schob den ⌘K-Knopf zur Seite. Genau in dem Moment hebt sich die
 * Startsequenz, der Ruckler fiel also besonders auf.
 *
 * Server und Browser formatieren beide mit `de-DE` und `Europe/Berlin`, die
 * Zeichenketten stimmen deshalb überein — es gibt nichts zu meckern für React.
 * Springt die Minute zwischen Auslieferung und Hydration um, rendert der
 * Browser trotzdem zuerst diesen Wert und korrigiert danach im Effekt.
 */
function berlinClock(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  });
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShell initialClock={berlinClock()}>{children}</DashboardShell>
    </SidebarProvider>
  );
}
