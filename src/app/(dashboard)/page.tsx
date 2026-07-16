import CalendarWidget from '@/components/widgets/CalendarWidget';
import TaskWidget from '@/components/widgets/TaskWidget';
import CrmWidget from '@/components/widgets/CrmWidget';
import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import FiveAmStreakWidget from '@/components/widgets/FiveAmStreakWidget';
import ContentWidget from '@/components/widgets/ContentWidget';
import NetWorthWidget from '@/components/widgets/NetWorthWidget';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-10 pb-16 px-4 md:px-8 pt-4 md:pt-0 max-w-7xl mx-auto w-full">
      
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

          {/* Today's Tasks & Content */}
          <div className="flex flex-col gap-6 h-full">
            <TaskWidget />
            <ContentWidget />
          </div>

          {/* KPIs: 5 AM Streak & Sales Engine */}
          <div className="flex flex-col gap-6">
            <FiveAmStreakWidget />
            <CrmWidget />
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 2: WEALTH & FINANCE */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Wealth & Finance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 h-[280px]">
            <NetWorthWidget />
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 3: HABIT & HEALTH TRACKING */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Habit & Health Tracking</h2>
        
        <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-4 md:p-6 shadow-sm space-y-6">
          <RoutineWidget />
          <SleepWidget />
        </div>
      </section>

    </div>
  );
}
