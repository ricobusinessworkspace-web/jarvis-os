import { RoutineService } from '@/core/services/RoutineService';
import { Sun } from 'lucide-react';
import type { PersonalLog } from '@/types';

function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

export default async function FiveAmStreakWidget() {
  const today = new Date();
  const res = await RoutineService.getPersonalLogs(today);
  const personalLogs = res.personalLogs || [];
  
  let streak = 0;
  today.setHours(0,0,0,0);
  
  const currentDate = new Date(today);
  
  const getLogForDate = (dateStr: string) => {
    return personalLogs.find((l: any) => l.date === dateStr);
  };
  
  const localTodayStr = getLocalDateString(today);
  const localTodayLog = getLogForDate(localTodayStr);
  
  if (localTodayLog && localTodayLog.wakeTime) {
    const [h, m] = localTodayLog.wakeTime.split(':').map(Number);
    if (h < 5 || (h === 5 && m === 0)) {
      streak++;
    } else {
      streak = 0;
    }
  }
  
  if (streak > 0 || (localTodayLog && !localTodayLog.wakeTime)) {
    // If today is successful OR not filled yet, check previous days
    currentDate.setDate(currentDate.getDate() - 1);
    while (true) {
      const dateStr = getLocalDateString(currentDate);
      const log = getLogForDate(dateStr);
      
      if (!log || !log.wakeTime) {
        break;
      }
      
      const [h, m] = log.wakeTime.split(':').map(Number);
      if (h < 5 || (h === 5 && m === 0)) {
        streak++;
      } else {
        break;
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }
  }

  return (
    <div className="bg-orange-500/10 backdrop-blur-md border border-orange-500/20 rounded-2xl p-5 shadow-sm flex items-center justify-between transition-all hover:bg-orange-500/15">
      <div>
        <h3 className="text-[10px] font-black tracking-widest text-orange-400 uppercase opacity-80 mb-0.5">5 AM Streak</h3>
        <div className="text-3xl font-black text-orange-400">
          {streak} <span className="text-xs font-bold opacity-70 tracking-normal">Tage in Folge</span>
        </div>
      </div>
      <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.2)]">
        <Sun className="h-6 w-6 text-orange-400" />
      </div>
    </div>
  );
}
