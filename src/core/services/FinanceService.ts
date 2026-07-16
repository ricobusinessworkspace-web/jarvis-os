import { prisma } from '../db';

export class FinanceService {
  static async getNetWorthHistory() {
    try {
      const kpis = await prisma.kPI.findMany({
        where: { name: 'Net Worth' },
        orderBy: { trackedAt: 'asc' }
      });
      
      const history = kpis.map(k => ({
        id: k.id,
        value: k.value,
        target: k.target,
        date: k.trackedAt.toISOString()
      }));

      // Get the latest one for current state
      const current = history.length > 0 ? history[history.length - 1] : null;

      return { history, current };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
