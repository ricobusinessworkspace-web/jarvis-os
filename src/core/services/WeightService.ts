import { prisma } from '../db';

export class WeightService {
  static async getLatestEntries() {
    try {
      const items = await prisma.weightEntry.findMany({
        orderBy: { date: 'desc' },
        take: 7
      });
      return { items };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async addEntry(weight: number) {
    try {
      const entry = await prisma.weightEntry.create({
        data: {
          weight,
          date: new Date()
        }
      });
      return { entry };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
