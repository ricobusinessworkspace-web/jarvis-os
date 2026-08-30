import { RoutineService } from '@/core/services/RoutineService';
import { Moon } from 'lucide-react';

export default async function AvgSleepWidget() {
  const today = new Date();
  const res = await RoutineService.getPersonalLogs(today);
  const personalLogs = res.personalLogs || [];
  
  // Calculate average sleep hours over last 7 days
  const now = new Date();
  now.setHours(0,0,0,0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentLogs = personalLogs.filter((l: any) => {
    const logDate = new Date(l.date);
    return logDate >= sevenDaysAgo && l.sleepHours && l.sleepHours > 0;
  });
  
  const avgSleep = recentLogs.length > 0 
    ? Math.round((recentLogs.reduce((sum: number, l: any) => sum + l.sleepHours, 0) / recentLogs.length) * 10) / 10
    : 0;
  
  // Color indicator: green >= 7h, yellow 6-7h, red < 6h
  const colorClass = avgSleep >= 7 
    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
    : avgSleep >= 6 
      ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
      : 'text-red-500 bg-red-500/10 border-red-500/20';
  
  const iconBgClass = avgSleep >= 7 
    ? 'bg-emerald-500/10 border-emerald-500/20' 
    : avgSleep >= 6 
      ? 'bg-amber-500/10 border-amber-500/20' 
      : 'bg-red-500/10 border-red-500/20';

  const iconColorClass = avgSleep >= 7 ? 'text-emerald-500' : avgSleep >= 6 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="bg-elevated/30 border border-border/30 rounded-3xl p-5 shadow-sm flex items-center justify-between transition-all hover:bg-elevated/50">
      <div>
        <h3 className="text-[10px] font-black tracking-widest text-muted uppercase mb-1">Ø Schlaf (7 Tage)</h3>
        <div className="text-2xl font-black text-foreground flex items-baseline gap-1.5">
          {avgSleep > 0 ? avgSleep : '–'} <span className="text-xs font-medium text-muted tracking-normal">{avgSleep > 0 ? 'Stunden' : 'Keine Daten'}</span>
        </div>
      </div>
      <div className={`h-10 w-10 rounded-full ${iconBgClass} flex items-center justify-center border`}>
        <Moon className={`h-5 w-5 ${iconColorClass}`} />
      </div>
    </div>
  );
}
