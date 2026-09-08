import { revalidatePath } from 'next/cache';

/**
 * Seiten, die Tages- und Metrikdaten anzeigen.
 *
 * Bewusst **nicht** `revalidatePath('/', 'layout')`: das verwirft zusätzlich
 * das Dashboard-Layout und lässt dessen Abfragen bei jedem Häkchen erneut
 * laufen. Zusammen mit dem Pooler-Limit von einer Verbindung wurde daraus
 * eine spürbare Hängepartie pro Klick.
 *
 * Mehrere Pfade zu markieren ist billig — nur die gerade offene Seite rendert
 * sofort neu, der Rest wird beim nächsten Besuch geholt.
 */
const TRACKING_PATHS = ['/', '/verlauf', '/health', '/vertrieb', '/routines'];

export function revalidateTracking() {
  for (const path of TRACKING_PATHS) revalidatePath(path);
}
