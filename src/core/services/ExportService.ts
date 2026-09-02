import { DashboardService } from './DashboardService';
import { CrmService } from './CrmService';

export class ExportService {
  static async generateClaudeContextMarkdown(): Promise<string> {
    try {
      const dashboardRes = await DashboardService.fetchDashboardData();
      const crmRes = await CrmService.getOverview();

      const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      let markdown = `# Jarvis OS Context Export\n`;
      markdown += `**Date:** ${today}\n\n`;
      markdown += `You are an executive AI assistant and coach. Below is the current state of my personal and business operating system. Please use this data to provide highly personalized, context-aware advice, structure my day, or analyze my performance.\n\n`;

      if (dashboardRes.success && dashboardRes.data) {
        const { trackers, tasks } = dashboardRes.data;

        // 1. CRM Metrics
        if (!crmRes.error) {
          markdown += `## 1. Business & Sales (CRM Metrics)\n`;
          markdown += `- **Total Leads:** ${crmRes.totalLeads}\n`;
          markdown += `- **Calls Today / Weekly:** ${crmRes.todayCalls} / ${crmRes.weeklyCalls}\n`;
          markdown += `- **Emails Today / Weekly:** ${crmRes.todayEmails} / ${crmRes.weeklyEmails}\n`;
          markdown += `- **Pipeline:** Entscheider (${crmRes.pipeline?.entscheider || 0}), Kontakt (${crmRes.pipeline?.kontakt || 0}), Rechnung (${crmRes.pipeline?.rechnung || 0}), Kunden (${crmRes.pipeline?.kunden || 0})\n`;
          markdown += `- **Priority Leads:** ${crmRes.prioLeads}\n\n`;
        }

        // 2. Open Tasks
        markdown += `## 2. Open Tasks\n`;
        const openTasks = tasks?.filter((t: any) => t.status !== 'done' && t.status !== 'archived') || [];
        if (openTasks.length > 0) {
          openTasks.forEach((t: any) => {
            markdown += `- [ ] ${t.title} (Priority: ${t.priority || 'Normal'})\n`;
          });
        } else {
          markdown += `- No open tasks currently.\n`;
        }
        markdown += `\n`;

        // 3. Routines & Intentions (Today's state)
        markdown += `## 3. Routines & Intentions (Today)\n`;
        const todayStr = new Date().toISOString().split('T')[0];
        
        trackers?.forEach((tracker: any) => {
          markdown += `### ${tracker.name} (${tracker.type})\n`;
          tracker.items?.forEach((item: any) => {
            const isDone = item.logs?.some((l: any) => {
              const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
              return lDate === todayStr && l.status === 'completed';
            });
            markdown += `- [${isDone ? 'x' : ' '}] ${item.title}\n`;
          });
          markdown += `\n`;
        });
      }

      markdown += `## End of Context\n`;
      return markdown;
    } catch (error: any) {
      console.error('generateClaudeContextMarkdown error:', error);
      return `Error generating context: ${error.message}`;
    }
  }
}
