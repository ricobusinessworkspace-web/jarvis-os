import { prisma } from '../db';

export class CrmService {
  static async getOverview() {
    try {
      const nowMs = Date.now();
      const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
      const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

      const totalLeadsRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_leads`;
      const calledTodayRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='call' AND created_at_ms >= ${dayAgoMs}`;
      const calledWeekRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='call' AND created_at_ms >= ${weekAgoMs}`;
      const pipelineRow: any[] = await prisma.$queryRaw`
        SELECT 
          COUNT(CASE WHEN entscheider = 1 THEN 1 END)::int as entscheider,
          COUNT(CASE WHEN termin = 1 THEN 1 END)::int as kontakt,
          COUNT(CASE WHEN rechnung = 1 THEN 1 END)::int as rechnung,
          COUNT(CASE WHEN status = 'Kunde' THEN 1 END)::int as kunden
        FROM crm_leads WHERE status != 'Uninteressant'
      `;
      const prioRow: any[] = await prisma.$queryRaw`SELECT COUNT(CASE WHEN starred = 1 THEN 1 END)::int as count FROM crm_leads WHERE status != 'Uninteressant'`;

      return {
        totalLeads: Number(totalLeadsRow[0]?.count || 0),
        todayCalls: Number(calledTodayRow[0]?.count || 0),
        weeklyCalls: Number(calledWeekRow[0]?.count || 0),
        pipeline: {
          entscheider: Number(pipelineRow[0]?.entscheider || 0),
          kontakt: Number(pipelineRow[0]?.kontakt || 0),
          rechnung: Number(pipelineRow[0]?.rechnung || 0),
          kunden: Number(pipelineRow[0]?.kunden || 0),
        },
        prioLeads: Number(prioRow[0]?.count || 0),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
