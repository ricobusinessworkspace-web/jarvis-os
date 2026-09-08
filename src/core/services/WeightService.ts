import { prisma } from '../db';

export class WeightService {
  /** Letzte Wiegung — auch wenn sie Wochen zurückliegt. */
  static async getLatest(): Promise<{ value: number; date: string } | null> {
    const entry = await prisma.weightEntry.findFirst({ orderBy: { date: 'desc' } });
    if (!entry) return null;
    return { value: entry.weight, date: entry.date.toISOString().slice(0, 10) };
  }

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
