
import CalendarWidget from '@/components/widgets/CalendarWidget';
import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import AvgSleepWidget from '@/components/widgets/AvgSleepWidget';
import GoogleTasksWidget from '@/components/widgets/GoogleTasksWidget';
import PerformanceGraphWidget from '@/components/widgets/PerformanceGraphWidget';
import UnifiedTaskWidget from '@/components/widgets/UnifiedTaskWidget';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function WidgetSkeleton() {
  return <div className="w-full h-full min-h-[300px] bg-elevated/30 border border-border/30 rounded-3xl animate-pulse" />;
}

function SmallWidgetSkeleton() {
  return <div className="w-full h-full min-h-[80px] bg-elevated/30 border border-border/30 rounded-3xl animate-pulse" />;
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col pb-16 px-4 md:px-8 pt-6 max-w-7xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Overview</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="col-span-1 min-h-[350px]">
          <Suspense fallback={<WidgetSkeleton />}><RoutineWidget /></Suspense>
        </div>
        <div className="col-span-1 min-h-[350px]">
          <Suspense fallback={<WidgetSkeleton />}><PerformanceGraphWidget /></Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="col-span-1 min-h-[350px]">
          <Suspense fallback={<WidgetSkeleton />}><CalendarWidget /></Suspense>
        </div>
        <div className="col-span-1 min-h-[350px]">
          <Suspense fallback={<WidgetSkeleton />}><UnifiedTaskWidget /></Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 h-full">
          <Suspense fallback={<SmallWidgetSkeleton />}><AvgSleepWidget /></Suspense>
        </div>
        <div className="col-span-1 h-full">
          <Suspense fallback={<SmallWidgetSkeleton />}><SleepWidget /></Suspense>
        </div>
        <div className="col-span-1 h-full">
          <Suspense fallback={<SmallWidgetSkeleton />}><GoogleTasksWidget /></Suspense>
        </div>
      </div>
    </div>
  );
}
