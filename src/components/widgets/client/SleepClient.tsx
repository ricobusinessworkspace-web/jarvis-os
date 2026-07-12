'use client';

import { useState, useMemo } from 'react';
import { Moon } from 'lucide-react';
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

function getCurrentWeekDates(offsetWeeks = 0) {
  const now = new Date();
  now.setDate(now.getDate() + (offsetWeeks * 7));
  const dayOfWeek = now.getDay() || 7; 
  
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWeek + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
}

const WEEK_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function SleepClient({ initialPersonalLogs, initialTodayLog }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [personalLogs, setPersonalLogs] = useState(initialPersonalLogs);
  const [todayLog, setTodayLog] = useState(initialTodayLog);

  const todayStr = getLocalDateString();
  const currentWeekStrs = useMemo(() => getCurrentWeekDates(weekOffset), [weekOffset]);

  const getLogForDate = (dateStr: string) => {
    if (dateStr === todayStr && todayLog) return todayLog;
    return personalLogs.find(l => l.date === dateStr) || { date: dateStr, sleepHours: 0, bedTime: '', wakeTime: '' };
  };

  const handleSleepTimeChange = async (dateStr: string, field: 'bedTime' | 'wakeTime', value: string) => {
    // Optimistic UI update
    if (dateStr === todayStr && todayLog) {
      setTodayLog({ ...todayLog, [field]: value });
    } else {
      setPersonalLogs(prev => {
        const existing = prev.find(l => l.date === dateStr);
        if (existing) {
          return prev.map(l => l.date === dateStr ? { ...l, [field]: value } : l);
        } else {
          return [...prev, { date: dateStr, sleepHours: 0, bedTime: '', wakeTime: '', [field]: value }];
        }
      });
    }

    await savePersonalLog({ date: dateStr, [field]: value });
  };

  return (
    <div className="bg-background/40 border border-border/20 rounded-2xl p-4 overflow-x-auto">
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <Moon className="h-4 w-4 text-purple-400" /> Schlaf Tracking
        </h3>
        <div className="flex items-center gap-2 bg-overlay/30 p-1 rounded-lg">
          <button 
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="px-2 py-1 rounded-md hover:bg-overlay/50 text-muted hover:text-foreground transition-colors flex items-center"
          >
            ◀
          </button>
          <span className="text-xs font-bold text-foreground w-24 text-center">
            {weekOffset === 0 ? 'Diese Woche' : weekOffset === -1 ? 'Letzte Woche' : `${Math.abs(weekOffset)} W. zurück`}
          </span>
          <button 
            onClick={() => setWeekOffset(prev => prev + 1)}
            disabled={weekOffset >= 0}
            className={`px-2 py-1 rounded-md transition-colors flex items-center ${weekOffset >= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-overlay/50 text-muted hover:text-foreground'}`}
          >
            ▶
          </button>
        </div>
      </div>
      <table className="w-full text-center border-collapse min-w-[600px]">
        <thead>
          <tr>
            {WEEK_DAYS.map((day, i) => (
              <th key={day} className={`py-2 px-1 border-b border-border/20 text-[11px] font-bold ${currentWeekStrs[i] === todayStr ? 'text-accent' : 'text-muted'}`}>
                {day}<br/><span className="text-[10px] opacity-60 font-medium">{currentWeekStrs[i].slice(5)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {currentWeekStrs.map(dateStr => {
              const log = getLogForDate(dateStr);
              return (
                <td key={dateStr} className="py-3 px-1 align-top">
                  <div className="flex flex-col gap-2.5 items-center">
                    <div className="flex flex-col gap-1 items-center w-full max-w-[80px]">
                      <span className="text-[9px] text-muted font-black uppercase tracking-wider">Bett</span>
                      <input
                        type="time"
                        value={log.bedTime || ''}
                        onChange={(e) => handleSleepTimeChange(dateStr, 'bedTime', e.target.value)}
                        className="w-full bg-elevated border border-border/50 rounded-lg text-xs py-1.5 px-1 text-foreground focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-center shadow-inner transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1 items-center w-full max-w-[80px]">
                      <span className="text-[9px] text-muted font-black uppercase tracking-wider">Wach</span>
                      <input
                        type="time"
                        value={log.wakeTime || ''}
                        onChange={(e) => handleSleepTimeChange(dateStr, 'wakeTime', e.target.value)}
                        className="w-full bg-elevated border border-border/50 rounded-lg text-xs py-1.5 px-1 text-foreground focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-center shadow-inner transition-all"
                      />
                    </div>
                    {log.sleepHours > 0 && (
                      <div className="text-xs font-black text-purple-400 mt-1 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {log.sleepHours}h
                      </div>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
