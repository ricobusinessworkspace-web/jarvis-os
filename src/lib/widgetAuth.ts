import { NextResponse } from 'next/server';

/**
 * Zugang für die iPhone-Widgets.
 *
 * Ein Secret für alle Widget-Endpunkte, aus `WIDGET_SECRET_TOKEN`. **Ohne
 * gesetzte Variable nimmt kein Endpunkt etwas an** — einen im Code
 * hinterlegten Standardwert gibt es bewusst nicht: das Repository ist
 * öffentlich, ein Standard-Token wäre kein Schutz, sondern nur die Behauptung
 * eines Schutzes.
 *
 * Die Kopfzeile ist der vorgesehene Weg, `?token=` die Rückfalltür — Scriptable
 * tut sich je nach Zusammenhang mit Kopfzeilen schwer. Query-Parameter landen
 * allerdings in Server-Logs, deshalb nicht die erste Wahl.
 */

export type WidgetAuth = 'ok' | 'unauthorized' | 'unconfigured';

export function checkWidgetAuth(request: Request): WidgetAuth {
  const secret = process.env.WIDGET_SECRET_TOKEN;
  if (!secret) return 'unconfigured';

  const [scheme, bearer] = (request.headers.get('authorization') ?? '').split(' ');
  const token =
    scheme?.toLowerCase() === 'bearer'
      ? bearer
      : new URL(request.url).searchParams.get('token') ?? '';

  return token === secret ? 'ok' : 'unauthorized';
}

/** Die Antwort zu einem abgelehnten Zugang — oder `null`, wenn er in Ordnung ist. */
export function widgetAuthResponse(auth: WidgetAuth): NextResponse | null {
  if (auth === 'ok') return null;
  if (auth === 'unconfigured') {
    return NextResponse.json(
      { error: 'WIDGET_SECRET_TOKEN ist nicht gesetzt' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}
