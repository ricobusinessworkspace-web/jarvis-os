import { prisma } from '../db';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Aufgaben-Eingang des Dashboards — zwei getrennte Quellen.
 *
 * `crm` sind die offenen Aufgaben an den Leads, die dir im CRM zugewiesen sind
 * (`crm_leads.claimed_by`). Sie stecken dort als JSON-Array in `task_text`.
 *
 * `reminders` kommt aus Apple Erinnerungen und ist erst befüllt, wenn der
 * iOS-Kurzbefehl läuft. Bis dahin bewusst leer statt erfunden.
 */

export interface ReminderItem {
  id: string;
  title: string;
  listName: string;
  dueDate: string | null;
  dueTime: string | null;
  overdue: boolean;
}

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
   * Heute fällige Apple Erinnerungen aus dem Kurzbefehl-Cache.
   *
   * `connected` sagt, ob je ein Kurzbefehl geliefert hat. Ohne das kann die UI
   * eine leere Liste nicht deuten — „nichts zu tun" und „nicht verbunden"
   * sehen sonst gleich aus.
   */
  static async getReminders(today = getBerlinDateStr()): Promise<{
    items: ReminderItem[];
    connected: boolean;
    syncedAt: Date | null;
  }> {
    const [status, rows] = await Promise.all([
      prisma.ingestStatus.findUnique({ where: { source: 'reminders' } }),
      prisma.ingestReminder.findMany({
        where: {
          completed: false,
          // Heute fällig oder überfällig; Erinnerungen ohne Datum immer zeigen.
          OR: [{ dueDate: { lte: today } }, { dueDate: null }],
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        take: 20,
      }),
    ]);

    return {
      connected: status !== null,
      syncedAt: status?.syncedAt ?? null,
      items: rows.map(r => ({
        id: r.id,
        title: r.title,
        listName: r.listName,
        dueDate: r.dueDate,
        dueTime: r.dueAt
          ? r.dueAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
          : null,
        overdue: r.dueDate !== null && r.dueDate < today,
      })),
    };
  }
}
