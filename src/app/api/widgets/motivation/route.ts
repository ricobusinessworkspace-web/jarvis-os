import { NextResponse } from 'next/server';
import { widgetStand } from '@/core/services/MotivationService';
import { getBerlinDateStr, getBerlinHour } from '@/lib/dateUtils';
import { isOffDay } from '@/lib/blocks';
import { checkWidgetAuth, widgetAuthResponse } from '@/lib/widgetAuth';

/**
 * Ringe + Serien für das iPhone-Widget (`scriptable/jarvis-ringe.js`).
 *
 *   GET /api/widgets/motivation
 *   Authorization: Bearer <WIDGET_SECRET_TOKEN>   (oder ?token=…)
 *
 * Zahlen und Texte kommen fertig aus `widgetStand()` — dieselbe Matrix wie
 * „Heute". Im Skript wird nichts gerechnet und nichts formuliert.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = widgetAuthResponse(checkWidgetAuth(request));
  if (denied) return denied;

  try {
    const today = getBerlinDateStr();
    const hour = getBerlinHour();
    const offDay = isOffDay(today);
    return NextResponse.json(
      {
        ok: true,
        date: today,
        generatedAt: new Date().toISOString(),
        offDay,
        ...(await widgetStand(today)),
        // Tagsüber kurz, nachts lang — iOS deckelt die Aktualisierungen pro Tag.
        refreshAfterSeconds: hour >= 6 && hour < 23 ? 600 : 3600,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[widgets/motivation]', error instanceof Error ? error.name : 'unbekannt');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
