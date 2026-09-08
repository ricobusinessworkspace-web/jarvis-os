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

/** Name → UUID ändert sich praktisch nie, also einmal pro Instanz nachschlagen. */
const userIdCache = new Map<string, string | null>();

export class TaskInboxService {
  /** UUID des Nutzers aus dem CRM-Profil — über den Namen, nicht hart verdrahtet. */
  private static async userId(name: string): Promise<string | null> {
    if (userIdCache.has(name)) return userIdCache.get(name) ?? null;
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id FROM user_profiles WHERE name = ${name} LIMIT 1
    `;
    const id = rows[0]?.id ?? null;
    userIdCache.set(name, id);
    return id;
  }

  /**
   * Offene Aufgaben an den eigenen Leads, fälligste zuerst.
   * Fällt das CRM aus, bleibt die Spalte leer statt die Seite zu kippen —
   * es ist eine fremde Anwendung, auf die wir nur lesend zugreifen.
   */
  static async getCrmTasks(userName = 'Rico', limit = 20): Promise<CrmTaskItem[]> {
    try {
      return await this.loadCrmTasks(userName, limit);
    } catch (error) {
      console.error('[TaskInboxService] CRM nicht verfügbar:', error);
      return [];
    }
  }

  private static async loadCrmTasks(userName: string, limit: number): Promise<CrmTaskItem[]> {
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
    // Status und Liste in einem Round-Trip — jede Prisma-Abfrage kostet über
    // den pgbouncer mehrere hundert Millisekunden.
    const rows = await prisma.$queryRaw<
      Array<{
        id: string | null; title: string | null; list_name: string | null;
        due_at: Date | null; due_date: string | null; synced_at: Date | null;
      }>
    >`
      SELECT r.id, r.title, r.list_name, r.due_at, r.due_date, s.synced_at
        FROM ingest_status s
        LEFT JOIN ingest_reminders r
               ON r.completed = FALSE
              AND (r.due_date IS NULL OR r.due_date <= ${today})
       WHERE s.source = 'reminders'
       ORDER BY r.due_date ASC NULLS LAST, r.priority DESC
       LIMIT 20
    `;

    const status = rows.length > 0 ? { syncedAt: rows[0].synced_at } : null;

    return {
      connected: status !== null,
      syncedAt: status?.syncedAt ?? null,
      // Der LEFT JOIN liefert eine Zeile ohne Erinnerung, wenn der Kurzbefehl
      // zwar lief, aber nichts offen ist — die wird hier herausgefiltert.
      items: rows
        .filter(r => r.id !== null)
        .map(r => ({
          id: r.id!,
          title: r.title ?? '',
          listName: r.list_name ?? '',
          dueDate: r.due_date,
          dueTime: r.due_at
            ? r.due_at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
            : null,
          overdue: r.due_date !== null && r.due_date < today,
        })),
    };
  }
}
