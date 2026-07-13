import { prisma } from '../db';

export class ContentService {
  static async getContentPipeline() {
    try {
      const items = await prisma.contentItem.findMany({
        where: { 
          status: { not: 'published' } // Everything not published
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      return { 
        items: items.map(i => ({ 
          id: i.id,
          title: i.title, 
          status: i.status, 
          category: i.category,
          priority: i.priority
        })) 
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
