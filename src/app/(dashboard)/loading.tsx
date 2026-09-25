import { RouteLoading } from '@/components/layout/RouteLoading';

/**
 * Reiter-Wechsel.
 *
 * Next zeigt das hier, solange der Server die nächste Seite baut — und alle
 * Reiter sind `force-dynamic` mit echten Abfragen, da vergeht Zeit. Vorher
 * stand in dieser Zeit einfach die alte Seite und nichts passierte.
 *
 * Bewusst eine Datei für die ganze Gruppe: gäbe es je Reiter eine eigene,
 * müsste man sechs Stellen gleich halten. Die Seitenleiste bleibt stehen, sie
 * gehört zum Layout — nur der Inhaltsbereich wird ersetzt.
 *
 * Kein Zeitgeber: das Ende bestimmt React, indem es die fertige Seite einsetzt.
 */
export default function DashboardLoading() {
  return <RouteLoading />;
}
