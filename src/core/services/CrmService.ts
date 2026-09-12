import { prisma } from '../db';

export class CrmService {
  /**
   * Pipeline-Stufen so, wie das CRM sie führt (`crm_leads.stage`).
   * Bewusst kein eigenes Mapping — das CRM gibt die Datenschicht vor.
   */
  static async getPipeline(userName = 'Rico') {
    try {
      return await this.loadPipeline(userName);
    } catch (error) {
      console.error('[CrmService] Pipeline nicht verfügbar:', error);
      return { stages: [], mine: 0, available: false };
    }
  }

  private static async loadPipeline(userName: string) {
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
      available: true,
    };
  }

  /**
   * Bestandszahlen aus `crm_stock_metrics` — wie es **jetzt** aussieht.
   *
   * Bewusst getrennt von den Tageskennzahlen: „wie viele Leads liegen in der
   * Kaltkartei" ist eine Frage an jetzt und hat keinen Tag, an dem sie
   * stattgefunden hat. Sie mit einem Datum zu versehen würde eine Historie
   * vortäuschen, die es nicht gibt.
   *
   * Fällt das CRM aus, kommt eine leere Map zurück — die Oberfläche zeigt dann
   * „nicht verfügbar" statt einer veralteten Zahl.
   */
  static async getStockMetrics(): Promise<Map<string, number>> {
    try {
      const rows = await prisma.$queryRaw<Array<{ metricKey: string; wert: number }>>`
        SELECT metric_key AS "metricKey", wert::float8 AS "wert"
          FROM crm_stock_metrics
      `;
      return new Map(rows.map(r => [r.metricKey, Number(r.wert)]));
    } catch (error) {
      console.error('[CrmService] Bestandszahlen nicht verfügbar:', error);
      return new Map();
    }
  }

  /**
   * Kennzahlen für den Kontext-Export.
   *
   * Calls kommen aus `crm_calls`, nicht aus `crm_events`: letztere ist leer
   * und hat hier jahrelang 0 gemeldet. Sieben Einzelabfragen sind daraus eine
   * geworden — jede kostet über den Pooler eine eigene Runde.
   */
  static async getOverview(userName = 'Rico') {
    try {
      const nowMs = Date.now();
      const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
      const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

      const rows = await prisma.$queryRaw<
        Array<{
          total_leads: number; prio_leads: number;
          entscheider: number; kontakt: number; rechnung: number; kunden: number;
        }>
      >`
        SELECT COUNT(*)::int AS total_leads,
               COUNT(*) FILTER (WHERE starred = 1 AND coalesce(status,'') <> 'Uninteressant')::int AS prio_leads,
               COUNT(*) FILTER (WHERE entscheider = 1 AND coalesce(status,'') <> 'Uninteressant')::int AS entscheider,
               COUNT(*) FILTER (WHERE termin = 1 AND coalesce(status,'') <> 'Uninteressant')::int AS kontakt,
               COUNT(*) FILTER (WHERE rechnung = 1 AND coalesce(status,'') <> 'Uninteressant')::int AS rechnung,
               COUNT(*) FILTER (WHERE status = 'Kunde')::int AS kunden
        FROM crm_leads
      `;

      const calls = await prisma.$queryRaw<Array<{ today: number; week: number }>>`
        SELECT COUNT(*) FILTER (WHERE ts >= ${dayAgoMs})::int AS today,
               COUNT(*) FILTER (WHERE ts >= ${weekAgoMs})::int AS week
        FROM crm_calls
        WHERE by_user_name = ${userName}
      `;

      const r = rows[0];
      return {
        totalLeads: Number(r?.total_leads ?? 0),
        todayCalls: Number(calls[0]?.today ?? 0),
        weeklyCalls: Number(calls[0]?.week ?? 0),
        pipeline: {
          entscheider: Number(r?.entscheider ?? 0),
          kontakt: Number(r?.kontakt ?? 0),
          rechnung: Number(r?.rechnung ?? 0),
          kunden: Number(r?.kunden ?? 0),
        },
        prioLeads: Number(r?.prio_leads ?? 0),
      };
    } catch (error) {
      console.error('[CrmService] Overview nicht verfügbar:', error);
      return { error: error instanceof Error ? error.message : 'CRM nicht erreichbar' };
    }
  }
}
