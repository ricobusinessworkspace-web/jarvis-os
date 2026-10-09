import { AnalyticsService, type MetricMatrix, type MetricSummary } from './AnalyticsService';
import { BLOCK_START, addDays, dateRange, isoWeekday, JOKER_WEEKDAY } from '@/lib/blocks';
import { PHASES, phaseOf, type Phase } from '@/lib/phases';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Was die Zahlen bedeuten und seit wann sie wie bewertet werden.
 *
 * Für jeden, der über Tage und Wochen hinweg liest — vor allem ChatGPT. Eine
 * Quote aus Phase 1 (lückenhaft getrackt, Körperwerte mit Ziel) neben einer
 * aus Phase 2 (Regeln, 6 Routineschritte) liest sich sonst wie ein
 * Leistungswechsel. Abgeleitet wird alles, was sich aus dem Semantic Layer
 * ablesen lässt (Quellen, Zielfassungen, Wochentage); fester Text steht nur
 * für Lücken, die nirgends gespeichert sind.
 */

/** Ab dieser Abdeckung ist eine Quote einer Phase vergleichbar. */
export const AUSSAGEKRAEFTIG_AB = 0.7;
/** Unter dieser Abdeckung gilt eine Woche als lückenhaft getrackt. */
export const LUECKENHAFT_UNTER = 0.5;

/**
 * Was ein Tag **ohne Eintrag** heißt:
 * - `gehalten` — Regeln: gehalten, solange kein Rückfall eingetragen ist.
 * - `null` — lückenlose Quelle (CRM protokolliert jeden Anruf): kein Eintrag ist eine echte 0.
 * - `nicht_gemessen` — alles andere: vergessen, nicht verfehlt.
 */
export type FehlendHeisst = 'gehalten' | 'null' | 'nicht_gemessen';

export interface Zielfassung {
  von: string;
  /** Letzter Tag, inklusive. `null` = gilt noch. */
  bis: string | null;
  basis: number | null;
  soll: number | null;
  vergleich: string;
  /** Ziel aus einer Verbindung statt fester Zahl — siehe `ZIEL_HERKUNFT`. */
  ableitung: string | null;
  wochentage: number[];
}

export interface MetrikKontext {
  key: string;
  label: string;
  unit: string;
  domain: string;
  aggregation: string;
  /** Quellen in Prioritätsreihenfolge (`kind`), erster Treffer gewinnt. */
  quellen: string[];
  fehlendHeisst: FehlendHeisst;
  /** Ab wann `fehlendHeisst` gilt; davor heißt ein leerer Tag „nicht gemessen". */
  fehlendAb: string | null;
  /** Alle Zielfassungen, älteste zuerst. Leer = nie bewertet, nur erfasst. */
  ziele: Zielfassung[];
}

export interface Datenluecke {
  betrifft: string[];
  von: string;
  bis: string | null;
  text: string;
}

/** Woher ein abgeleitetes Ziel kommt — vorlesbar. */
export const ZIEL_HERKUNFT: Record<string, string> = {
  crm_target: 'Vertriebsziel aus dem CRM',
  routine_completeness: 'Routine: Basis = höchstens maxSkip Schritte ausgelassen, Soll = alle',
  health_target: 'Kalorienziel aus Apple Health/Cronometer',
  weight_trajectory: 'Gewichtsverlauf aus Apple Health, je Tag interpoliert',
};

/**
 * Die einzige Lücke, die in keiner Tabelle steht: gelöschte Haken. Alles
 * andere (Ziel endete, Metrik kam später dazu, Erfassung erst ab Datum)
 * leitet `datenluecken` aus dem Semantic Layer ab.
 */
const FESTE_LUECKEN: Datenluecke[] = [
  {
    betrifft: ['routine.morning', 'routine.evening'],
    von: BLOCK_START,
    bis: '2026-09-27',
    text:
      'Routine-Haken vor dem 28.09. sind unvollständig: die Routinen hatten zeitweise 8–9 Schritte, die Haken ' +
      'der später gestrichenen Schritte sind gelöscht. Die Tage werden gegen die verbliebenen Schritte bewertet.',
  },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function wochentageText(tage: number[]): string {
  return tage.includes(JOKER_WEEKDAY)
    ? 'gilt täglich; der Sonntag ist Joker — ein Rückfall dort zählt in die Quote, reißt aber keine Serie'
    : 'Montag bis Samstag; Sonntag ist frei';
}

export function fehlendText(k: Pick<MetrikKontext, 'fehlendHeisst' | 'fehlendAb'>): string {
  const ab = k.fehlendAb ? ` (ab ${k.fehlendAb})` : '';
  switch (k.fehlendHeisst) {
    case 'gehalten': return `kein Eintrag heißt gehalten${ab} — nur Rückfälle werden eingetragen`;
    case 'null': return `kein Eintrag heißt 0${ab} — die Quelle erfasst lückenlos`;
    default: return 'kein Eintrag heißt nicht gemessen, nicht 0';
  }
}

/**
 * Datenqualität eines Zeitraums: Abdeckung nur über Metriken, bei denen ein
 * leerer Tag wirklich „vergessen" heißt und ein Ziel galt. Calls (lückenlos
 * aus dem CRM) und Regeln (gehalten bis zum Rückfall) haben immer 100 % und
 * würden ein lückenhaftes Tracking schönrechnen.
 */
export function datenqualitaet(
  eintraege: Array<{ fehlendHeisst: FehlendHeisst; summary: MetricSummary }>
): { abdeckung: number | null; qualitaet: 'lueckenhaft' | 'ausreichend' | 'unbekannt' } {
  let gemessen = 0;
  let getrackt = 0;
  for (const { fehlendHeisst, summary } of eintraege) {
    if (fehlendHeisst !== 'nicht_gemessen' || summary.targeted === 0) continue;
    gemessen += summary.measured;
    getrackt += summary.tracked;
  }
  if (getrackt === 0) return { abdeckung: null, qualitaet: 'unbekannt' };
  const abdeckung = gemessen / getrackt;
  return { abdeckung, qualitaet: abdeckung < LUECKENHAFT_UNTER ? 'lueckenhaft' : 'ausreichend' };
}

export class DatenbasisService {
  /** Jede aktive Metrik mit Quelle, Bedeutung eines leeren Tages und allen Zielfassungen. */
  static async metriken(): Promise<MetrikKontext[]> {
    const { definitions, sources, intentions } = await AnalyticsService.getLayer();

    return definitions
      .filter(d => d.isActive)
      .map(d => {
        const eigene = sources.filter(s => s.metricKey === d.key && s.isActive); // nach priority sortiert
        // Die erste Quelle, die einen leeren Tag mit einem Wert füllt, bestimmt seine Bedeutung —
        // genau sie gewinnt in `getMatrix` an solchen Tagen.
        let fehlendHeisst: FehlendHeisst = 'nicht_gemessen';
        let fehlendAb: string | null = null;
        for (const s of eigene) {
          const c = (s.config ?? {}) as Record<string, unknown>;
          if (text(c.assumeDoneFrom)) {
            fehlendHeisst = 'gehalten';
            fehlendAb = text(c.assumeDoneFrom);
            break;
          }
          if (text(c.zeroFrom) || c.impliesZero === true) {
            fehlendHeisst = 'null';
            fehlendAb = text(c.zeroFrom) || BLOCK_START;
            break;
          }
        }

        const ziele: Zielfassung[] = intentions
          .filter(i => i.metricKey === d.key)
          .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
          .map(i => ({
            von: iso(i.validFrom),
            bis: i.validTo ? iso(i.validTo) : null,
            basis: i.baseValue,
            soll: i.stretchValue,
            vergleich: i.comparator,
            ableitung: i.derivedKind,
            wochentage: i.activeWeekdays,
          }));

        return {
          key: d.key,
          label: d.label,
          unit: d.unit,
          domain: d.domain,
          aggregation: d.aggregation,
          quellen: eigene.map(s => s.kind),
          fehlendHeisst,
          fehlendAb,
          ziele,
        };
      });
  }

  /**
   * Bekannte Lücken: die festen plus die aus dem Semantic Layer ablesbaren —
   * Ziel endete, Metrik wird erst später bewertet, Erfassung erst ab Datum.
   */
  static datenluecken(metriken: MetrikKontext[]): Datenluecke[] {
    const abgeleitet: Datenluecke[] = [];
    for (const m of metriken) {
      const erste = m.ziele[0];
      const letzte = m.ziele.at(-1);
      if (erste && erste.von > BLOCK_START) {
        abgeleitet.push({
          betrifft: [m.key], von: BLOCK_START, bis: addDays(erste.von, -1),
          text: `${m.label} wird erst ab ${erste.von} bewertet — davor gab es die Kennzahl nicht; leere Tage heißen „gab es noch nicht".`,
        });
      }
      if (letzte?.bis) {
        abgeleitet.push({
          betrifft: [m.key], von: letzte.bis, bis: null,
          text: `${m.label}: Ziel endete am ${letzte.bis}. Danach nur noch erfasst, ohne Bewertung — keine Zielquote.`,
        });
      }
      // Wurde die Kennzahl erst ab dann bewertet, sagt die Lücke oben schon alles.
      const spaeterBewertet = erste !== undefined && erste.von >= (m.fehlendAb ?? '');
      if (m.fehlendHeisst !== 'nicht_gemessen' && m.fehlendAb && m.fehlendAb > BLOCK_START && !spaeterBewertet) {
        abgeleitet.push({
          betrifft: [m.key], von: BLOCK_START, bis: addDays(m.fehlendAb, -1),
          text: `${m.label}: vor ${m.fehlendAb} nicht vollständig erfasst — ein leerer Tag heißt dort „nicht gemessen", nicht ${m.fehlendHeisst === 'gehalten' ? '„gehalten"' : '0'}.`,
        });
      }
    }
    return [...FESTE_LUECKEN, ...abgeleitet];
  }

  /**
   * Je Phase und Metrik: getrackte Tage, Tage mit Ziel, erfüllt, Quote,
   * Abdeckung, beste Serie innerhalb der Phase. Dieselbe `summarize` wie
   * Dashboard und Health — nur über die Phasengrenzen geschnitten.
   */
  static async phasenVergleich(heute: string = getBerlinDateStr()) {
    const metriken = await this.metriken();
    const matrix = await AnalyticsService.getMatrix(BLOCK_START, heute);

    return PHASES.filter(p => p.von <= heute).map(p => {
      const bis = p.bis !== null && p.bis < heute ? p.bis : heute;
      const eintraege = metriken.map(m => ({
        kontext: m,
        fehlendHeisst: m.fehlendHeisst,
        summary: AnalyticsService.summarize(matrix, m.key, p.von, bis, {
          streakFrom: p.von,
          missIsFinal: m.domain === 'rules',
        }),
      }));
      return { phase: p, von: p.von, bis, laeuft: p.bis === null || p.bis >= heute, eintraege, ...datenqualitaet(eintraege) };
    });
  }

  /** Tagesgenaue Matrix mit Phase je Tag — höchstens `TAGE_MAX` Tage. */
  static async tage(von: string, bis: string, keys?: string[]): Promise<{
    matrix: MetricMatrix;
    tage: Array<{ datum: string; wochentag: number; phase: Phase | null }>;
  }> {
    const matrix = await AnalyticsService.getMatrix(von, bis, keys);
    return {
      matrix,
      tage: dateRange(von, bis).map(datum => ({ datum, wochentag: isoWeekday(datum), phase: phaseOf(datum) })),
    };
  }
}

export const TAGE_MAX = 31;
