import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function MobileRoutinePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background p-4 md:p-8 max-w-md mx-auto w-full">
      <div className="flex items-center mb-6 pt-4">
        <Link href="/" className="p-2.5 -ml-2 rounded-xl bg-elevated/40 border border-border/30 text-muted hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black ml-4 tracking-tight">Daily Habits</h1>
      </div>
      
      <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-5 shadow-sm space-y-8 flex-1">
        <RoutineWidget />
        
        <div className="w-full h-px bg-border/30" />
        
        <SleepWidget />
      </div>
    </div>
  );
}
