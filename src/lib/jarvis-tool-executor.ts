import { prisma } from '@/lib/prisma';
import { getCrmMetrics } from '@/actions/dashboard';

export async function executeJarvisTool(toolCall: any): Promise<any> {
  const { name, args } = toolCall;
  
  try {
    switch (name) {
      case 'getCrmOverview': {
        const metrics = await getCrmMetrics();
        return metrics.data || { error: 'Could not fetch CRM metrics' };
      }

      case 'getGProjectScore': {
        // G Project tracker_user_stats
        // We assume Rico's user ID is known, but for now we fetch the first one or a specific one if there are only 2
        const stats = await prisma.tracker_user_stats.findMany();
        return {
          stats: stats.map(s => ({
            name: s.name || s.user_id,
            points: s.my_points,
            debt: s.my_debt,
            unpaid_weekly_debt: s.unpaid_weekly_debt
          }))
        };
      }

      case 'getTasks': {
        const tasks = await prisma.task.findMany({
          where: { status: 'todo' },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
        return { tasks };
      }

      case 'readMemory': {
        const profile = await prisma.knowledgeItem.findFirst({
          where: { type: 'profile', title: 'Jarvis Memory' }
        });
        
        if (!profile) {
          return { facts: [] };
        }
        
        try {
          return { facts: JSON.parse(profile.content) };
        } catch {
          return { facts: [profile.content] };
        }
      }

      case 'updateMemory': {
        const { facts } = args as { facts: string[] };
        
        if (!facts || facts.length === 0) return { success: true, message: 'No new facts provided.' };

        // Fetch existing
        let profile = await prisma.knowledgeItem.findFirst({
          where: { type: 'profile', title: 'Jarvis Memory' }
        });

        let currentFacts: string[] = [];
        if (profile) {
          try {
            currentFacts = JSON.parse(profile.content);
          } catch {
            currentFacts = [profile.content];
          }
        }

        // Add new facts (avoid duplicates)
        const newFacts = [...new Set([...currentFacts, ...facts])];

        if (profile) {
          await prisma.knowledgeItem.update({
            where: { id: profile.id },
            data: { content: JSON.stringify(newFacts) }
          });
        } else {
          await prisma.knowledgeItem.create({
            data: {
              title: 'Jarvis Memory',
              type: 'profile',
              content: JSON.stringify(newFacts)
            }
          });
        }

        return { success: true, message: 'Memory updated successfully', currentFacts: newFacts };
      }

      default:
        return { error: `Tool ${name} not implemented in executor.` };
    }
  } catch (err: any) {
    console.error(`[ToolExecutor] Error executing ${name}:`, err);
    return { error: err.message };
  }
}
