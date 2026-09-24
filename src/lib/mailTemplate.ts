/**
 * Platzhalter in Mail-Vorlagen — eine Quelle für Server und Oberfläche.
 *
 * Ein fehlender Wert wird **nicht** stillschweigend zu einem leeren String.
 * Sonst entsteht „Guten Tag ," und niemand merkt es vor dem Absenden. Statt-
 * dessen steht sichtbar `[Ansprechpartner fehlt]` im Text, und `missing` sagt
 * der Oberfläche, was sie anmahnen soll. Dieselbe Regel wie im Semantic Layer:
 * eine Lücke ist eine Lücke, keine Null.
 */

export interface MailContext {
  /** Aus dem CRM-Lead. */
  ansprechpartner: string;
  firma: string;
  ort: string;
  /** Pro Entwurf erfasst — worum es im Gespräch ging. */
  thema: string;
  gesprochenMit: string;
  /** ISO (`YYYY-MM-DD`) oder null, wenn kein Gesprächsdatum erfasst ist. */
  gespraechAm: string | null;
}

export const EMPTY_CONTEXT: MailContext = {
  ansprechpartner: '',
  firma: '',
  ort: '',
  thema: '',
  gesprochenMit: '',
  gespraechAm: null,
};

function germanDate(iso: string): string {
  // Mittags, damit die Zeitzone den Tag nicht kippt.
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}

const clean = (v: string) => (v.trim() === '' ? null : v.trim());

interface Placeholder {
  key: string;
  label: string;
  hint: string;
  resolve: (ctx: MailContext, today: string) => string | null;
}

/** Reihenfolge = Anzeige in der Oberfläche. */
export const PLACEHOLDERS: Placeholder[] = [
  {
    key: 'anrede',
    label: 'Anrede',
    hint: 'Ansprechpartner, sonst „Sehr geehrte Damen und Herren"',
    // Fällt nie aus: ohne Namen die neutrale Form. Bewusst kein Herr/Frau aus
    // dem Vornamen geraten — das geht irgendwann daneben, und zwar beim Kunden.
    resolve: ctx => {
      const name = clean(ctx.ansprechpartner);
      return name ? `Guten Tag ${name}` : 'Sehr geehrte Damen und Herren';
    },
  },
  { key: 'ansprechpartner', label: 'Ansprechpartner', hint: 'aus dem CRM-Lead',
    resolve: ctx => clean(ctx.ansprechpartner) },
  { key: 'firma', label: 'Firma', hint: 'aus dem CRM-Lead',
    resolve: ctx => clean(ctx.firma) },
  { key: 'ort', label: 'Ort', hint: 'aus dem CRM-Lead',
    resolve: ctx => clean(ctx.ort) },
  { key: 'thema', label: 'Thema', hint: 'worum es im Gespräch ging',
    resolve: ctx => clean(ctx.thema) },
  { key: 'gesprochen_mit', label: 'Gesprochen mit', hint: 'wer am Telefon war',
    resolve: ctx => clean(ctx.gesprochenMit) },
  { key: 'gespraech_am', label: 'Gesprächsdatum', hint: 'Tag des Telefonats',
    resolve: ctx => (ctx.gespraechAm ? germanDate(ctx.gespraechAm) : null) },
  { key: 'datum', label: 'Datum heute', hint: 'Tag, an dem die Mail rausgeht',
    resolve: (_ctx, today) => germanDate(today) },
];

const BY_KEY = new Map(PLACEHOLDERS.map(p => [p.key, p]));
const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/g;

export interface RenderResult {
  subject: string;
  body: string;
  /** Platzhalter, die im Text stehen, aber keinen Wert haben. */
  missing: string[];
  /** Platzhalter, die es nicht gibt — praktisch immer ein Tippfehler. */
  unknown: string[];
}

/**
 * Setzt die Platzhalter einer Vorlage. `today` ist ein ISO-Datum, damit der
 * Aufrufer die Zeitzone bestimmt statt der Browser des Betrachters.
 */
export function renderTemplate(
  template: { subject: string; body: string },
  ctx: MailContext,
  today: string,
): RenderResult {
  const missing = new Set<string>();
  const unknown = new Set<string>();

  const fill = (text: string) =>
    text.replace(TOKEN, (whole, key: string) => {
      const ph = BY_KEY.get(key);
      if (!ph) {
        unknown.add(key);
        return whole; // stehen lassen — ein Tippfehler soll auffallen
      }
      const value = ph.resolve(ctx, today);
      if (value === null) {
        missing.add(ph.label);
        return `[${ph.label} fehlt]`;
      }
      return value;
    });

  return {
    subject: fill(template.subject),
    body: fill(template.body),
    missing: [...missing],
    unknown: [...unknown],
  };
}
