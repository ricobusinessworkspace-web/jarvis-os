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
    <div className="flex flex-col pb-16 px-4 md:px-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
        
        {/* ───────────────────────────────────────────────────────── */}
        {/* LEFT COLUMN: THE ENGINE */}
        {/* ───────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground/60 uppercase pl-1">
            The Engine
          </h2>
          
          {/* Note: For Apple-like interaction, consider adding `active:scale-[0.97] transition-transform` to the individual widget cards in their own components. */}
          <div className="flex flex-col gap-6">
            <div className="h-auto">
              <FiveAmStreakWidget />
            </div>
            
            <div className="h-auto min-h-[300px]">
              <RoutineWidget />
            </div>
            
            <div className="h-auto min-h-[300px]">
              <SleepWidget />
            </div>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────── */}
        {/* RIGHT COLUMN: THE BUSINESS */}
        {/* ───────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground/60 uppercase pl-1">
            The Business
          </h2>
          
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
