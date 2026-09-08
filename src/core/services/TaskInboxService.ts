import { prisma } from '../db';

/**
 * Aufgaben-Eingang des Dashboards — zwei getrennte Quellen.
 *
 * `crm` sind die offenen Aufgaben an den Leads, die dir im CRM zugewiesen sind
 * (`crm_leads.claimed_by`). Sie stecken dort als JSON-Array in `task_text`.
 *
 * `reminders` kommt aus Apple Erinnerungen und ist erst befüllt, wenn der
 * iOS-Kurzbefehl läuft. Bis dahin bewusst leer statt erfunden.
 */

export interface CrmTaskItem {
  id: string;
  text: string;
  leadId: string;
  leadName: string;
  stage: string;
  deadline: string | null;
  openSubtasks: number;
}

interface RawTask {
  id?: number | string;
  text?: string;
  done?: boolean;
  deadline?: string | null;
  subtasks?: Array<{ id?: number | string; text?: string; done?: boolean }>;
}

export class TaskInboxService {
  /** UUID des Nutzers aus dem CRM-Profil — über den Namen, nicht hart verdrahtet. */
  private static async userId(name: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id FROM user_profiles WHERE name = ${name} LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  /** Offene Aufgaben an den eigenen Leads, fälligste zuerst. */
  static async getCrmTasks(userName = 'Rico', limit = 20): Promise<CrmTaskItem[]> {
    const uid = await this.userId(userName);
    if (!uid) return [];

    const leads = await prisma.$queryRaw<
      Array<{ id: string; name: string; stage: string | null; task_text: string | null }>
    >`
      SELECT id::text AS id, name, stage, task_text
      FROM crm_leads
      WHERE claimed_by = ${uid}::uuid
        AND coalesce(task_text, '') <> ''
        AND coalesce(status, '') <> 'Uninteressant'
    `;

    const out: CrmTaskItem[] = [];

    for (const lead of leads) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(lead.task_text ?? '[]');
      } catch {
        continue; // kaputtes JSON überspringen, nicht die ganze Liste verlieren
      }
      if (!Array.isArray(parsed)) continue;

      for (const raw of parsed as RawTask[]) {
        if (!raw || raw.done || !raw.text) continue;
        out.push({
          id: `${lead.id}:${raw.id ?? raw.text}`,
          text: raw.text,
          leadId: lead.id,
          leadName: lead.name,
          stage: lead.stage ?? 'cold',
          deadline: raw.deadline || null,
          openSubtasks: (raw.subtasks ?? []).filter(s => s && !s.done).length,
        });
      }
    }

    // Mit Deadline zuerst, danach die frühere Deadline.
    out.sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

    return out.slice(0, limit);
  }

  /**
   * Heute fällige Apple Erinnerungen.
   * Noch keine Quelle angebunden — liefert eine leere Liste, damit die UI
   * „noch nicht verbunden" zeigen kann statt einer erfundenen Aufgabe.
   */
  static async getReminders(): Promise<{ items: never[]; connected: boolean }> {
    return { items: [], connected: false };
  }
}
