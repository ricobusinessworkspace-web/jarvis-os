'use client';

import { useState } from 'react';
import { Moon, Clock } from 'lucide-react';
import { savePersonalLog } from '@/actions/dashboard';
import type { PersonalLog } from '@/types';

interface Props {
  initialPersonalLogs: any[];
  initialTodayLog: any | null;
}

function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

export function SleepClient({ initialTodayLog }: Props) {
  const [todayLog, setTodayLog] = useState(initialTodayLog || { date: getLocalDateString(), sleepHours: 0, bedTime: '', wakeTime: '' });
  const todayStr = getLocalDateString();

  const handleSleepTimeChange = async (field: 'bedTime' | 'wakeTime', value: string) => {
    const updatedLog = { ...todayLog, [field]: value };
    
    // Calculate sleep duration if both times are present
    if (updatedLog.bedTime && updatedLog.wakeTime) {
      const [bH, bM] = updatedLog.bedTime.split(':').map(Number);
      const [wH, wM] = updatedLog.wakeTime.split(':').map(Number);
      
      let sleepMinutes = (wH * 60 + wM) - (bH * 60 + bM);
      if (sleepMinutes < 0) sleepMinutes += 24 * 60; // Crosses midnight
      
      updatedLog.sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;
    }
    
    setTodayLog(updatedLog);
    await savePersonalLog({ date: todayStr, [field]: value });
  };

  return (
    <div className="bg-elevated/30 border border-border/30 rounded-3xl p-5 shadow-sm space-y-4">
      <h3 className="text-base font-bold tracking-tight flex items-center gap-3">
        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
          <Moon className="h-5 w-5" />
        </div>
        Schlaf
      </h3>
      
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">Bettzeit</label>
          <input
            type="time"
            value={todayLog.bedTime || ''}
            onChange={(e) => handleSleepTimeChange('bedTime', e.target.value)}
            className="w-full bg-background border border-border/50 rounded-xl text-sm py-2.5 px-3 text-foreground focus:border-purple-500 outline-none shadow-sm transition-all active:scale-[0.97]"
          />
        </div>
        
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">Aufgestanden</label>
          <input
            type="time"
            value={todayLog.wakeTime || ''}
            onChange={(e) => handleSleepTimeChange('wakeTime', e.target.value)}
            className="w-full bg-background border border-border/50 rounded-xl text-sm py-2.5 px-3 text-foreground focus:border-purple-500 outline-none shadow-sm transition-all active:scale-[0.97]"
          />
        </div>
      </div>

      {todayLog.sleepHours > 0 && (
        <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Schlafdauer</span>
          </div>
          <div className="text-xl font-black text-purple-400">
            {todayLog.sleepHours} <span className="text-sm font-bold opacity-70">h</span>
          </div>
        </div>
      )}
    </div>
  );
}
