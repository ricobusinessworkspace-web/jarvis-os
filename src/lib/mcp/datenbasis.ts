import { AnalyticsService } from '@/core/services/AnalyticsService';
import {
  AUSSAGEKRAEFTIG_AB,
  DatenbasisService,
  fehlendText,
  TAGE_MAX,
  wochentageText,
  ZIEL_HERKUNFT,
  type MetrikKontext,
} from '@/core/services/DatenbasisService';
import { BLOCK_START, daysBetween, OFF_WEEKDAY, TRACKED_WEEKDAYS } from '@/lib/blocks';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { SOURCE_LABEL } from '@/lib/metricState';
import { PHASES, phaseOf } from '@/lib/phases';
import { WerkzeugFehler, type Werkzeug } from './protocol';
import { datenstand, datum, nurErlaubt, NUR_LESEN, rund, WOCHENTAG, ZUSTAND_TEXT } from './hilfen';

/**
 * Lesewerkzeuge zur Datenbasis: was die Zahlen bedeuten (`jarvis_kontext`),
 * wie die Phasen im Vergleich dastehen (`phasen_vergleich`) und die Tage im
 * Einzelnen (`tage_anzeigen`). Gerechnet wird im `DatenbasisService`; hier
 * wird nur vorlesbar gemacht.
 */

const quellenText = (m: MetrikKontext) =>
  [...new Set(m.quellen.map(k => SOURCE_LABEL[k] ?? k))].join(', ') || null;

const ROLLE: Record<string, string> = {
  business: 'Vertrieb',
  body: 'Körper/Training',
  social: 'Ursache',
  rules: 'Tagesregel',
};

// ── Kontext ──────────────────────────────────────────────────────────────────

const jarvisKontext: Werkzeug = {
  name: 'jarvis_kontext',
  title: 'Wie Jarvis-Daten zu lesen sind',
  description:
    'Das Handbuch zu Ricos Jarvis-Daten — vor jedem Rückblick, Wochen- oder Phasenvergleich zuerst lesen. ' +
    'Nennt die Phasen des Plans, je Kennzahl Quelle, Ziel heute, seit wann und bis wann sie bewertet wurde, ' +
    'an welchen Wochentagen sie gilt und ob ein Tag ohne Eintrag „nicht gemessen", „0" oder „gehalten" heißt, ' +
    'dazu die bekannten Datenlücken. Nur lesend.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: NUR_LESEN,
  async run(args) {
    nurErlaubt(args, []);
    const heute = getBerlinDateStr();
    const metriken = await DatenbasisService.metriken();
    const matrix = await AnalyticsService.getMatrix(heute, heute);
    const phase = phaseOf(heute);

    return {
      datenstand: datenstand(),
      heute: { datum: heute, phase: phase ? { nummer: phase.nummer, name: phase.name } : null },
      phasen: PHASES.map(p => ({ ...p, laeuft: p.von <= heute && (p.bis === null || p.bis >= heute) })),
      grundregeln: [
        '`null` heißt nicht gemessen, nie 0. Ob ein leerer Tag 0 oder „gehalten" heißt, steht je Kennzahl unter fehlender_wert.',
        `Ursachen und Routinen gelten Montag bis Samstag (${TRACKED_WEEKDAYS.length} Tage), der Sonntag (Tag ${OFF_WEEKDAY}) ist dort frei.`,
        'Tagesregeln gelten auch sonntags. Der Sonntag ist Joker für jede Serie: ein Rückfall am Sonntag zählt in ' +
          'Quote und Rückfälle, reißt aber keine Serie.',
        'Heute ist bei Ursachen und Routinen offen, bis es erfüllt ist — kein Verfehlen vor Tagesende. Ein ' +
          'eingetragener Regel-Rückfall steht sofort fest.',
        'Zielquote = erfüllte Tage / Tage, an denen ein Ziel galt. Ohne Ziel keine Quote (null), nicht 0 %.',
        `Eine Quote ist erst ab ${AUSSAGEKRAEFTIG_AB * 100} % Abdeckung aussagekräftig. Phase 1 war lückenhaft ` +
          'getrackt — dort niedrige Quoten als Tracking-Lücke benennen, nicht als Leistungsabfall.',
        'Vergleiche über Phasen hinweg immer mit Phase benennen: die Phasen bewerten Verschiedenes.',
      ],
      kennzahlen: metriken.map(m => {
        const zelle = matrix[heute]?.[m.key];
        const jetzt = m.ziele.find(z => z.von <= heute && (z.bis === null || z.bis >= heute));
        return {
          key: m.key,
          name: m.label,
          einheit: m.unit,
          rolle: ROLLE[m.domain] ?? m.domain,
          quelle: quellenText(m),
          fehlender_wert: m.fehlendHeisst,
          fehlender_wert_text: fehlendText(m),
          tage: jetzt ? wochentageText(jetzt.wochentage) : null,
          wird_heute_bewertet: Boolean(jetzt),
          ziel_heute: jetzt
            ? {
                basis: rund(zelle?.base ?? null),
                soll: rund(zelle?.stretch ?? null),
                herkunft: jetzt.ableitung ? (ZIEL_HERKUNFT[jetzt.ableitung] ?? jetzt.ableitung) : 'feste Zahl',
                hinweis: zelle?.targetHint ?? null,
              }
            : null,
          bewertet: m.ziele.map(z => ({
            von: z.von,
            bis: z.bis,
            basis: z.basis,
            soll: z.soll,
            herkunft: z.ableitung ? (ZIEL_HERKUNFT[z.ableitung] ?? z.ableitung) : 'feste Zahl',
          })),
        };
      }),
      bekannte_luecken: DatenbasisService.datenluecken(metriken),
    };
  },
};

// ── Phasenvergleich ──────────────────────────────────────────────────────────

const phasenVergleich: Werkzeug = {
  name: 'phasen_vergleich',
  title: 'Phasen im Vergleich',
  description:
    'Je Phase des Plans und je Kennzahl: getrackte Tage, Tage mit Ziel, erfüllte Tage, Zielquote, Datenabdeckung ' +
    'und beste Serie in der Phase, dazu ob die Quote aussagekräftig ist. Für Fragen wie „Wie lief der September ' +
    'im Vergleich zu jetzt?". Nur Vergleichbares vergleichen (aussagekraeftig). Nur lesend.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: NUR_LESEN,
  async run(args) {
    nurErlaubt(args, []);
    const phasen = await DatenbasisService.phasenVergleich();

    return {
      datenstand: datenstand(),
      phasen: phasen.map(p => ({
        nummer: p.phase.nummer,
        name: p.phase.name,
        von: p.von,
        bis: p.bis,
        laeuft: p.laeuft,
        bewertet: p.phase.bewertet,
        hinweis: p.phase.hinweis,
        datenqualitaet: p.qualitaet,
        datenabdeckung: rund(p.abdeckung),
        kennzahlen: p.eintraege
          .filter(e => e.summary.targeted > 0 || e.summary.measured > 0)
          .map(({ kontext, summary: s }) => ({
            key: kontext.key,
            name: kontext.label,
            getrackte_tage: s.tracked,
            tage_mit_ziel: s.targeted,
            erfuellt: s.met,
            zielquote: rund(s.adherence),
            datenabdeckung: rund(s.coverage),
            beste_serie: s.bestStreak,
            fehlender_wert: kontext.fehlendHeisst,
            aussagekraeftig: s.targeted > 0 && s.coverage !== null && s.coverage >= AUSSAGEKRAEFTIG_AB,
          })),
      })),
      lesehilfe:
        `aussagekraeftig = es galt ein Ziel und mindestens ${AUSSAGEKRAEFTIG_AB * 100} % der getrackten Tage ` +
        'haben einen Eintrag. Nicht aussagekräftige Quoten als Tracking-Lücke benennen, nicht als Leistung. ' +
        'Die laufende Phase endet heute; heute zählt nur, wenn es schon erfüllt ist. beste_serie zählt nur ' +
        'innerhalb der Phase — die Serie auf dem Dashboard läuft über den Phasenschnitt. datenqualitaet bezieht ' +
        'sich nur auf Kennzahlen, bei denen ein leerer Tag „nicht gemessen" heißt (nicht Calls, nicht Regeln).',
    };
  },
};

// ── Einzelne Tage ────────────────────────────────────────────────────────────

/** Ohne Auswahl: alles außer den Vertriebs-Unterkennzahlen — die fragt man gezielt an. */
const standardAuswahl = (m: MetrikKontext) => m.domain !== 'business' || m.key === 'sales.calls_count';

const tageAnzeigen: Werkzeug = {
  name: 'tage_anzeigen',
  title: 'Tage im Einzelnen',
  description:
    `Tagesgenaue Jarvis-Werte für einen Zeitraum von höchstens ${TAGE_MAX} Tagen: je Tag und Kennzahl Wert, ` +
    'Basis, Soll, Zustand und Quelle, dazu die Phase. Ohne kennzahlen-Auswahl: Ursachen, Routinen, Regeln, ' +
    'Körperwerte und Calls; Vertriebs-Unterkennzahlen (sales.*) gezielt per key anfragen. Nur lesend.',
  inputSchema: {
    type: 'object',
    properties: {
      von: { type: 'string', format: 'date', description: 'Erster Tag, JJJJ-MM-TT.' },
      bis: { type: 'string', format: 'date', description: 'Letzter Tag, JJJJ-MM-TT, höchstens heute.' },
      kennzahlen: {
        type: 'array',
        items: { type: 'string', maxLength: 60 },
        maxItems: 25,
        description: 'Optional: keys aus jarvis_kontext.',
      },
    },
    required: ['von', 'bis'],
    additionalProperties: false,
  },
  annotations: NUR_LESEN,
  async run(args) {
    nurErlaubt(args, ['von', 'bis', 'kennzahlen']);
    const von = datum(args.von, 'von');
    const bis = datum(args.bis, 'bis');
    const heute = getBerlinDateStr();
    if (von > bis) throw new WerkzeugFehler('von liegt nach bis.');
    if (bis > heute) throw new WerkzeugFehler(`bis liegt in der Zukunft — heute ist ${heute}.`);
    if (von < BLOCK_START) throw new WerkzeugFehler(`Jarvis-Daten beginnen am ${BLOCK_START}.`);
    if (daysBetween(von, bis) + 1 > TAGE_MAX) {
      throw new WerkzeugFehler(`Höchstens ${TAGE_MAX} Tage auf einmal — für längere Zeiträume phasen_vergleich oder performance_wochenverlauf.`);
    }

    const metriken = await DatenbasisService.metriken();
    let auswahl = metriken.filter(standardAuswahl);
    if (args.kennzahlen !== undefined) {
      if (!Array.isArray(args.kennzahlen) || args.kennzahlen.some(k => typeof k !== 'string')) {
        throw new WerkzeugFehler('kennzahlen muss eine Liste von keys sein.');
      }
      const unbekannt = args.kennzahlen.filter(k => !metriken.some(m => m.key === k));
      if (unbekannt.length) throw new WerkzeugFehler(`Unbekannte Kennzahl: ${unbekannt.join(', ')}. Keys stehen in jarvis_kontext.`);
      auswahl = metriken.filter(m => (args.kennzahlen as string[]).includes(m.key));
    }

    const { matrix, tage } = await DatenbasisService.tage(von, bis, auswahl.map(m => m.key));

    return {
      datenstand: datenstand(),
      kennzahl_namen: Object.fromEntries(auswahl.map(m => [m.key, m.label])),
      tage: tage.map(t => ({
        datum: t.datum,
        wochentag: WOCHENTAG[t.wochentag],
        phase: t.phase?.nummer ?? null,
        heute: t.datum === heute,
        kennzahlen: Object.fromEntries(
          auswahl.map(m => {
            const c = matrix[t.datum]?.[m.key];
            return [m.key, c
              ? {
                  wert: rund(c.value),
                  basis: rund(c.base),
                  soll: rund(c.stretch),
                  zustand: c.state,
                  zustand_text: ZUSTAND_TEXT[c.state],
                  quelle: c.source ? (SOURCE_LABEL[c.source] ?? c.source) : null,
                }
              : null];
          })
        ),
      })),
      lesehilfe:
        'wert null = nicht gemessen. zustand offday = an dem Tag gilt die Kennzahl nicht (Sonntag bei Ursachen ' +
        'und Routinen). Regeln: wert 1 = gehalten, 0 = Rückfall; ein Rückfall am Sonntag reißt keine Serie (Joker). ' +
        'heute = der Tag läuft noch. Phase je Tag: siehe jarvis_kontext.',
    };
  },
};

export const DATENBASIS_WERKZEUGE: Werkzeug[] = [jarvisKontext, phasenVergleich, tageAnzeigen];
