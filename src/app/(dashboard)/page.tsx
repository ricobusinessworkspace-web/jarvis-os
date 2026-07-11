'use client';

import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, 
  Moon, 
  Activity, 
  Calendar, 
  TrendingUp, 
  Phone, 
  PhoneCall, 
  Star,
  CheckCircle,
  Circle,
  Utensils,
  Pencil,
  FileText,
  X,
  Check,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import {
  getDashboardData,
  getCrmMetrics,
  updateTask,
  savePersonalLog,
  logTrackerItem,
  updateTrackerItem
} from '@/actions/dashboard';
import {
  getCalendarStatus,
  getCalendarAuthUrl,
  disconnectCalendar,
  fetchCalendarEvents
} from '@/actions/google-calendar';
import type { GoogleCalendarEvent, CrmMetrics, PersonalLog } from '@/types';

// ─── Local Date Helpers ───
function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

function getCurrentWeekDates(offsetWeeks = 0) {
  const now = new Date();
  now.setDate(now.getDate() + (offsetWeeks * 7));
  const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
  
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWeek + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
}

const WEEK_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function DashboardPage() {
  const trackers = useStore((state) => state.trackers);
  const todayLog = useStore((state) => state.todayLog);
  const personalLogs = useStore((state) => state.personalLogs);
  const tasks = useStore((state) => state.tasks);
  
  const initialize = useStore((state) => state.initialize);
  const updateTodayLog = useStore((state) => state.updateTodayLog);
  const updateTrackerItemLog = useStore((state) => state.updateTrackerItemLog);
  const updateTrackerItemTitleInStore = useStore((state) => state.updateTrackerItemTitleInStore);
  const updateTaskInStore = useStore((state) => state.updateTaskInStore);

    const todayStr = getLocalDateString();
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeekStrs = useMemo(() => getCurrentWeekDates(weekOffset), [weekOffset]);

  // --- CRM State ---
  const [crmMetrics, setCrmMetrics] = useState<CrmMetrics | null>(null);
  const [crmLoading, setCrmLoading] = useState(true);

  // --- Google Calendar State ---
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // --- Today's Tasks Edit State ---
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditTitle, setTaskEditTitle] = useState('');
  const [taskEditDeadline, setTaskEditDeadline] = useState('');
  const [taskEditNotes, setTaskEditNotes] = useState('');

  // --- Routine Item Edit State ---
  const [editingRoutineItem, setEditingRoutineItem] = useState<{ trackerId: string; itemId: string } | null>(null);
  const [routineEditTitle, setRoutineEditTitle] = useState('');

  // --- Hydration and Listeners ---
  useEffect(() => {
    const fetchCrm = async () => {
            try {
        const res = await getCrmMetrics();
        if (res.success && res.data) setCrmMetrics(res.data);
      } catch (e) {
        console.error('CRM Fetch Error:', e);
      } finally {
        setCrmLoading(false);
      }
    };

    const fetchCalendar = async () => {
            try {
        const status = await getCalendarStatus();
        if (status.success && status.connected) {
          setCalendarConnected(true);
          const eventsRes = await fetchCalendarEvents();
          if (eventsRes.success && eventsRes.data) {
            // Filter: Only keep future/current events for today
            const now = new Date();
            const filtered = eventsRes.data.filter((ev: GoogleCalendarEvent) => {
              if (!ev.end?.dateTime) return true; // all day event
              return new Date(ev.end.dateTime) > now;
            });
            setCalendarEvents(filtered);
          }
        } else {
          setCalendarConnected(false);
        }
      } catch (e) {
        console.error('Calendar Fetch Error:', e);
      } finally {
        setCalendarLoading(false);
      }
    };

    fetchCrm();
    fetchCalendar();
  }, []);

  // --- Google Calendar Actions ---
  const handleConnectCalendar = async () => {
        const res = await getCalendarAuthUrl();
    if (res.success && res.url) window.location.href = res.url;
  };

  const handleDisconnectCalendar = async () => {
    if ( !confirm('Google Kalender Verbindung trennen?')) return;
    const res = await disconnectCalendar();
    if (res.success) {
      setCalendarConnected(false);
      setCalendarEvents([]);
    }
  };

  // --- Weekly Trackers (Routines) ---
  const handleToggleRoutineLog = async (trackerId: string, itemId: string, dateStr: string, isDone: boolean) => {
        const newStatus = isDone ? 'not_done' : 'completed';
    try {
      const res = await logTrackerItem(itemId, newStatus, dateStr);
      if (res.success && res.data) {
        updateTrackerItemLog(trackerId, itemId, {
          id: res.data.id,
          itemId,
          date: new Date(dateStr),
          status: newStatus as any
        });
      }
    } catch (e) {
      console.error('Routine log error:', e);
    }
  };

  // --- Weekly Trackers (Sleep) ---
  const handleSleepTimeChange = async (dateStr: string, field: 'bedTime' | 'wakeTime', value: string) => {
        
    if (dateStr === todayStr) {
      updateTodayLog({ [field]: value });
    }
    
    try {
      await savePersonalLog({ date: dateStr, [field]: value });
      // Re-fetch data to sync personalLogs and recalculated sleepHours
      const data = await getDashboardData();
      if (data.success && data.data) {
        initialize(data.data as any);
      }
    } catch (e) {
      console.error('Sleep log error:', e);
    }
  };

  const getLogForDate = (dateStr: string) => {
    if (dateStr === todayStr) return todayLog;
    return personalLogs.find(l => l.date === dateStr) || { date: dateStr, sleepHours: 0, bedTime: '', wakeTime: '' } as PersonalLog;
  };

  // --- Task Actions ---
  const saveTaskEdit = async (taskId: string) => {
        const title = taskEditTitle.trim();
    if (!title) return;
    try {
      const res = await updateTask(taskId, { title, dueDate: taskEditDeadline || null, notes: taskEditNotes });
      if (res.success) {
        updateTaskInStore(taskId, { title, dueDate: taskEditDeadline || null, notes: taskEditNotes });
        setEditingTaskId(null);
      }
    } catch (e) {
      console.error('Task edit error:', e);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
        try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
      const res = await updateTask(taskId, { status: newStatus, completedAt });
      if (res.success) {
        updateTaskInStore(taskId, { status: newStatus, completedAt });
      }
    } catch (e) {
      console.error('Task status toggle error:', e);
    }
  };

  const toggleTaskPriority = async (taskId: string, currentPriority: string) => {
        try {
      const newPriority = currentPriority === 'high' ? 'normal' : 'high';
      const res = await updateTask(taskId, { priority: newPriority });
      if (res.success) {
        updateTaskInStore(taskId, { priority: newPriority });
      }
    } catch (e) {
      console.error('Task priority toggle error:', e);
    }
  };

  const todayTasks = useMemo(() => {
    return tasks.filter(t => {
      const taskDate = t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0]) : null;
      if (!taskDate) return false;
      if (taskDate === todayStr) return true;
      // Include overdue tasks if they are not completed
      return taskDate < todayStr && t.status !== 'done';
    }).sort((a, b) => {
      // High priority tasks first
      const prioA = a.priority === 'high' ? 1 : 0;
      const prioB = b.priority === 'high' ? 1 : 0;
      if (prioA !== prioB) return prioB - prioA;
      
      // Then overdue tasks first (by due date ascending)
      const dateA = a.dueDate ? (typeof a.dueDate === 'string' ? a.dueDate.split('T')[0] : new Date(a.dueDate).toISOString().split('T')[0]) : '';
      const dateB = b.dueDate ? (typeof b.dueDate === 'string' ? b.dueDate.split('T')[0] : new Date(b.dueDate).toISOString().split('T')[0]) : '';
      return dateA.localeCompare(dateB);
    });
  }, [tasks, todayStr]);

  // --- Helpers ---
  const getProjectTags = (task: any): string[] => {
    if (!task.projectTags) return [];
    if (typeof task.projectTags === 'string') {
      try {
        return JSON.parse(task.projectTags);
      } catch {
        return [];
      }
    }
    return task.projectTags;
  };

  const getDateBadge = (dateStr: string) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return {
        text: `Überfällig (${Math.abs(diffDays)} T.)`,
        className: 'bg-red-500/10 text-red-400 border border-red-500/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1'
      };
    } else if (diffDays === 0) {
      return {
        text: 'Heute',
        className: 'bg-red-500/15 text-red-500 border border-red-500/30 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 animate-pulse-soft'
      };
    } else if (diffDays === 1) {
      return {
        text: 'Morgen',
        className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1'
      };
    } else if (diffDays <= 7) {
      return {
        text: `In ${diffDays} Tagen`,
        className: 'bg-accent/10 text-accent border border-accent/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1'
      };
    } else {
      return {
        text: dateStr,
        className: 'bg-overlay/50 text-muted border border-border/50 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1'
      };
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // --- Analytics Chart Data Prep ---
  const sleepChartData = useMemo(() => {
    return currentWeekStrs.map(dateStr => {
      const log = getLogForDate(dateStr);
      return { date: dateStr.slice(-5), hours: log.sleepHours || 0 };
    });
  }, [currentWeekStrs, personalLogs, todayLog]);

  const routineChartData = useMemo(() => {
    const morningTracker = trackers.find(t => t.name.toLowerCase().includes('morgen'));
    const eveningTracker = trackers.find(t => t.name.toLowerCase().includes('abend'));
    const mTotal = morningTracker?.items.length || 1;
    const eTotal = eveningTracker?.items.length || 1;

    return currentWeekStrs.map(dateStr => {
      let mDone = 0;
      let eDone = 0;
      
      morningTracker?.items.forEach(item => {
        if (item.logs.some((l: any) => {
          const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
          return lDate === dateStr && l.status === 'completed';
        })) mDone++;
      });
      eveningTracker?.items.forEach(item => {
        if (item.logs.some((l: any) => {
          const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
          return lDate === dateStr && l.status === 'completed';
        })) eDone++;
      });

      return {
        date: dateStr.slice(-5),
        morning: Math.round((mDone / mTotal) * 100),
        evening: Math.round((eDone / eTotal) * 100)
      };
    });
  }, [currentWeekStrs, trackers]);

  const fiveAmStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let currentDate = new Date(today);
    const localTodayStr = getLocalDateString(today);
    const localTodayLog = getLogForDate(localTodayStr);
    
    if (localTodayLog && localTodayLog.wakeTime) {
      const [h, m] = localTodayLog.wakeTime.split(':').map(Number);
      if (h < 5 || (h === 5 && m === 0)) {
        streak++;
      } else {
        return 0;
      }
    }
    
    currentDate.setDate(currentDate.getDate() - 1);
    while (true) {
      const dateStr = getLocalDateString(currentDate);
      const log = personalLogs.find(l => l.date === dateStr);
      
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
    return streak;
  }, [personalLogs, todayLog]);

  const saveRoutineItemEdit = async (trackerId: string, itemId: string) => {
        const title = routineEditTitle.trim();
    if (!title) return;
    try {
      const res = await updateTrackerItem(itemId, { title });
      if (res.success) {
        updateTrackerItemTitleInStore(trackerId, itemId, title);
        setEditingRoutineItem(null);
      }
    } catch (e) {
      console.error('Routine item edit error:', e);
    }
  };

  // --- Components ---
  const WeeklyRoutineTable = ({ tracker }: { tracker: any }) => {
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

  const morningTracker = trackers.find(t => t.name.toLowerCase().includes('morgen'));
  const eveningTracker = trackers.find(t => t.name.toLowerCase().includes('abend'));

  return (
    <div className="flex flex-col gap-10 pb-16 max-w-7xl mx-auto w-full">
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 1: DAILY FOCUS */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Daily Focus</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Today's Agenda */}
          <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-accent" /> Heute
              </h3>
              {calendarConnected && (
                <button onClick={handleDisconnectCalendar} className="text-muted hover:text-red-400 p-1 transition-colors"><X className="h-4 w-4" /></button>
              )}
            </div>
            {calendarLoading ? (
              <div className="p-6 text-center text-muted italic text-xs">Lade Kalender...</div>
            ) : !calendarConnected ? (
              <div className="text-center p-6 space-y-4">
                <button onClick={handleConnectCalendar} className="text-xs font-bold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all">Kalender verbinden</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 flex-1">
                {calendarEvents.length > 0 ? calendarEvents.map((event) => (
                  <div key={event.id} className="p-3 rounded-xl bg-background/60 border border-border/40 flex flex-col gap-1 hover:bg-overlay/5 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Termin</span>
                      <span className="text-[11px] text-muted font-medium">{formatTime(event.start?.dateTime)}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground truncate">{event.summary}</h4>
                  </div>
                )) : <p className="text-xs text-muted italic text-center p-4">Keine weiteren Termine.</p>}
              </div>
            )}
          </div>

          {/* Today's Tasks */}
          <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
                <CheckCircle className="h-4 w-4 text-accent" /> Aufgaben
              </h3>
              <div className="flex items-center gap-2">
                {todayTasks.filter(t => {
                  const taskDate = t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0]) : null;
                  return taskDate && taskDate < todayStr && t.status !== 'done';
                }).length > 0 && (
                  <span className="text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                    {todayTasks.filter(t => {
                      const taskDate = t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0]) : null;
                      return taskDate && taskDate < todayStr && t.status !== 'done';
                    }).length} überfällig
                  </span>
                )}
                <span className="text-[11px] font-semibold text-muted bg-overlay/50 px-2.5 py-0.5 rounded-full">
                  {todayTasks.filter(t => t.status !== 'done').length} offen
                </span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 flex-1">
              <AnimatePresence mode="popLayout">
                {todayTasks.length > 0 ? (
                  todayTasks.map((task) => {
                    const isEditing = editingTaskId === task.id;
                    const isDone = task.status === 'done';

                    return (
                      <motion.div key={task.id} layout className={`p-3 rounded-xl border transition-all ${isDone ? 'bg-overlay/10 border-border/15 opacity-50' : 'bg-background/60 border-border/40 hover:border-accent/30'}`}>
                        {isEditing ? (
                          <div className="space-y-3">
                            <input 
                              type="text" 
                              value={taskEditTitle} 
                              onChange={(e) => setTaskEditTitle(e.target.value)} 
                              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:border-accent outline-none" 
                              placeholder="Aufgabentitel..." 
                              autoFocus 
                            />
                            <textarea
                              value={taskEditNotes}
                              onChange={(e) => setTaskEditNotes(e.target.value)}
                              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-[11px] text-foreground focus:border-accent outline-none min-h-[60px] resize-y"
                              placeholder="Notizen zur Aufgabe..."
                            />
                            <input 
                              type="date" 
                              value={taskEditDeadline} 
                              onChange={(e) => setTaskEditDeadline(e.target.value)} 
                              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-[11px] text-foreground focus:border-accent outline-none" 
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveTaskEdit(task.id)} className="text-accent text-[11px] font-bold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Sichern
                              </button>
                              <button onClick={() => setEditingTaskId(null)} className="text-muted text-[11px] font-medium flex items-center gap-1">
                                <X className="h-3.5 w-3.5" /> Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => toggleTaskStatus(task.id, task.status)} className="mt-0.5 shrink-0 transition-transform active:scale-90">
                              {isDone ? <CheckCircle className="h-4.5 w-4.5 text-accent fill-accent/10" /> : <Circle className="h-4.5 w-4.5 text-muted/40 hover:text-accent/50 transition-colors" />}
                            </button>
                            
                            <button 
                              onClick={() => toggleTaskPriority(task.id, task.priority)} 
                              className="mt-0.5 shrink-0 transition-transform active:scale-90"
                            >
                              <Star className={`h-4 w-4 ${task.priority === 'high' ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.4)]' : 'text-muted/30 hover:text-amber-400/60 transition-colors'}`} />
                            </button>

                            <div className="flex-1 min-w-0 space-y-1">
                              <p className={`text-xs font-semibold leading-snug ${isDone ? 'line-through text-muted' : 'text-foreground'}`}>
                                {task.title}
                              </p>
                              {task.notes && (
                                <p className={`text-[11px] leading-relaxed mt-1 whitespace-pre-wrap ${isDone ? 'text-muted/60 line-through' : 'text-muted'}`}>
                                  {task.notes}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {task.dueDate && (() => {
                                  const badge = getDateBadge(task.dueDate);
                                  return badge ? (
                                    <span className={badge.className}>{badge.text}</span>
                                  ) : null;
                                })()}
                                {(() => {
                                  const pTags = getProjectTags(task);
                                  return pTags.length > 0 && pTags.map(tag => (
                                    <span key={tag} className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                      {tag}
                                    </span>
                                  ));
                                })()}
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setTaskEditTitle(task.title);
                                setTaskEditDeadline(task.dueDate || '');
                                setTaskEditNotes(task.notes || '');
                              }} 
                              className="text-muted hover:text-foreground p-1 transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted italic text-center p-4">Keine Aufgaben für heute geplant.</p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* KPIs: 5 AM Streak & Sales Engine */}
          <div className="flex flex-col gap-6">
            
            {/* 5 AM Streak Dedicated Widget */}
            <div className="bg-orange-500/10 backdrop-blur-md border border-orange-500/20 rounded-2xl p-5 shadow-sm flex items-center justify-between transition-all hover:bg-orange-500/15">
              <div>
                <h3 className="text-[10px] font-black tracking-widest text-orange-400 uppercase opacity-80 mb-0.5">5 AM Streak</h3>
                <div className="text-3xl font-black text-orange-400">{fiveAmStreak} <span className="text-xs font-bold opacity-70 tracking-normal">Tage in Folge</span></div>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                <Sun className="h-6 w-6 text-orange-400" />
              </div>
            </div>

            {/* Sales Engine */}
            <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 flex-1">
              <div className="flex items-center justify-between border-b border-border/20 pb-3">
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
                  <TrendingUp className="h-4 w-4 text-green-400" /> Sales Engine
                </h3>
                <span className="text-[10px] font-black bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full tracking-wider uppercase">Online</span>
              </div>
              {crmMetrics && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col p-3 rounded-xl bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1.5"><Phone className="h-3 w-3" /> Heute</span>
                      <span className="text-xl font-black text-foreground mt-0.5">{crmMetrics.todayCalls}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1.5"><PhoneCall className="h-3 w-3" /> Woche</span>
                      <span className="text-xl font-black text-foreground mt-0.5">{crmMetrics.weeklyCalls}</span>
                    </div>
                  </div>
                  <div className="flex flex-col p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <span className="text-[10px] text-green-400 font-black uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Umsatz Pipeline</span>
                    <span className="text-2xl font-black text-green-400 mt-0.5">€{crmMetrics.monthlyRevenue.toLocaleString('de-DE')}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 2: HABIT & HEALTH TRACKING */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Habit & Health Tracking</h2>
        
        <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-6 shadow-sm space-y-6">
          <WeeklyRoutineTable tracker={morningTracker} />
          <WeeklyRoutineTable tracker={eveningTracker} />
          
          {/* Weekly Sleep Table */}
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
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────── */}
      {/* SECTION 3: TRENDS & ANALYTICS */}
      {/* ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted/60 pl-2">Trends & Analytics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-wider flex justify-between">
              <span>Schlaftrend</span><span className="text-[10px] text-muted">Stunden</span>
            </h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sleepChartData}>
                  <YAxis hide domain={[0, 12]} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(17,17,17,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} />
                  <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 2, stroke: '#000' }} activeDot={{ r: 7 }} name="Schlaf (h)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-wider flex justify-between">
              <span>Routinen Konstanz</span><span className="text-[10px] text-muted">%</span>
            </h4>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={routineChartData}>
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(17,17,17,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} />
                  <Line type="monotone" dataKey="morning" stroke="#fbbf24" strokeWidth={4} dot={false} activeDot={{ r: 6 }} name="Morgen %" />
                  <Line type="monotone" dataKey="evening" stroke="#818cf8" strokeWidth={4} dot={false} activeDot={{ r: 6 }} name="Abend %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
