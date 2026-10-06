import { prisma } from '../db';
import { TaskInboxService, type CrmStatus } from './TaskInboxService';
import { CrmService, type MailLead } from './CrmService';
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

/** Ein abgelehnter Vorgang mit einem Grund, den Rico lesen darf. */
export class MailRegelFehler extends Error {}

export const ENTWURF_GRENZEN = { betreff: 200, text: 10_000 } as const;

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
   * Fällt das CRM aus, ist die Warteschlange leer, statt dass die Seite kippt.
   * Bereits begonnene Entwürfe gehen dabei nicht verloren, sie hängen an
   * `mail_drafts`. Wer den Ausfall melden muss, nimmt `getQueueMitStatus`.
   */
  static async getQueue(userName = 'Rico'): Promise<QueueItem[]> {
    return (await this.getQueueMitStatus(userName)).items;
  }

  /**
   * Die Warteschlange mit Auskunft über ihre Quelle.
   *
   * `status` betrifft die Aufgaben selbst (siehe `CrmStatus`), `adressen`
   * die Lead-Daten dahinter. Sind die Aufgaben da, die Lead-Daten aber nicht,
   * steht jeder Vorgang ohne Adresse da — das ist dann „unbekannt", nicht
   * „keine Adresse im CRM".
   */
  static async getQueueMitStatus(userName = 'Rico'): Promise<{
    status: CrmStatus;
    adressen: 'ok' | 'nicht_erreichbar';
    items: QueueItem[];
  }> {
    const crm = await TaskInboxService.getCrmTasksMitStatus(userName, 100);
    const tasks = crm.items.filter(t => MAIL_MARKER.test(t.text));
    if (tasks.length === 0) return { status: crm.status, adressen: 'ok', items: [] };

    let adressen: 'ok' | 'nicht_erreichbar' = 'ok';
    let leads = new Map<string, MailLead>();
    try {
      leads = await CrmService.loadLeadsForMail(tasks.map(t => t.leadId));
    } catch (error) {
      console.error('[MailService] Lead-Daten nicht verfügbar:', error instanceof Error ? error.message : error);
      adressen = 'nicht_erreichbar';
    }

    const drafts = await prisma.mailDraft.findMany({
      where: { taskKey: { in: tasks.map(t => t.id) } },
    });
    const byTask = new Map(drafts.map(d => [d.taskKey!, toDraftView(d)]));

    const items = tasks.map(t => {
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

    return { status: crm.status, adressen, items };
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

  /**
   * Entwurf von außen speichern — der Weg für den MCP-Server.
   *
   * Anders als `updateDraft` (Rico tippt in Jarvis, die Oberfläche kennt den
   * Entwurf) kommt hier alles von einem Sprachmodell. Deshalb wird nichts aus
   * den Parametern geglaubt, was der Server selbst nachsehen kann:
   *
   * - **Die Aufgabe muss jetzt offen im CRM stehen.** Der `taskKey` wird gegen
   *   die frisch gelesene Warteschlange geprüft; Lead, Adresse und Thema
   *   kommen von dort, nie aus dem Aufruf.
   * - **Nichts Fremdes überschreiben.** Gibt es schon einen Entwurf, muss der
   *   Aufrufer dessen Stand (`updatedAt`) nennen. Hat Rico ihn seither
   *   geändert, wird abgelehnt — und zwar in der Datenbank, nicht nur im
   *   Code davor (`updateMany` mit dem Stand als Bedingung).
   * - **Wiederholung ändert nichts.** Derselbe Text noch einmal ergibt
   *   `unveraendert`, keinen zweiten Entwurf und keinen neuen Stand.
   * - **Nie freigeben, nie senden.** Höchstens `offen → entwurf`. Ein
   *   freigegebener oder gesendeter Entwurf wird nicht mehr angefasst.
   *
   * Geändert werden nur Betreff und Text; Empfänger, Gesprächskontext und
   * Vorlage bleiben, wie Rico sie gesetzt hat.
   */
  static async entwurfSpeichern(
    eingabe: { taskKey: string; betreff: string; text: string; stand: string | null },
    userName = 'Rico',
  ): Promise<{ ergebnis: 'angelegt' | 'aktualisiert' | 'unveraendert'; entwurf: DraftView }> {
    const betreff = eingabe.betreff.trim();
    const text = eingabe.text.replace(/\s+$/, '');
    if (!betreff) throw new MailRegelFehler('Der Betreff ist leer.');
    if (!text.trim()) throw new MailRegelFehler('Der Text ist leer.');
    if (betreff.length > ENTWURF_GRENZEN.betreff) throw new MailRegelFehler(`Der Betreff ist länger als ${ENTWURF_GRENZEN.betreff} Zeichen.`);
    if (text.length > ENTWURF_GRENZEN.text) throw new MailRegelFehler(`Der Text ist länger als ${ENTWURF_GRENZEN.text} Zeichen.`);

    const queue = await this.getQueueMitStatus(userName);
    if (queue.status !== 'ok') {
      throw new MailRegelFehler('Die CRM-Aufgaben sind gerade nicht lesbar. Ohne die Aufgabe im CRM wird kein Entwurf gespeichert.');
    }
    const item = queue.items.find(i => i.taskKey === eingabe.taskKey);
    if (!item) {
      throw new MailRegelFehler('Zu diesem taskKey gibt es keine offene Mail-Aufgabe im CRM. Zuerst mail_warteschlange_anzeigen aufrufen.');
    }

    const vorhanden = item.draft;

    if (!vorhanden) {
      if (eingabe.stand) {
        throw new MailRegelFehler('Den genannten Entwurf gibt es nicht mehr. Warteschlange neu laden.');
      }
      try {
        const angelegt = await prisma.mailDraft.create({
          data: {
            leadId: BigInt(item.leadId),
            taskKey: item.taskKey,
            toEmail: item.toEmail,
            thema: item.auftrag,
            subject: betreff,
            body: text,
            status: 'entwurf',
          },
        });
        return { ergebnis: 'angelegt', entwurf: toDraftView(angelegt) };
      } catch (error) {
        // Eindeutigkeit auf task_key: ein paralleler Aufruf war schneller.
        if ((error as { code?: string })?.code === 'P2002') {
          throw new MailRegelFehler('Inzwischen gibt es einen Entwurf zu dieser Aufgabe. Warteschlange neu laden.');
        }
        throw error;
      }
    }

    if (vorhanden.status === 'freigegeben' || vorhanden.status === 'gesendet') {
      throw new MailRegelFehler(`Der Entwurf ist bereits ${vorhanden.status}. Änderungen daran nur in Jarvis selbst.`);
    }

    if (vorhanden.subject === betreff && vorhanden.body === text) {
      return { ergebnis: 'unveraendert', entwurf: vorhanden };
    }

    if (!eingabe.stand || eingabe.stand !== vorhanden.updatedAt) {
      throw new MailRegelFehler('Der Entwurf wurde seit dem Lesen geändert oder der Stand fehlt. Warteschlange neu laden und den aktuellen Stand mitgeben.');
    }

    // Der Stand ist auf Millisekunden genau; die Spalte kann feiner sein.
    const stand = new Date(eingabe.stand);
    const geaendert = await prisma.mailDraft.updateMany({
      where: {
        id: vorhanden.id,
        status: { in: ['offen', 'entwurf'] },
        updatedAt: { gte: stand, lt: new Date(stand.getTime() + 1) },
      },
      data: { subject: betreff, body: text, status: 'entwurf' },
    });
    if (geaendert.count === 0) {
      throw new MailRegelFehler('Der Entwurf wurde gerade eben geändert. Warteschlange neu laden.');
    }

    const neu = await prisma.mailDraft.findUniqueOrThrow({ where: { id: vorhanden.id } });
    return { ergebnis: 'aktualisiert', entwurf: toDraftView(neu) };
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
