import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import TaskWidget from '@/components/widgets/TaskWidget';
import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import FiveAmStreakWidget from '@/components/widgets/FiveAmStreakWidget';
import ContentWidget from '@/components/widgets/ContentWidget';
import NetWorthWidget from '@/components/widgets/NetWorthWidget';
import WeightWidget from '@/components/widgets/WeightWidget';
import IntentionsWidget from '@/components/widgets/IntentionsWidget';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function WidgetSkeleton() {
  return <div className="w-full h-full min-h-[300px] bg-elevated/30 border border-border/30 rounded-3xl animate-pulse" />;
}

export default function DashboardPage() {
  const widgets = {
    routine: <Suspense fallback={<WidgetSkeleton />}><RoutineWidget /></Suspense>,
    intentions: <Suspense fallback={<WidgetSkeleton />}><IntentionsWidget /></Suspense>,
    tasks: <Suspense fallback={<WidgetSkeleton />}><TaskWidget /></Suspense>,
    calendar: <Suspense fallback={<WidgetSkeleton />}><CalendarWidget /></Suspense>,
    networth: <Suspense fallback={<WidgetSkeleton />}><NetWorthWidget /></Suspense>,
    content: <Suspense fallback={<WidgetSkeleton />}><ContentWidget /></Suspense>,
    health: (
      <div className="flex flex-col gap-6 h-full">
        <div className="h-auto"><FiveAmStreakWidget /></div>
        <div className="h-auto"><SleepWidget /></div>
        <div className="h-auto"><WeightWidget /></div>
      </div>
    ),
  };

  return <DashboardLayoutClient widgets={widgets} />;
}
