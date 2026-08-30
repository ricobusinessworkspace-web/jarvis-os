import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
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
  const widgets = {
    routine: <Suspense fallback={<WidgetSkeleton />}><RoutineWidget /></Suspense>,
    performance: <Suspense fallback={<WidgetSkeleton />}><PerformanceGraphWidget /></Suspense>,
    avgsleep: <Suspense fallback={<SmallWidgetSkeleton />}><AvgSleepWidget /></Suspense>,
    sleep: <Suspense fallback={<SmallWidgetSkeleton />}><SleepWidget /></Suspense>,
    gtasks: <Suspense fallback={<SmallWidgetSkeleton />}><GoogleTasksWidget /></Suspense>,
    calendar: <Suspense fallback={<SmallWidgetSkeleton />}><CalendarWidget /></Suspense>,
    tasks: <Suspense fallback={<WidgetSkeleton />}><UnifiedTaskWidget /></Suspense>,
  };

  return <DashboardLayoutClient widgets={widgets} />;
}
