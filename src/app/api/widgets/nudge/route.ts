import { NextResponse } from 'next/server';
import { erinnerung } from '@/core/services/MotivationService';
import { checkWidgetAuth, widgetAuthResponse } from '@/lib/widgetAuth';

/**
 * Erinnerung für den Kurzbefehl „Jarvis Erinnerung" — statt Web Push.
 *
 *   GET /api/widgets/nudge
 *   Authorization: Bearer <WIDGET_SECRET_TOKEN>   (oder ?token=…)
 *
 * Antwort `{ zeigen, titel, text }`, fertig formuliert aus derselben Matrix
 * wie das Dashboard (`erinnerungWaehlen`). Ist alles erledigt, kommt
 * `zeigen: false` und der Kurzbefehl zeigt nichts. Im Kurzbefehl steht keine
 * Logik — sonst stünde sie ein zweites Mal, auf Ricos Telefon, ungeprüft.
 * Einrichtung: `docs/apple-shortcuts.md`.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = widgetAuthResponse(checkWidgetAuth(request));
  if (denied) return denied;

  try {
    return NextResponse.json(await erinnerung(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[widgets/nudge]', error instanceof Error ? error.name : 'unbekannt');
    // Lieber keine Mitteilung als eine falsche.
    return NextResponse.json({ zeigen: false, titel: '', text: '' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
