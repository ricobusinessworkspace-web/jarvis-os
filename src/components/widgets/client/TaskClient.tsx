'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Star, Pencil, Check, X } from 'lucide-react';
import { updateTask } from '@/actions/dashboard';

interface Props {
  initialTasks: any[];
}

function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

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
    return { text: `Überfällig (${Math.abs(diffDays)} T.)`, className: 'bg-red-500/10 text-red-400 border border-red-500/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
  } else if (diffDays === 0) {
    return { text: 'Heute', className: 'bg-red-500/15 text-red-500 border border-red-500/30 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 animate-pulse-soft' };
  } else if (diffDays === 1) {
    return { text: 'Morgen', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
  } else if (diffDays <= 7) {
    return { text: `In ${diffDays} Tagen`, className: 'bg-accent/10 text-accent border border-accent/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
  } else {
    return { text: dateStr, className: 'bg-overlay/50 text-muted border border-border/50 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
  }
};

export function TaskClient({ initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditTitle, setTaskEditTitle] = useState('');
  const [taskEditDeadline, setTaskEditDeadline] = useState('');
  const [taskEditNotes, setTaskEditNotes] = useState('');

  const todayStr = getLocalDateString();

  const saveTaskEdit = async (taskId: string) => {
    const title = taskEditTitle.trim();
    if (!title) return;
    
    // Prisma requires an ISO-8601 string or Date object for DateTime fields.
    const isoDeadline = taskEditDeadline ? new Date(taskEditDeadline).toISOString() : null;
    
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title, dueDate: isoDeadline, notes: taskEditNotes } : t));
    setEditingTaskId(null);
    
    await updateTask(taskId, { title, dueDate: isoDeadline, description: taskEditNotes });
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
    
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completedAt } : t));
    
    await updateTask(taskId, { status: newStatus, completedAt });
  };

  const toggleTaskPriority = async (taskId: string, currentPriority: string) => {
    const newPriority = currentPriority === 'high' ? 'normal' : 'high';
    
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
    
    await updateTask(taskId, { priority: newPriority });
  };

  const todayTasks = useMemo(() => {
    return tasks.filter(t => {
      const taskDate = t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0]) : null;
      if (!taskDate) return false;
      if (taskDate === todayStr) return true;
      return taskDate < todayStr && t.status !== 'done';
    }).sort((a, b) => {
      const prioA = a.priority === 'high' ? 1 : 0;
      const prioB = b.priority === 'high' ? 1 : 0;
      if (prioA !== prioB) return prioB - prioA;
      
      const dateA = a.dueDate ? (typeof a.dueDate === 'string' ? a.dueDate.split('T')[0] : new Date(a.dueDate).toISOString().split('T')[0]) : '';
      const dateB = b.dueDate ? (typeof b.dueDate === 'string' ? b.dueDate.split('T')[0] : new Date(b.dueDate).toISOString().split('T')[0]) : '';
      return dateA.localeCompare(dateB);
    });
  }, [tasks, todayStr]);

  const overdueCount = todayTasks.filter(t => {
    const taskDate = t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0]) : null;
    return taskDate && taskDate < todayStr && t.status !== 'done';
  }).length;

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <CheckCircle className="h-4 w-4 text-accent" /> Aufgaben
        </h3>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
              {overdueCount} überfällig
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
                            return badge ? <span className={badge.className}>{badge.text}</span> : null;
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
                          setTaskEditDeadline(task.dueDate ? (typeof task.dueDate === 'string' ? task.dueDate.split('T')[0] : new Date(task.dueDate).toISOString().split('T')[0]) : '');
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
  );
}
