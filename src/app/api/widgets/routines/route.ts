import { NextResponse } from 'next/server';
import { RoutineService } from '@/core/services/RoutineService';
import { checkWidgetAuth, widgetAuthResponse } from '@/lib/widgetAuth';

/**
 * Routine des Tages fürs iPhone-Widget.
 *
 *   GET /api/widgets/routines
 *   Authorization: Bearer <WIDGET_SECRET_TOKEN>
 *
 * Welche Routine gezeigt wird, entscheidet das Widget anhand der Uhrzeit — der
 * Endpunkt liefert alle Schritte des Tages und filtert nicht vor.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = widgetAuthResponse(checkWidgetAuth(request));
  if (denied) return denied;

  try {
    const { routines, error } = await RoutineService.getTodayRoutines();

    if (error) {
      return NextResponse.json({ error }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const items = routines ?? [];
    const completed = items.filter(r => r.status === 'completed');
    const pending = items.filter(r => r.status !== 'completed' && r.status !== 'skipped');

    return NextResponse.json(
      {
        success: true,
        data: {
          total: items.length,
          completed: completed.length,
          pending: pending.length,
          items,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[widgets/routines]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
