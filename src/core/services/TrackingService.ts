import { prisma } from '../db';
import { AnalyticsService } from './AnalyticsService';

/**
 * Der eine Schreibweg für Haken: Ursachen, Regeln und Routine-Schritte.
 *
 * Die Server Actions (Dashboard, Verlauf) und der MCP-Server (ChatGPT) rufen
 * dieselben Funktionen — sonst gäbe es zwei Schreibwege mit zwei Regelwerken.
 * Die Actions bleiben dünne Hüllen mit `revalidateTracking()`.
 *
 * Jede Funktion meldet, was vorher stand und was jetzt steht. Steht schon da,
 * was geschrieben werden soll, wird **nichts** geschrieben (`geaendert: false`)
 * — ein wiederholter Aufruf ist harmlos.
 *
 * Gespeichert wird in `jarvis_tracker_logs`:
 * - `completed` — erledigt bzw. (bei Regeln) ausdrücklich gehalten
 * - `not_done` — bewusst nicht geschafft bzw. Rückfall
 * - keine Zeile — „nicht gemessen" (Ursachen) bzw. gehalten (Regeln)
 */

export type HakenStatus = 'completed' | 'not_done' | 'skipped';
export const HAKEN_STATUS: readonly HakenStatus[] = ['completed', 'not_done', 'skipped'];

/** Eine Regel wurde verletzt — die Nachricht ist für Rico bzw. das Modell gedacht. */
export class TrackingFehler extends Error {}

export interface Aenderung {
  /** Status vor dem Aufruf; `null` = keine Zeile. */
  vorher: string | null;
  nachher: string | null;
  geaendert: boolean;
}

const tag = (datum: string) => new Date(`${datum}T00:00:00.000Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

export interface Schritt {
  id: string;
  title: string;
  trackerName: string;
  trackerType: string;
  activeFrom: string | null;
  archivedOn: string | null;
}

/** Galt der Schritt an diesem Tag? Dasselbe Fenster, aus dem die Matrix die Schrittzahl bildet. */
export function giltAm(s: Pick<Schritt, 'activeFrom' | 'archivedOn'>, datum: string): boolean {
  return (s.activeFrom === null || s.activeFrom <= datum) && (s.archivedOn === null || s.archivedOn > datum);
}

export class TrackingService {
  /**
   * Der Haken, in den eine Ursache oder Regel geschrieben wird. Welcher das
   * ist, steht in `core_metric_sources`, nicht im Code.
   *
   * Nur Metriken, deren **vorrangige** Quelle der Haken ist: bei Calls gewinnt
   * das CRM, ein Haken von Hand würde dort nie gelesen.
   */
  static async hakenFuer(metricKey: string): Promise<Schritt> {
    const quellen = await prisma.coreMetricSource.findMany({
      where: { metricKey, isActive: true },
      orderBy: { priority: 'asc' },
    });
    if (!quellen.length) throw new TrackingFehler(`Unbekannte Kennzahl ${metricKey}.`);
    if (quellen[0].kind !== 'tracker') {
      throw new TrackingFehler(`${metricKey} kommt automatisch (${quellen[0].kind}) und wird nicht von Hand abgehakt.`);
    }

    const config = (quellen[0].config ?? {}) as Record<string, unknown>;
    const trackerName = text(config.tracker);
    const itemTitle = text(config.item);
    if (!trackerName || !itemTitle) {
      throw new TrackingFehler(`Für ${metricKey} ist kein einzelner Haken hinterlegt.`);
    }

    const item = await prisma.trackerItem.findFirst({
      where: { title: itemTitle, tracker: { name: trackerName } },
      select: { id: true, title: true, activeFrom: true, archivedOn: true, tracker: { select: { name: true, type: true } } },
    });
    if (!item) throw new TrackingFehler(`Tracker-Eintrag „${trackerName} / ${itemTitle}" fehlt.`);

    return {
      id: item.id,
      title: item.title,
      trackerName: item.tracker.name,
      trackerType: item.tracker.type,
      activeFrom: iso(item.activeFrom),
      archivedOn: iso(item.archivedOn),
    };
  }

  /**
   * Ursache oder Regel für einen Tag setzen. `done = false` ist ein bewusst
   * gesetzter Zustand — bei Ursachen „nicht geschafft", bei Regeln ein
   * Rückfall — und etwas anderes als keine Zeile.
   */
  static async setzeUrsache(metricKey: string, datum: string, done: boolean): Promise<Aenderung> {
    const haken = await this.hakenImFenster(metricKey, datum);
    return this.schreibe(haken.id, datum, done ? 'completed' : 'not_done');
  }

  /**
   * Entfernt den Tageseintrag ganz: eine Ursache steht danach auf „nicht
   * gemessen", eine Regel wieder auf gehalten (Rückfall zurückgenommen).
   */
  static async loescheUrsache(metricKey: string, datum: string): Promise<Aenderung> {
    const haken = await this.hakenImFenster(metricKey, datum);
    return this.schreibe(haken.id, datum, null);
  }

  /** Eine Regel gibt es erst ab ihrem Starttag — davor wäre ein Rückfall unsichtbar. */
  private static async hakenImFenster(metricKey: string, datum: string): Promise<Schritt> {
    const haken = await this.hakenFuer(metricKey);
    if (!giltAm(haken, datum)) throw new TrackingFehler(`„${haken.title}" galt am ${datum} noch nicht.`);
    return haken;
  }

  /**
   * Was sich von Hand abhaken lässt: aktive Metriken, deren vorrangige Quelle
   * ein einzelner Haken ist — Ursachen wie Training und Post, und die Regeln.
   * Abgeleitet aus `core_metric_sources`; Calls (CRM) fallen von selbst heraus.
   */
  static async abhakbar(): Promise<Array<{ key: string; label: string; domain: string }>> {
    const { definitions, sources } = await AnalyticsService.getLayer();
    return definitions
      .filter(d => d.isActive)
      .filter(d => {
        const erste = sources.find(q => q.metricKey === d.key && q.isActive); // nach priority sortiert
        const c = (erste?.config ?? {}) as Record<string, unknown>;
        return erste?.kind === 'tracker' && Boolean(text(c.tracker)) && Boolean(text(c.item));
      })
      .map(d => ({ key: d.key, label: d.label, domain: d.domain }));
  }

  /** Die Metrik, die eine Routine zählt — über den Trackernamen in `core_metric_sources`. */
  static async routineMetrik(trackerName: string): Promise<{ key: string; label: string } | null> {
    const { definitions, sources } = await AnalyticsService.getLayer();
    const q = sources.find(s => {
      const c = (s.config ?? {}) as Record<string, unknown>;
      return s.isActive && s.kind === 'tracker' && !text(c.item) && text(c.tracker).toLowerCase() === trackerName.toLowerCase();
    });
    const d = q && definitions.find(x => x.key === q.metricKey);
    return d ? { key: d.key, label: d.label } : null;
  }

  /**
   * Einen Routine-Schritt für einen Tag setzen. Nur Schritte, die an dem Tag
   * galten — ein Haken außerhalb des Fensters würde von der Matrix nie
   * gezählt und stünde unsichtbar in der Datenbank.
   */
  static async setzeSchritt(itemId: string, datum: string, status: HakenStatus): Promise<Aenderung> {
    if (!HAKEN_STATUS.includes(status)) throw new TrackingFehler(`Unbekannter Status ${status}.`);
    const item = await prisma.trackerItem.findUnique({
      where: { id: itemId },
      select: { title: true, activeFrom: true, archivedOn: true },
    });
    if (!item) throw new TrackingFehler('Diesen Schritt gibt es nicht.');
    if (!giltAm({ activeFrom: iso(item.activeFrom), archivedOn: iso(item.archivedOn) }, datum)) {
      throw new TrackingFehler(`„${item.title}" galt am ${datum} nicht.`);
    }
    return this.schreibe(itemId, datum, status);
  }

  /** Nimmt den Haken eines Routine-Schritts ganz weg — der Schritt steht wieder offen. */
  static async loescheSchritt(itemId: string, datum: string): Promise<Aenderung> {
    return this.schreibe(itemId, datum, null);
  }

  /** Die Routine-Schritte, die an einem Tag galten, mit ihrem Haken — für Auswahl per Name. */
  static async schritteAm(datum: string): Promise<Array<Schritt & { status: string | null }>> {
    const items = await prisma.trackerItem.findMany({
      where: { tracker: { type: 'routine' } },
      orderBy: [{ tracker: { name: 'asc' } }, { order: 'asc' }],
      select: {
        id: true, title: true, activeFrom: true, archivedOn: true,
        tracker: { select: { name: true, type: true } },
        logs: { where: { date: tag(datum) }, select: { status: true } },
      },
    });
    return items
      .map(i => ({
        id: i.id,
        title: i.title,
        trackerName: i.tracker.name,
        trackerType: i.tracker.type,
        activeFrom: iso(i.activeFrom),
        archivedOn: iso(i.archivedOn),
        status: i.logs[0]?.status ?? null,
      }))
      .filter(s => giltAm(s, datum));
  }

  /** Schreibt nur, wenn sich etwas ändert; `null` löscht die Zeile. */
  private static async schreibe(itemId: string, datum: string, status: HakenStatus | null): Promise<Aenderung> {
    const where = { itemId_date: { itemId, date: tag(datum) } };
    const vorher = (await prisma.trackerLog.findUnique({ where, select: { status: true } }))?.status ?? null;
    if (vorher === status) return { vorher, nachher: vorher, geaendert: false };

    if (status === null) {
      await prisma.trackerLog.deleteMany({ where: { itemId, date: tag(datum) } });
    } else {
      const completedAt = status === 'completed' ? new Date() : null;
      await prisma.trackerLog.upsert({
        where,
        update: { status, completedAt },
        create: { itemId, date: tag(datum), status, completedAt },
      });
    }
    return { vorher, nachher: status, geaendert: true };
  }
}
