import { Suspense } from 'react';
import { GoalService } from '@/core/services/GoalService';
import { zielbild } from '@/core/services/MotivationService';
import { GoalsEditor } from '@/components/goals/GoalsEditor';
import { Zielbild } from '@/components/goals/Zielbild';
import { ToeneSchalter } from '@/components/goals/ToeneSchalter';
import { RouteLoading } from '@/components/layout/RouteLoading';

export const dynamic = 'force-dynamic';

/**
 * Ziele als Zielbild: erst wohin (Reise, Ergebnis), dann wie (Ketten), dann
 * was schon erreicht ist (Rekordwand). Die Einstellungen stehen eingeklappt
 * unten — sie ändern sich selten, das Zielbild soll man jeden Tag sehen.
 */
async function Ziele() {
  // Nacheinander — eine Pooler-Verbindung (siehe Dashboard).
  const bild = await zielbild();
  const data = await GoalService.getGoalsPage();

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Ziele</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">Wohin es geht, wie weit du bist und was du schon geschafft hast.</p>

      <Zielbild daten={bild} />

      <details className="crm-card group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold tracking-tight">
          Einstellungen
          <span className="text-[11px] font-normal text-muted group-open:hidden">Ziele, Toleranzen, Töne</span>
        </summary>
        <p className="text-[12px] text-muted">
          Eine Änderung gilt ab heute — vergangene Tage behalten das Ziel, das damals galt.
        </p>
        <GoalsEditor data={data} />
        <ToeneSchalter />
      </details>
    </>
  );
}

// Grenze außen, siehe Dashboard.
export default function ZielePage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
        <Ziele />
      </div>
    </Suspense>
  );
}
