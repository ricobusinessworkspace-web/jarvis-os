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

      // Fetch Target Setting
      const targetSetting = await prisma.setting.findUnique({ where: { key: 'net_worth_target' } });
      if (current && targetSetting?.value) {
        current.target = parseFloat(targetSetting.value);
      }

      // Fetch Buckets
      const bucketSetting = await prisma.setting.findUnique({ where: { key: 'finance_buckets' } });
      const buckets = bucketSetting?.value ? JSON.parse(bucketSetting.value) : { liquid: 0, depot: 0, assets: 0, debt: 0 };

      // Fetch Pipeline
      const txRecords = await prisma.transaction.findMany({
        where: { status: 'pending' },
        orderBy: { date: 'asc' } // Earliest first
      });

      const pipeline = txRecords.map(tx => ({
        ...tx,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString()
      }));

      return { history, current, buckets, pipeline };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
