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

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const widgets = {
    routine: <RoutineWidget />,
    intentions: <IntentionsWidget />,
    tasks: <TaskWidget />,
    calendar: <CalendarWidget />,
    networth: <NetWorthWidget />,
    content: <ContentWidget />,
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
