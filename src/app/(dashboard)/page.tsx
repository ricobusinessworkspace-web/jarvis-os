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
    <div className="flex flex-col gap-8 pb-16 px-4 md:px-8 pt-4 md:pt-0 max-w-7xl mx-auto w-full">
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* TOP ROW: Wealth & Agenda */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Command Center</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Net Worth & Ledger (2/3 width) */}
          <div className="lg:col-span-2 h-auto lg:h-[380px] min-h-[250px]">
            <NetWorthWidget />
          </div>

          {/* Today's Agenda (1/3 width) */}
          <div className="lg:col-span-1 h-auto lg:h-[380px] min-h-[250px]">
            <CalendarWidget />
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────── */}
      {/* BOTTOM ROW: Execution & Habits */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Execution & Habits</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Tasks */}
          <div className="flex flex-col h-auto lg:h-[500px] min-h-[300px]">
            <TaskWidget />
          </div>

          {/* Content Pipeline */}
          <div className="flex flex-col h-auto lg:h-[500px] min-h-[300px]">
            <ContentWidget />
          </div>

          {/* Habits & Health */}
          <div className="flex flex-col gap-4">
            <FiveAmStreakWidget />
            <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-4 md:p-6 shadow-sm space-y-6 flex-1">
              <RoutineWidget />
              <SleepWidget />
            </div>
          </div>

        </div>
      </section>

      {/* 
        CRM WIDGET HIDDEN AS REQUESTED 
        <CrmWidget /> 
      */}

    </div>
  );
}
