import { prisma } from '../db';

export class CrmService {
  /**
   * Pipeline-Stufen so, wie das CRM sie führt (`crm_leads.stage`).
   * Bewusst kein eigenes Mapping — das CRM gibt die Datenschicht vor.
   */
  static async getPipeline(userName = 'Rico') {
    const rows = await prisma.$queryRaw<Array<{ stage: string | null; c: number }>>`
      SELECT stage, COUNT(*)::int AS c
      FROM crm_leads
      WHERE coalesce(status, '') <> 'Uninteressant'
      GROUP BY stage
    `;

    const count = (stage: string) => Number(rows.find(r => r.stage === stage)?.c ?? 0);

    const mineRows = await prisma.$queryRaw<Array<{ c: number }>>`
      SELECT COUNT(*)::int AS c
      FROM crm_leads l
      JOIN user_profiles u ON u.id = l.claimed_by
      WHERE u.name = ${userName} AND coalesce(l.status, '') <> 'Uninteressant'
    `;

    return {
      stages: [
        { label: 'Kaltkartei', count: count('cold'), tone: 'cold' as const },
        { label: 'pitch', count: count('pitch'), tone: 'open' as const },
        { label: 'data', count: count('data'), tone: 'open' as const },
        { label: 'offer', count: count('offer'), tone: 'open' as const },
        { label: 'closed', count: count('closed'), tone: 'won' as const },
      ],
      mine: Number(mineRows[0]?.c ?? 0),
    };
  }

  static async getOverview() {
    try {
      const nowMs = Date.now();
      const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
      const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

      const totalLeadsRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_leads`;
      const calledTodayRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='call' AND created_at_ms >= ${dayAgoMs}`;
      const calledWeekRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='call' AND created_at_ms >= ${weekAgoMs}`;
      const emailedTodayRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='email' AND created_at_ms >= ${dayAgoMs}`;
      const emailedWeekRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='email' AND created_at_ms >= ${weekAgoMs}`;
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
        todayEmails: Number(emailedTodayRow[0]?.count || 0),
        weeklyEmails: Number(emailedWeekRow[0]?.count || 0),
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
