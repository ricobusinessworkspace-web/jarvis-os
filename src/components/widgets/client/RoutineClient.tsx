'use client';

import { useState, useMemo } from 'react';
import { Sun, Moon, CheckCircle, Pencil, Check, X } from 'lucide-react';
import { logTrackerItem, updateTrackerItem } from '@/actions/dashboard';

interface Props {
  initialTrackers: any[];
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

export function RoutineClient({ initialTrackers }: Props) {
  const [editingRoutineItem, setEditingRoutineItem] = useState<{ trackerId: string; itemId: string } | null>(null);
  const [routineEditTitle, setRoutineEditTitle] = useState('');
  
  const todayStr = getLocalDateString();
  const currentWeekStrs = useMemo(() => getCurrentWeekDates(0), []);

  const handleToggleRoutineLog = async (trackerId: string, itemId: string, dateStr: string, isDone: boolean) => {
    const newStatus = isDone ? 'not_done' : 'completed';
    await logTrackerItem(itemId, newStatus, dateStr);
  };

  const saveRoutineItemEdit = async (trackerId: string, itemId: string) => {
    const title = routineEditTitle.trim();
    if (!title) return;
    await updateTrackerItem(itemId, { title });
    setEditingRoutineItem(null);
  };

  const renderWeeklyRoutineTable = (tracker: any) => {
    if (!tracker) return null;
    const isMorning = tracker.name.toLowerCase().includes('morgen');
    const Icon = isMorning ? Sun : Moon;
    
    return (
      <div className="bg-elevated/30 border border-border/30 rounded-2xl p-4 shadow-sm space-y-3 overflow-x-auto">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5 pb-1">
          <Icon className={`h-4 w-4 ${isMorning ? 'text-amber-400' : 'text-indigo-400'}`} /> {tracker.name}
        </h3>
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr>
              <th className="py-1 px-2 border-b border-border/20 text-[11px] text-muted font-semibold w-1/3">Item</th>
              {WEEK_DAYS.map((day, i) => (
                <th key={day} className={`py-1 px-2 border-b border-border/20 text-[11px] font-semibold text-center ${currentWeekStrs[i] === todayStr ? 'text-accent' : 'text-muted'}`}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracker.items.map((item: any) => (
              <tr key={item.id} className="hover:bg-overlay/10 transition-colors group">
                <td className="py-1.5 px-2 border-b border-border/10 text-xs font-medium text-foreground w-1/3">
                  {editingRoutineItem?.itemId === item.id ? (
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        value={routineEditTitle} 
                        onChange={(e) => setRoutineEditTitle(e.target.value)} 
                        className="bg-elevated border border-border rounded px-2 py-0.5 text-[11px] text-foreground focus:border-accent outline-none w-full"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRoutineItemEdit(tracker.id, item.id);
                          if (e.key === 'Escape') setEditingRoutineItem(null);
                        }}
                      />
                      <button onClick={() => saveRoutineItemEdit(tracker.id, item.id)} className="text-accent hover:text-accent-hover shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingRoutineItem(null)} className="text-muted hover:text-foreground shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.title}</span>
                      <button 
                        onClick={() => {
                          setEditingRoutineItem({ trackerId: tracker.id, itemId: item.id });
                          setRoutineEditTitle(item.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-opacity p-0.5"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </td>
                {currentWeekStrs.map(dateStr => {
                  const isDone = item.logs.some((l: any) => {
                    const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
                    return lDate === dateStr && l.status === 'completed';
                  });
                  return (
                    <td key={dateStr} className="py-1.5 px-2 border-b border-border/10 text-center">
                      <button onClick={() => handleToggleRoutineLog(tracker.id, item.id, dateStr, isDone)} className="flex items-center justify-center w-full">
                        {isDone ? <CheckCircle className="h-4 w-4 text-accent inline-block" /> : <div className="h-4 w-4 rounded-full border border-muted/30 inline-block" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const morningTracker = initialTrackers.find(t => t.name.toLowerCase().includes('morgen'));
  const eveningTracker = initialTrackers.find(t => t.name.toLowerCase().includes('abend'));

  return (
    <>
      {renderWeeklyRoutineTable(morningTracker)}
      {renderWeeklyRoutineTable(eveningTracker)}
    </>
  );
}
