import { prisma } from '../db';

export class MemoryService {
  static async readMemory() {
    try {
      const profile = await prisma.knowledgeItem.findFirst({
        where: { type: 'profile', title: 'Jarvis Memory' }
      });
      if (!profile) return { facts: [] };
      try { return { facts: JSON.parse(profile.content) }; }
      catch { return { facts: [profile.content] }; }
    } catch (err: any) {
      return { error: err.message };
    }
  }

  static async updateMemory(facts: string[]) {
    try {
      if (!facts || facts.length === 0) return { success: true, message: 'No new facts.' };

      let profile = await prisma.knowledgeItem.findFirst({
        where: { type: 'profile', title: 'Jarvis Memory' }
      });

      let currentFacts: string[] = [];
      if (profile) {
        try { currentFacts = JSON.parse(profile.content); } catch { currentFacts = [profile.content]; }
      }

      const newFacts = [...new Set([...currentFacts, ...facts])];

      if (profile) {
        await prisma.knowledgeItem.update({ where: { id: profile.id }, data: { content: JSON.stringify(newFacts) } });
      } else {
        await prisma.knowledgeItem.create({ data: { title: 'Jarvis Memory', type: 'profile', content: JSON.stringify(newFacts) } });
      }

      return { success: true, currentFacts: newFacts };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
