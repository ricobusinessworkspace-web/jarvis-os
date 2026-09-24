import { prisma } from '../db';
import { TaskInboxService } from './TaskInboxService';
import { CrmService } from './CrmService';
import type { MailContext } from '@/lib/mailTemplate';

/**
 * Anschreiben an Leads.
 *
 * **Die Warteschlange ist abgeleitet, nicht gespiegelt.** Was ansteht, steht im
 * CRM — als ganz normale Aufgabe am Lead, deren Text mit „Mail" beginnt. Jarvis
 * legt dafür keine eigene Liste an, die auseinanderlaufen könnte; es liest die
 * Aufgaben und hält nur das fest, was das CRM nicht kennt: den Entwurf.
 *
 * Damit muss im CRM nichts gebaut werden, und ein im CRM abgehakter Punkt
 * verschwindet hier von selbst.
 */

/** „Mail: Angebot nachreichen" → Rest wird zum Thema. */
const MAIL_MARKER = /^\s*(e-?mail|mail)\s*[:\-–]?\s*/i;

export interface QueueItem {
  /** Schlüssel der CRM-Aufgabe (`<leadId>:<taskId>`) — die Identität des Vorgangs. */
  taskKey: string;
  leadId: string;
  leadName: string;
  stage: string;
  deadline: string | null;
  /** Der Aufgabentext ohne das „Mail:"-Präfix. */
  auftrag: string;

  /** Aus dem CRM-Lead, für die Platzhalter. */
  toEmail: string;
  ansprechpartner: string;
  firma: string;
  ort: string;

  /** Der Entwurf, falls schon einer existiert. */
  draft: DraftView | null;
}

export interface DraftView {
  id: string;
  leadId: string;
  taskKey: string | null;
  templateId: string | null;
  toEmail: string;
  subject: string;
  body: string;
  gespraechAm: string | null;
  gesprochenMit: string;
  thema: string;
  status: 'offen' | 'entwurf' | 'freigegeben' | 'gesendet';
  updatedAt: string;
}

export interface TemplateView {
  id: string;
  name: string;
  subject: string;
  body: string;
  guidance: string;
  sortOrder: number;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function toDraftView(d: {
  id: string; leadId: bigint; taskKey: string | null; templateId: string | null;
  toEmail: string; subject: string; body: string; gespraechAm: Date | null;
  gesprochenMit: string; thema: string; status: string; updatedAt: Date;
}): DraftView {
  return {
    id: d.id,
    leadId: d.leadId.toString(),
    taskKey: d.taskKey,
    templateId: d.templateId,
    toEmail: d.toEmail,
    subject: d.subject,
    body: d.body,
    gespraechAm: iso(d.gespraechAm),
    gesprochenMit: d.gesprochenMit,
    thema: d.thema,
    status: d.status as DraftView['status'],
    updatedAt: d.updatedAt.toISOString(),
  };
}

export class MailService {
  // ── Vorlagen ────────────────────────────────────────────────────────────

  static async listTemplates(): Promise<TemplateView[]> {
    const rows = await prisma.mailTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(r => ({
      id: r.id, name: r.name, subject: r.subject,
      body: r.body, guidance: r.guidance, sortOrder: r.sortOrder,
    }));
  }

  // ── Warteschlange ───────────────────────────────────────────────────────

  /**
   * Was heute an Mails ansteht: offene CRM-Aufgaben, die mit „Mail" beginnen,
   * angereichert um die Lead-Daten und den Entwurf, falls es schon einen gibt.
   *
   * Fällt das CRM aus, liefert `getCrmTasks` eine leere Liste — dann ist die
   * Warteschlange leer, statt dass die Seite kippt. Bereits begonnene Entwürfe
   * gehen dabei nicht verloren, sie hängen an `mail_drafts`.
   */
  static async getQueue(userName = 'Rico'): Promise<QueueItem[]> {
    const tasks = (await TaskInboxService.getCrmTasks(userName, 100))
      .filter(t => MAIL_MARKER.test(t.text));

    if (tasks.length === 0) return [];

    const leads = await CrmService.getLeadsForMail(tasks.map(t => t.leadId));
    const drafts = await prisma.mailDraft.findMany({
      where: { taskKey: { in: tasks.map(t => t.id) } },
    });
    const byTask = new Map(drafts.map(d => [d.taskKey!, toDraftView(d)]));

    return tasks.map(t => {
      const lead = leads.get(t.leadId);
      return {
        taskKey: t.id,
        leadId: t.leadId,
        leadName: t.leadName,
        stage: t.stage,
        deadline: t.deadline,
        auftrag: t.text.replace(MAIL_MARKER, '').trim(),
        toEmail: lead?.email ?? '',
        ansprechpartner: lead?.ansprechpartner ?? '',
        firma: lead?.firma ?? '',
        ort: lead?.ort ?? '',
        draft: byTask.get(t.id) ?? null,
      };
    });
  }

  /** Entwürfe, deren CRM-Aufgabe schon abgehakt ist, aber die noch offen sind. */
  static async getLooseDrafts(activeTaskKeys: string[]): Promise<DraftView[]> {
    const rows = await prisma.mailDraft.findMany({
      where: {
        status: { not: 'gesendet' },
        OR: [
          { taskKey: null },
          { taskKey: { notIn: activeTaskKeys.length ? activeTaskKeys : ['—'] } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toDraftView);
  }

  // ── Entwürfe ────────────────────────────────────────────────────────────

  /**
   * Holt den Entwurf zu einer CRM-Aufgabe oder legt ihn an. Der Kontext, den
   * das CRM schon kennt (Adresse, Thema aus dem Aufgabentext), wird dabei
   * vorbelegt — aber nur beim Anlegen. Ein späterer Aufruf überschreibt nichts,
   * was Rico von Hand geändert hat.
   */
  static async openDraft(item: {
    taskKey: string; leadId: string; toEmail: string; auftrag: string;
  }): Promise<DraftView> {
    const existing = await prisma.mailDraft.findUnique({ where: { taskKey: item.taskKey } });
    if (existing) return toDraftView(existing);

    const created = await prisma.mailDraft.create({
      data: {
        leadId: BigInt(item.leadId),
        taskKey: item.taskKey,
        toEmail: item.toEmail,
        thema: item.auftrag,
        status: 'offen',
      },
    });
    return toDraftView(created);
  }

  static async updateDraft(id: string, patch: {
    templateId?: string | null;
    toEmail?: string;
    subject?: string;
    body?: string;
    gespraechAm?: string | null;
    gesprochenMit?: string;
    thema?: string;
  }): Promise<DraftView> {
    const row = await prisma.mailDraft.update({
      where: { id },
      data: {
        ...(patch.templateId !== undefined && { templateId: patch.templateId }),
        ...(patch.toEmail !== undefined && { toEmail: patch.toEmail }),
        ...(patch.subject !== undefined && { subject: patch.subject }),
        ...(patch.body !== undefined && { body: patch.body }),
        ...(patch.gespraechAm !== undefined && {
          gespraechAm: patch.gespraechAm ? new Date(`${patch.gespraechAm}T12:00:00Z`) : null,
        }),
        ...(patch.gesprochenMit !== undefined && { gesprochenMit: patch.gesprochenMit }),
        ...(patch.thema !== undefined && { thema: patch.thema }),
      },
    });
    return toDraftView(row);
  }

  /**
   * Zustandswechsel. `freigegeben` verlangt einen Text — ohne Betreff und Text
   * gibt es nichts freizugeben, und ein leerer „freigegebener" Entwurf wäre
   * genau die Art stiller Fehler, die später niemand mehr findet.
   */
  static async setStatus(id: string, status: DraftView['status']): Promise<DraftView> {
    if (status === 'freigegeben') {
      const d = await prisma.mailDraft.findUniqueOrThrow({ where: { id } });
      if (!d.subject.trim() || !d.body.trim()) {
        throw new Error('Ohne Betreff und Text gibt es nichts freizugeben.');
      }
      if (!d.toEmail.trim()) {
        throw new Error('Es fehlt die Empfängeradresse.');
      }
    }
    const row = await prisma.mailDraft.update({ where: { id }, data: { status } });
    return toDraftView(row);
  }

  static async deleteDraft(id: string): Promise<void> {
    await prisma.mailDraft.delete({ where: { id } });
  }

  /** Kontext eines Entwurfs für die Platzhalter. */
  static context(item: { ansprechpartner: string; firma: string; ort: string }, draft: DraftView | null): MailContext {
    return {
      ansprechpartner: item.ansprechpartner,
      firma: item.firma,
      ort: item.ort,
      thema: draft?.thema ?? '',
      gesprochenMit: draft?.gesprochenMit ?? '',
      gespraechAm: draft?.gespraechAm ?? null,
    };
  }
}
