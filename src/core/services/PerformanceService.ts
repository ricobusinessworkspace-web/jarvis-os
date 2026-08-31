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

    // 1. Routine (Split into Morning and Evening)
    const trackers = await prisma.tracker.findMany({
      include: { _count: { select: { items: true } } }
    });
    
    let totalMorning = 0;
    let totalEvening = 0;
    trackers.forEach(t => {
      const tName = t.name.toLowerCase();
      if (tName.includes('morgen')) totalMorning += t._count.items;
      else if (tName.includes('abend')) totalEvening += t._count.items;
    });

    const trackerLogs = await prisma.trackerLog.findMany({
      where: {
        date: { gte: cutoffDate },
        status: 'completed'
      },
      include: { item: { include: { tracker: true } } }
    });
    
    const morningMap: Record<string, number> = {};
    const eveningMap: Record<string, number> = {};
    
    trackerLogs.forEach(log => {
      const d = getBerlinDateStr(log.date);
      const tName = log.item.tracker.name.toLowerCase();
      if (tName.includes('morgen')) {
        morningMap[d] = (morningMap[d] || 0) + 1;
      } else if (tName.includes('abend')) {
        eveningMap[d] = (eveningMap[d] || 0) + 1;
      }
    });

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
      const mCount = morningMap[date] || 0;
      const eCount = eveningMap[date] || 0;
      
      const morningPercent = totalMorning > 0 ? (mCount / totalMorning) * 100 : 0;
      const eveningPercent = totalEvening > 0 ? (eCount / totalEvening) * 100 : 0;
      
      return {
        date,
        morningPercent: Math.round(morningPercent),
        eveningPercent: Math.round(eveningPercent),
        sleepHours: sleepMap[date] || 0
      };
    });

    return data;
  }
}
