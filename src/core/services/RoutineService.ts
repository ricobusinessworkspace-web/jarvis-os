import { prisma } from '../db';

export class RoutineService {
  /**
   * Morgen- und Abendroutine eines Tages, fertig für die Dashboard-Karte.
   * Eine Rohabfrage statt eines verschachtelten `include` — Prisma löst das
   * sonst in mehrere Runden auf, und jede kostet über den Pooler spürbar.
   */
  static async getRoutineBlocks(dateStr: string) {
    const rows = await prisma.$queryRaw<
      Array<{
        tracker_id: string; tracker_name: string;
        item_id: string; title: string; sort: number; done: boolean;
      }>
    >`
      SELECT t.id   AS tracker_id,
             t.name AS tracker_name,
             i.id   AS item_id,
             i.title,
             i."order" AS sort,
             COALESCE(l.status = 'completed', FALSE) AS done
        FROM jarvis_trackers t
        JOIN jarvis_tracker_items i ON i.tracker_id = t.id
        LEFT JOIN jarvis_tracker_logs l
               ON l.item_id = i.id
              AND l.date = ${`${dateStr}T00:00:00.000Z`}::timestamp
       WHERE t.type = 'routine'
         -- Die Schritte, die an diesem Tag galten — im Verlauf also auch die
         -- inzwischen archivierten, und keine, die erst später dazukamen.
         AND (i.active_from IS NULL OR i.active_from <= ${dateStr}::date)
         AND (i.archived_on IS NULL OR i.archived_on >  ${dateStr}::date)
       ORDER BY t.name, i."order"
    `;

    const byTracker = new Map<string, {
      trackerId: string; name: string; kind: 'morning' | 'evening';
      items: Array<{ id: string; title: string; done: boolean }>;
    }>();

    for (const r of rows) {
      if (!byTracker.has(r.tracker_id)) {
        byTracker.set(r.tracker_id, {
          trackerId: r.tracker_id,
          name: r.tracker_name,
          kind: r.tracker_name.toLowerCase().includes('morgen') ? 'morning' : 'evening',
          items: [],
        });
      }
      byTracker.get(r.tracker_id)!.items.push({
        id: r.item_id, title: r.title, done: r.done,
      });
    }

    // Morgen vor Abend.
    return [...byTracker.values()].sort((a, b) => (a.kind === 'morning' ? -1 : 1) - (b.kind === 'morning' ? -1 : 1));
  }

  static async updateTrackerItem(id: string, data: { title?: string; icon?: string | null; order?: number }) {
    try {
      const updated = await prisma.trackerItem.update({ where: { id }, data });
      return { success: true, data: updated };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
    }
  }
}
