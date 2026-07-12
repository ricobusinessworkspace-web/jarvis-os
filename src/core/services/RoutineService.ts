import { prisma } from '../db';

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
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async getTodayRoutines() {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);

      const items = await prisma.trackerItem.findMany({
        include: {
          tracker: true,
          logs: {
            where: { date: today }
          }
        }
      });

      const routines = items.map(item => ({
        name: item.title,
        category: item.tracker?.name || 'General',
        status: item.logs.length > 0 ? item.logs[0].status : 'pending' // 'pending', 'completed', 'skipped'
      }));

      return { routines };
    } catch (err: any) {
      return { error: err.message };
    }
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
                    gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      });
      return { trackers };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async getPersonalLogs(today: Date) {
    try {
      const todayStr = today.toISOString().split('T')[0];
      const personalLogs = await prisma.personalLog.findMany({
        where: {
          date: {
            gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async savePersonalLog(data: any) {
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
        if (wake < bed) wake.setDate(wake.getDate() + 1);
        sleepHours = Number(((wake.getTime() - bed.getTime()) / (1000 * 60 * 60)).toFixed(1));
      }
  
      const updated = await prisma.personalLog.upsert({
        where: { date },
        update: { ...rest, sleepHours },
        create: { date, ...rest, sleepHours }
      });
  
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async logTrackerItem(itemId: string, status: string, dateStr: string) {
    try {
      const date = new Date(dateStr);
      date.setHours(0,0,0,0);
      const log = await prisma.trackerLog.upsert({
        where: { itemId_date: { itemId, date } },
        update: { status, completedAt: status === 'completed' ? new Date() : null },
        create: { itemId, date, status, completedAt: status === 'completed' ? new Date() : null }
      });
      return { success: true, data: log };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async updateTrackerItem(id: string, data: any) {
    try {
      const updated = await prisma.trackerItem.update({ where: { id }, data });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
