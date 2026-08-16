import { prisma } from '@/lib/prisma';

export const DashboardService = {
  async fetchDashboardData() {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      let trackers = await prisma.tracker.findMany({
        include: {
          items: {
            include: {
              logs: {
                where: {
                  date: {
                    gte: new Date(today.getTime() - 31 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      });

      // Auto-seed Ursachen Tracker if missing
      if (!trackers.some(t => t.type === 'intentions' || t.name === 'Ursachen')) {
        const newTracker = await prisma.tracker.create({
          data: {
            name: 'Ursachen',
            type: 'intentions',
            description: 'Tägliche Grundsatz-Ziele',
            items: {
              create: [
                { title: 'Fokus-Arbeit', order: 1 },
                { title: 'Sport / Bewegung', order: 2 },
                { title: 'Gesunde Ernährung', order: 3 },
              ]
            }
          },
          include: { items: { include: { logs: true } } }
        });
        trackers.push(newTracker);
      }

      const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        include: { project: true, goal: true }
      });

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

      const contentItems = await prisma.contentItem.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const settingsRecords = await prisma.setting.findMany();
      const settings = settingsRecords.reduce((acc, curr) => {
        acc[curr.key] = curr.value || '';
        return acc;
      }, {} as Record<string, string>);

      return { success: true, data: { trackers, tasks, personalLogs, todayLog, contentItems, settings } };
    } catch (error: any) {
      console.error('fetchDashboardData error:', error);
      return { success: false, error: error.message };
    }
  }
};
