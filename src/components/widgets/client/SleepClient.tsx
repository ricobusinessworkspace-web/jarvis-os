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
    <div className="crm-card h-full justify-between">
      <div className="crm-header">
        <h3 className="crm-title">
          <Moon className="h-4 w-4 text-purple-500" /> Schlaf
        </h3>
      </div>
      
      <div className="flex items-center gap-3 mt-auto">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Bettzeit</label>
          <input
            type="time"
            value={todayLog.bedTime || ''}
            onChange={(e) => handleSleepTimeChange('bedTime', e.target.value)}
            className="w-full bg-background border border-border/50 rounded-xl text-sm py-2 px-3 text-foreground focus:border-purple-500 outline-none shadow-sm transition-all"
          />
        </div>
        
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Aufgestanden</label>
          <input
            type="time"
            value={todayLog.wakeTime || ''}
            onChange={(e) => handleSleepTimeChange('wakeTime', e.target.value)}
            className="w-full bg-background border border-border/50 rounded-xl text-sm py-2 px-3 text-foreground focus:border-purple-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {todayLog.sleepHours > 0 && (
        <div className="crm-stat-card border-purple-500/20 bg-purple-500/10 !p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Schlafdauer
          </span>
          <span className="text-xl font-black text-purple-400 mt-0.5">
            {todayLog.sleepHours} <span className="text-xs">h</span>
          </span>
        </div>
      )}
    </div>
  );
}
