import { prisma } from '../db';
import { getBerlinDateStr } from '@/lib/dateUtils';

export class PerformanceService {
  static async getPerformanceData(days: number = 14) {
    const today = new Date();
    
    // Generate dates range based on Berlin time!
    const dateRangeStr = Array.from({ length: days }).map((_, i) => {
      const d = new Date(today.getTime());
      d.setDate(d.getDate() - (days - 1 - i));
      return getBerlinDateStr(d);
    });

    const cutoffDate = new Date(today.getTime());
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Start of the day for cutoffDate in UTC so we capture everything correctly
    // Wait, since we store UTC dates, let's just use the cutoffDate as is.
    const cutoffMs = cutoffDate.getTime();
    const cutoffStr = getBerlinDateStr(cutoffDate);

    // 1. Routine
    const trackerLogs = await prisma.trackerLog.findMany({
      where: {
        date: { gte: cutoffDate },
        status: 'completed'
      }
    });
    const totalItemsCount = await prisma.trackerItem.count();
    
    const routineMap = trackerLogs.reduce((acc, log) => {
      const d = getBerlinDateStr(log.date);
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 2. Sleep Hours
    const personalLogs = await prisma.personalLog.findMany({
      where: { date: { gte: cutoffStr } }
    });
    const sleepMap = personalLogs.reduce((acc, log) => {
      acc[log.date] = log.sleepHours || 0;
      return acc;
    }, {} as Record<string, number>);

    // Merge data
    const data = dateRangeStr.map(date => {
      const completedCount = routineMap[date] || 0;
      const routinePercent = totalItemsCount > 0 ? (completedCount / totalItemsCount) * 100 : 0;
      
      return {
        date,
        routinePercent: Math.round(routinePercent),
        sleepHours: sleepMap[date] || 0
      };
    });

    return data;
  }
}
