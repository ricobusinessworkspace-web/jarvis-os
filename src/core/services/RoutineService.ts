import { prisma } from '../db';
import { getBerlinDateStr } from '@/lib/dateUtils';

export class RoutineService {
  static async getGProjectScore() {
    try {
      const stats = await prisma.tracker_user_stats.findMany();
      return {
        stats: stats.map(s => ({
          name: s.name || s.user_id,
          points: s.my_points,
          debt: s.my_debt,
          unpaid_weekly_debt: s.unpaid_weekly_debt,
        }))
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    }
  }

  static async getTodayRoutines() {
    try {
      const today = new Date();
      const localTodayStr = getBerlinDateStr(today);

      const trackersRes = await this.getDashboardTrackers(today);
      if (trackersRes.error) throw new Error(trackersRes.error);

      const routines: Array<{ id: string; name: string; category: string; status: string }> = [];
      trackersRes.trackers?.forEach(tracker => {
        tracker.items.forEach(item => {
          // Find log for today matching the UTC date string
          // Logs liegen als UTC-Mitternacht des jeweiligen Kalendertags vor.
          const todayLog = item.logs.find(
            l => l.date.toISOString().slice(0, 10) === localTodayStr
          );

          routines.push({
            id: item.id,
            name: item.title,
            category: tracker.name,
            status: todayLog ? todayLog.status : 'not_done' // completed, not_done, skipped
          });
        });
      });

      return { routines };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    }
  }

  static async markRoutineCompleted(itemId: string) {
    try {
      const today = new Date();
      const localTodayStr = getBerlinDateStr(today);
      return await this.logTrackerItem(itemId, 'completed', localTodayStr);
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    }
  }

  static async getHealthAndSleepData() {
    try {
      const today = new Date();
      const res = await this.getPersonalLogs(today);
      if (res.error) throw new Error(res.error);

      const todayLog = res.todayLog;
      const allLogs = res.personalLogs || [];

      // Calculate 5 AM Streak
      let streak = 0;
      today.setHours(0,0,0,0);
      const currentDate = new Date(today);
      
      if (todayLog && todayLog.wakeTime) {
        const [h, m] = todayLog.wakeTime.split(':').map(Number);
        if (h < 5 || (h === 5 && m === 0)) streak++;
        else return { todaySleep: todayLog, streak: 0 };
      }

      currentDate.setDate(currentDate.getDate() - 1);
      while (true) {
        const dateStr = getBerlinDateStr(currentDate);
        const log = allLogs.find(l => String(l.date).startsWith(dateStr));
        
        if (!log || !log.wakeTime) break;
        
        const [h, m] = log.wakeTime.split(':').map(Number);
        if (h < 5 || (h === 5 && m === 0)) streak++;
        else break;
        
        currentDate.setDate(currentDate.getDate() - 1);
      }

      return { todaySleep: todayLog, streak };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    }
  }

  /**
   * Morgen- und Abendroutine eines Tages, fertig für die Dashboard-Karte.
   * Eine Rohabfrage statt eines verschachtelten `include` — Prisma löst das
   * sonst in mehrere Runden auf, und jede kostet über den Pooler spürbar.
   */
  static async getRoutineBlocks(dateStr: string) {
    const rows = await prisma.$queryRaw<
      Array<{
        tracker_id: string; tracker_name: string;
        item_id: string; title: string; sort: number; done: boolean; required: boolean;
      }>
    >`
      SELECT t.id   AS tracker_id,
             t.name AS tracker_name,
             i.id   AS item_id,
             i.title,
             i."order" AS sort,
             i.required,
             COALESCE(l.status = 'completed', FALSE) AS done
        FROM jarvis_trackers t
        JOIN jarvis_tracker_items i ON i.tracker_id = t.id
        LEFT JOIN jarvis_tracker_logs l
               ON l.item_id = i.id
              AND l.date = ${`${dateStr}T00:00:00.000Z`}::timestamp
       WHERE t.type = 'routine'
       ORDER BY t.name, i."order"
    `;

    const byTracker = new Map<string, {
      trackerId: string; name: string; kind: 'morning' | 'evening';
      items: Array<{ id: string; title: string; done: boolean; required: boolean }>;
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
        id: r.item_id, title: r.title, done: r.done, required: r.required,
      });
    }

    // Morgen vor Abend.
    return [...byTracker.values()].sort((a, b) => (a.kind === 'morning' ? -1 : 1) - (b.kind === 'morning' ? -1 : 1));
  }

  static async getDashboardTrackers(today: Date) {
    try {
      const trackers = await prisma.tracker.findMany({
        include: {
          items: {
            include: {
              logs: {
                where: {
                  date: {
                    gte: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      });
      return { trackers };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    }
  }

  static async getPersonalLogs(today: Date) {
    try {
      const todayStr = getBerlinDateStr(today);
      const cutoffStr = getBerlinDateStr(new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000));
      const personalLogs = await prisma.personalLog.findMany({
        where: {
          date: {
            gte: cutoffStr
          }
        }
      });

      let todayLog = personalLogs.find(l => l.date === todayStr);
      if (!todayLog) {
        todayLog = await prisma.personalLog.upsert({
          where: { date: todayStr },
          update: {},
          create: { date: todayStr }
        });
        personalLogs.push(todayLog);
      }
      return { personalLogs, todayLog };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
    }
  }

  static async savePersonalLog(data: {
    date: string;
    sleepHours?: number;
    bedTime?: string | null;
    wakeTime?: string | null;
    [key: string]: unknown;
  }) {
    try {
      const { date, ...rest } = data;
      
      let sleepHours = rest.sleepHours;
      let bedTime = rest.bedTime;
      let wakeTime = rest.wakeTime;
  
      const existing = await prisma.personalLog.findUnique({ where: { date } });
      
      if (bedTime === undefined) bedTime = existing?.bedTime;
      if (wakeTime === undefined) wakeTime = existing?.wakeTime;
  
      if (bedTime && wakeTime) {
        const bed = new Date(`1970-01-01T${bedTime}:00`);
        const wake = new Date(`1970-01-01T${wakeTime}:00`);
        if (!isNaN(bed.getTime()) && !isNaN(wake.getTime())) {
          if (wake < bed) wake.setDate(wake.getDate() + 1);
          sleepHours = Number(((wake.getTime() - bed.getTime()) / (1000 * 60 * 60)).toFixed(1));
        }
      } else {
        sleepHours = 0;
      }
  
      const updated = await prisma.personalLog.upsert({
        where: { date },
        update: { ...rest, sleepHours },
        create: { date, ...rest, sleepHours }
      });
  
      return { success: true, data: updated };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
    }
  }

  static async logTrackerItem(itemId: string, status: string, dateStr: string) {
    try {
      const date = new Date(`${dateStr}T00:00:00.000Z`);
      const log = await prisma.trackerLog.upsert({
        where: { itemId_date: { itemId, date } },
        update: { status, completedAt: status === 'completed' ? new Date() : null },
        create: { itemId, date, status, completedAt: status === 'completed' ? new Date() : null }
      });
      return { success: true, data: log };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
    }
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
