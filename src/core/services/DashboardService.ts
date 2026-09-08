import { prisma } from '@/lib/prisma';

/**
 * Daten für den Zustand-Store, den das Dashboard-Layout hydratisiert.
 *
 * Bewusst schmal: nur was tatsächlich noch aus dem Store gelesen wird
 * (Content-Kanban und die Einstellungen). Vorher lud diese Funktion
 * zusätzlich alle Tracker mit 31 Tagen Logs, alle Tasks und alle
 * Personal Logs — sieben Abfragen, die niemand mehr auswertete und die
 * bei jeder Layout-Revalidierung erneut liefen.
 *
 * Alles Tages- und Metrikbezogene holt sich der AnalyticsService selbst.
 */
export const DashboardService = {
  async fetchDashboardData() {
    try {
      // Nacheinander: der Supabase-Pooler gibt pro Instanz eine Verbindung.
      const contentItems = await prisma.contentItem.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const settingsRecords = await prisma.setting.findMany();
      const settings = settingsRecords.reduce((acc, curr) => {
        acc[curr.key] = curr.value || '';
        return acc;
      }, {} as Record<string, string>);

      return { success: true, data: { contentItems, settings } };
    } catch (error) {
      console.error('fetchDashboardData error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
    }
  },
};
