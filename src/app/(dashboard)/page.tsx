import CalendarWidget from '@/components/widgets/CalendarWidget';
import TaskWidget from '@/components/widgets/TaskWidget';
import CrmWidget from '@/components/widgets/CrmWidget';
import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import FiveAmStreakWidget from '@/components/widgets/FiveAmStreakWidget';
import ContentWidget from '@/components/widgets/ContentWidget';
import NetWorthWidget from '@/components/widgets/NetWorthWidget';
import WeightWidget from '@/components/widgets/WeightWidget';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="flex flex-col pb-16 px-4 md:px-8 pt-4 md:pt-0 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ───────────────────────────────────────────────────────── */}
        {/* LEFT COLUMN: THE ENGINE (50%) */}
        {/* ───────────────────────────────────────────────────────── */}
        <section className="space-y-4 flex flex-col">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> The Engine
          </h2>
          
          <div className="flex flex-col gap-6 flex-1">
            <FiveAmStreakWidget />
            
            <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-4 md:p-8 shadow-sm space-y-8 flex-1 flex flex-col">
              <RoutineWidget />
              <div className="w-full h-px bg-border/30 my-4" />
              <SleepWidget />
            </div>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────── */}
        {/* RIGHT COLUMN: THE BUSINESS (50%) */}
        {/* ───────────────────────────────────────────────────────── */}
        <section className="space-y-4 flex flex-col">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">The Business</h2>
          
          <div className="flex flex-col gap-6">
            
            {/* Finance & Wealth */}
            <div className="h-auto min-h-[350px]">
              <NetWorthWidget />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agenda */}
              <div className="h-[400px]">
                <CalendarWidget />
              </div>
              
              {/* Tasks */}
              <div className="h-[400px]">
                <TaskWidget />
              </div>
            </div>

            {/* Content Pipeline & Weight Tracker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-[400px]">
                <ContentWidget />
              </div>
              <div className="h-[400px]">
                <WeightWidget />
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
