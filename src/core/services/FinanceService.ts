import { prisma } from '../db';

export class FinanceService {
  static async getNetWorthData() {
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

      const current = history.length > 0 ? history[history.length - 1] : null;

      const txRecords = await prisma.transaction.findMany({
        orderBy: { date: 'desc' },
        take: 50 // Show recent 50
      });

      const transactions = txRecords.map(tx => ({
        ...tx,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString()
      }));

      return { history, current, transactions };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
