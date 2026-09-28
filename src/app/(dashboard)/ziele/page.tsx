import { Suspense } from 'react';
import { GoalService } from '@/core/services/GoalService';
import { GoalsEditor } from '@/components/goals/GoalsEditor';
import { RouteLoading } from '@/components/layout/RouteLoading';

export const dynamic = 'force-dynamic';

async function Ziele() {
  const data = await GoalService.getGoalsPage();

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Ziele</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        Eine Änderung gilt ab heute — vergangene Tage behalten das Ziel, das damals galt.
      </p>
      <GoalsEditor data={data} />
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
