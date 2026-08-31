'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Check, X, Pencil, Flame } from 'lucide-react';
import { logTrackerItem, updateTrackerItem } from '@/actions/dashboard';
import StreakStatsPopover from '@/components/ui/StreakStatsPopover';

interface Props {
  initialTrackers: any[];
}

function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

function calculateStreak(item: any, todayStr: string) {
  let streak = 0;
  const todayDate = new Date(todayStr);
  
  const getLogStatus = (dateStr: string) => {
    const log = item.logs.find((l: any) => {
      const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
      return lDate === dateStr;
    });
    return log ? log.status : null;
  };

  const todayStatus = getLogStatus(todayStr);
  
  if (todayStatus === 'completed') {
    streak++;
  } else if (todayStatus === 'not_done') {
    return 0;
  }
  
  let d = new Date(todayDate);
  d.setDate(d.getDate() - 1);
  while (true) {
    const dateStr = getLocalDateString(d);
    const status = getLogStatus(dateStr);
    
    if (status === 'completed') {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function RoutineClient({ initialTrackers }: Props) {
  const [trackers, setTrackers] = useState(initialTrackers);
  
  // Auto switch based on time, morning if < 14:00
  const currentHour = new Date().getHours();
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>(currentHour < 14 ? 'morning' : 'evening');

  useEffect(() => {
    setTrackers(initialTrackers);
  }, [initialTrackers]);

  const [editingRoutineItem, setEditingRoutineItem] = useState<{ trackerId: string; itemId: string } | null>(null);
  const [routineEditTitle, setRoutineEditTitle] = useState('');
  
  const todayStr = getLocalDateString();

  const handleToggleRoutineLog = async (trackerId: string, itemId: string, isDone: boolean) => {
    const newStatus = isDone ? 'not_done' : 'completed';
    
    setTrackers(prev => prev.map(t => {
      if (t.id === trackerId) {
        return {
          ...t,
          items: t.items.map((item: any) => {
            if (item.id === itemId) {
              const logs = [...item.logs];
              const logIndex = logs.findIndex(l => {
                const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
                return lDate === todayStr;
              });
              
              if (logIndex >= 0) {
                logs[logIndex] = { ...logs[logIndex], status: newStatus };
              } else {
                logs.push({ date: todayStr, status: newStatus });
              }
              return { ...item, logs };
            }
            return item;
          })
        };
      }
      return t;
    }));

    await logTrackerItem(itemId, newStatus, todayStr);
  };

  const saveRoutineItemEdit = async (trackerId: string, itemId: string) => {
    const title = routineEditTitle.trim();
    if (!title) return;
    
    setTrackers(prev => prev.map(t => {
      if (t.id === trackerId) {
        return { ...t, items: t.items.map((item: any) => item.id === itemId ? { ...item, title } : item) };
      }
      return t;
    }));
    setEditingRoutineItem(null);

    await updateTrackerItem(itemId, { title });
  };

  const renderTracker = (tracker: any) => {
    if (!tracker) return null;
    const isMorning = tracker.name.toLowerCase().includes('morgen');
    const Icon = isMorning ? Sun : Moon;
    const totalItems = tracker.items.length;
    
    const completedItems = tracker.items.filter((item: any) => {
      const log = item.logs.find((l: any) => {
        const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
        return lDate === todayStr;
      });
      return log && log.status === 'completed';
    }).length;

    const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    return (
      <div className="crm-card">
        <div className="crm-header">
          <h3 className="crm-title">
            <div className={`p-1.5 rounded-lg ${isMorning ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
              <Icon className="h-4 w-4" />
            </div>
            {tracker.name}
          </h3>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {completedItems}/{totalItems} erledigt
          </div>
        </div>
        
        <div className="h-1.5 w-full bg-border/30 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ease-out ${isMorning ? 'bg-amber-500' : 'bg-indigo-500'}`} 
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="space-y-1 mt-2">
          {tracker.items.map((item: any) => {
            const isDone = item.logs.some((l: any) => {
              const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
              return lDate === todayStr && l.status === 'completed';
            });
            const streak = calculateStreak(item, todayStr);

            return (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-overlay/30 transition-colors group">
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  <button 
                    onClick={() => handleToggleRoutineLog(tracker.id, item.id, isDone)} 
                    className="shrink-0 flex items-center justify-center active:scale-[0.90] transition-transform"
                  >
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isDone ? (isMorning ? 'bg-amber-500 border-amber-500' : 'bg-indigo-500 border-indigo-500') : 'border-border hover:border-muted'}`}>
                      {isDone && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                  
                  {editingRoutineItem?.itemId === item.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input 
                        type="text" 
                        value={routineEditTitle} 
                        onChange={(e) => setRoutineEditTitle(e.target.value)} 
                        className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:border-accent outline-none w-full"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRoutineItemEdit(tracker.id, item.id);
                          if (e.key === 'Escape') setEditingRoutineItem(null);
                        }}
                      />
                      <button onClick={() => saveRoutineItemEdit(tracker.id, item.id)} className="text-accent hover:text-accent-hover p-1">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingRoutineItem(null)} className="text-muted hover:text-foreground p-1">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <span className={`text-sm font-medium truncate transition-colors ${isDone ? 'text-muted line-through' : 'text-foreground'}`}>
                        {item.title}
                      </span>
                      <button 
                        onClick={() => {
                          setEditingRoutineItem({ trackerId: tracker.id, itemId: item.id });
                          setRoutineEditTitle(item.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-opacity p-1 shrink-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                {streak > 0 ? (
                  <StreakStatsPopover logs={item.logs} title={item.title}>
                    <div className="flex items-center gap-1 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 px-2 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors">
                      <Flame className="h-3 w-3" /> {streak}
                    </div>
                  </StreakStatsPopover>
                ) : (
                  <StreakStatsPopover logs={item.logs} title={item.title}>
                    <div className="text-xs text-muted hover:text-foreground cursor-pointer px-2 py-1">Stats</div>
                  </StreakStatsPopover>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const morningTracker = trackers.find((t: any) => t.name.toLowerCase().includes('morgen'));
  const eveningTracker = trackers.find((t: any) => t.name.toLowerCase().includes('abend'));

  const activeTracker = activeTab === 'morning' ? morningTracker : eveningTracker;

  return (
    <div className="flex flex-col gap-4">
      {/* Apple-style segmented control */}
      <div className="bg-elevated border border-border/50 p-1 rounded-xl flex items-center w-full max-w-xs mx-auto shadow-sm relative">
        <div 
          className="absolute inset-y-1 bg-background shadow rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ 
            width: 'calc(50% - 4px)', 
            transform: `translateX(${activeTab === 'morning' ? '0%' : '100%'})`,
            left: activeTab === 'morning' ? '4px' : '4px'
          }}
        />
        <button 
          onClick={() => setActiveTab('morning')}
          className={`relative z-10 flex-1 py-1.5 text-sm font-medium transition-colors ${activeTab === 'morning' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Morgen
        </button>
        <button 
          onClick={() => setActiveTab('evening')}
          className={`relative z-10 flex-1 py-1.5 text-sm font-medium transition-colors ${activeTab === 'evening' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Abend
        </button>
      </div>

      <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
        {renderTracker(activeTracker)}
      </div>
    </div>
  );
}
