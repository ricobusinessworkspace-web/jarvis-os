import { NextResponse } from 'next/server';
import { heuteUndWoche, type HeuteUndWoche } from '@/core/services/WochenService';
import { getBerlinHour } from '@/lib/dateUtils';
import { checkWidgetAuth, widgetAuthResponse } from '@/lib/widgetAuth';

/**
 * Daten für beide iPhone-Widgets („Jarvis Heute", „Jarvis Calls").
 *
 *   GET /api/widgets/heute
 *   Authorization: Bearer <WIDGET_SECRET_TOKEN>   (oder ?token=…)
 *
 * Zahlen, Zustände und Sätze kommen fertig aus `heuteUndWoche()` — dieselbe
 * Matrix wie das Dashboard. In den Scriptable-Skripten wird nichts gerechnet
 * und nichts formuliert; sonst stünden Ziele ein zweites Mal im Code, auf
 * Ricos Telefon, ungeprüft. Ein Tag, der noch läuft, ist dort nie rot.
 */
export const dynamic = 'force-dynamic';

const zahl = (n: number | null) => (n === null ? '–' : n.toLocaleString('de-DE'));

function texte(d: HeuteUndWoche) {
  const calls = d.heute.kacheln.find(k => k.key === 'sales.calls_count')!;
  const w = d.woche;
  const rest = w.tageUebrig === 0 ? 'Woche vorbei' : `${w.tageUebrig} ${w.tageUebrig === 1 ? 'Tag' : 'Tage'} übrig`;
  return {
    heute: `${d.heute.erledigt} von ${d.heute.gesamt} erledigt`,
    calls: `${zahl(calls.wert)} / ${zahl(calls.basis)}`,
    callsZiel: calls.basis === null ? 'kein Ziel' : `Basis ${zahl(calls.basis)} · Soll ${zahl(calls.soll)}`,
    woche: `${zahl(w.calls.ist)} / ${zahl(w.calls.basis)}`,
    wocheRest: w.calls.proTag ? `${rest} · noch ${w.calls.proTag} pro Tag` : w.calls.basis !== null && w.calls.ist >= w.calls.basis ? `${rest} · Basis erreicht` : rest,
  };
}

export async function GET(request: Request) {
  const denied = widgetAuthResponse(checkWidgetAuth(request));
  if (denied) return denied;

  try {
    const d = await heuteUndWoche();
    const hour = getBerlinHour();
    return NextResponse.json(
      {
        ok: true,
        ...d,
        texte: texte(d),
        // Tagsüber kurz, nachts lang — iOS deckelt die Aktualisierungen pro Tag.
        refreshAfterSeconds: hour >= 6 && hour < 23 ? 600 : 3600,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[widgets/heute]', error instanceof Error ? error.name : 'unbekannt');
    return NextResponse.json({ error: 'Jarvis gerade nicht erreichbar' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
