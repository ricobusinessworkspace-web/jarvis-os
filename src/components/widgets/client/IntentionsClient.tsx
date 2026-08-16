'use client';

import { useState, useEffect } from 'react';
import { Check, Target, Pencil, X, Flame } from 'lucide-react';
import { logTrackerItem, updateTrackerItem } from '@/actions/dashboard';
import StreakStatsPopover from '@/components/ui/StreakStatsPopover';

interface Props {
  initialTracker: any;
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
    const log = item.logs?.find((l: any) => {
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

export function IntentionsClient({ initialTracker }: Props) {
  const [tracker, setTracker] = useState(initialTracker);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  useEffect(() => {
    setTracker(initialTracker);
  }, [initialTracker]);

  const todayStr = getLocalDateString();

  if (!tracker) {
    return (
      <div className="bg-elevated/30 border border-border/30 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col items-center justify-center text-center text-muted-foreground h-full min-h-[250px]">
        <Target className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Kein "Ursachen" Tracker gefunden.</p>
        <p className="text-xs opacity-70">Lege einen Tracker namens "Ursachen" an, um hier deine täglichen Intentionen zu sehen.</p>
      </div>
    );
  }

  const handleToggleLog = async (itemId: string, isDone: boolean) => {
    const newStatus = isDone ? 'not_done' : 'completed';
    
    setTracker((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item: any) => {
          if (item.id === itemId) {
            const logs = [...(item.logs || [])];
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
    });

    await logTrackerItem(itemId, newStatus, todayStr);
  };

  const saveItemEdit = async (itemId: string) => {
    const title = editTitle.trim();
    if (!title) return;
    
    setTracker((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item: any) => item.id === itemId ? { ...item, title } : item)
      };
    });
    setEditingItem(null);
    await updateTrackerItem(itemId, { title });
  };

  const totalItems = tracker.items?.length || 0;
  const completedItems = tracker.items?.filter((item: any) => {
    const log = item.logs?.find((l: any) => {
      const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
      return lDate === todayStr;
    });
    return log && log.status === 'completed';
  }).length || 0;

  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="bg-elevated/30 border border-border/30 rounded-3xl p-5 shadow-sm space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
            <Target className="h-5 w-5" />
          </div>
          Ursachen
        </h3>
        <div className="text-xs font-semibold text-muted">
          {completedItems}/{totalItems} gesetzt
        </div>
      </div>
      
      <div className="h-1.5 w-full bg-border/30 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 transition-all duration-500 ease-out" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-1 mt-2">
        {tracker.items?.map((item: any) => {
          const isDone = item.logs?.some((l: any) => {
            const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
            return lDate === todayStr && l.status === 'completed';
          });
          const streak = calculateStreak(item, todayStr);

          return (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-overlay/30 transition-colors group">
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <button 
                  onClick={() => handleToggleLog(item.id, isDone)} 
                  className="shrink-0 flex items-center justify-center active:scale-[0.90] transition-transform"
                >
                  <div className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${isDone ? 'bg-green-500 border-green-500' : 'border-border hover:border-muted'}`}>
                    {isDone && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
                
                {editingItem === item.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input 
                      type="text" 
                      value={editTitle} 
                      onChange={(e) => setEditTitle(e.target.value)} 
                      className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:border-accent outline-none w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveItemEdit(item.id);
                        if (e.key === 'Escape') setEditingItem(null);
                      }}
                    />
                    <button onClick={() => saveItemEdit(item.id)} className="text-accent hover:text-accent-hover p-1">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingItem(null)} className="text-muted hover:text-foreground p-1">
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
                        setEditingItem(item.id);
                        setEditTitle(item.title);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-opacity p-1 shrink-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                {streak > 0 ? (
                   <StreakStatsPopover logs={item.logs || []} title={item.title}>
                     <div className="flex items-center gap-1 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 px-2 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors">
                       <Flame className="h-3 w-3" /> {streak}
                     </div>
                   </StreakStatsPopover>
                ) : (
                   <StreakStatsPopover logs={item.logs || []} title={item.title}>
                     <div className="text-xs text-muted hover:text-foreground cursor-pointer px-2 py-1">Stats</div>
                   </StreakStatsPopover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
