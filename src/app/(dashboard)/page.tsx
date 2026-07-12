import CalendarWidget from '@/components/widgets/CalendarWidget';
import TaskWidget from '@/components/widgets/TaskWidget';
import CrmWidget from '@/components/widgets/CrmWidget';
import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import FiveAmStreakWidget from '@/components/widgets/FiveAmStreakWidget';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-10 pb-16 max-w-7xl mx-auto w-full">
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 1: DAILY FOCUS */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Daily Focus</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Today's Agenda */}
          <div className="h-full">
            <CalendarWidget />
          </div>

          {/* Today's Tasks */}
          <div className="h-full">
            <TaskWidget />
          </div>

          {/* KPIs: 5 AM Streak & Sales Engine */}
          <div className="flex flex-col gap-6">
            <FiveAmStreakWidget />
            <CrmWidget />
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 2: HABIT & HEALTH TRACKING */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Habit & Health Tracking</h2>
        
        <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-6 shadow-sm space-y-6">
          <RoutineWidget />
          <SleepWidget />
        </div>
      </section>

    </div>
  );
}
