'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, Circle, Star, Pencil, Check, X, Target, 
  Video, Lightbulb, PenTool, Plus, CheckCircle2, Calendar 
} from 'lucide-react';
import { updateTask, updateContentItem, createContentItem } from '@/actions/dashboard';
import type { GoogleCalendarEvent } from '@/types';

interface Props {
  initialTasks: any[];
  initialContent: any[];
  initialEvents: GoogleCalendarEvent[];
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

export function UnifiedTaskClient({ initialTasks, initialContent, initialEvents }: Props) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'content' | 'calendar'>('tasks');
  const tabs = [
    { id: 'tasks', label: 'Aufgaben' },
    { id: 'content', label: 'Content' },
    { id: 'calendar', label: 'Termine' }
  ];
  const tabIndex = tabs.findIndex(t => t.id === activeTab);

  // --- Task State ---
  const [tasks, setTasks] = useState(initialTasks);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditTitle, setTaskEditTitle] = useState('');
  const [taskEditDeadline, setTaskEditDeadline] = useState('');
  const [taskEditNotes, setTaskEditNotes] = useState('');
  const todayStr = getLocalDateString();

  const saveTaskEdit = async (taskId: string) => {
    const title = taskEditTitle.trim();
    if (!title) return;
    const isoDeadline = taskEditDeadline ? new Date(taskEditDeadline).toISOString() : null;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title, dueDate: isoDeadline, notes: taskEditNotes } : t));
    setEditingTaskId(null);
    await updateTask(taskId, { title, dueDate: isoDeadline, description: taskEditNotes });
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completedAt } : t));
    await updateTask(taskId, { status: newStatus, completedAt });
  };

  const toggleTaskPriority = async (taskId: string, currentPriority: string) => {
    const newPriority = currentPriority === 'high' ? 'normal' : 'high';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
    await updateTask(taskId, { priority: newPriority });
  };

  const toggleChecklist = async (taskId: string, notes: string, lineIndex: number, isChecked: boolean) => {
    const lines = notes.split('\n');
    lines[lineIndex] = lines[lineIndex].replace(isChecked ? '[x]' : '[ ]', isChecked ? '[ ]' : '[x]').replace(isChecked ? '[X]' : '[ ]', isChecked ? '[ ]' : '[x]');
    const newNotes = lines.join('\n');
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: newNotes } : t));
    await updateTask(taskId, { description: newNotes });
  };

  const todayTasks = useMemo(() => {
    return tasks.filter(t => {
      const taskDate = t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0]) : null;
      const completedDate = t.completedAt ? (typeof t.completedAt === 'string' ? t.completedAt.split('T')[0] : new Date(t.completedAt).toISOString().split('T')[0]) : null;
      if (completedDate === todayStr) return true; 
      if (!taskDate) return false;
      if (taskDate === todayStr) return true;
      return taskDate < todayStr && t.status !== 'done';
    }).sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
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

  // --- Content State ---
  const [contentItems, setContentItems] = useState(initialContent);
  const [isAddingContent, setIsAddingContent] = useState(false);
  const [newContentTitle, setNewContentTitle] = useState('');

  const handleUpdateContentStatus = async (id: string, currentStatus: string) => {
    let newStatus = 'idee';
    if (currentStatus === 'idee') newStatus = 'draft';
    else if (currentStatus === 'draft') newStatus = 'published';
    else newStatus = 'idee';
    setContentItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    await updateContentItem(id, { status: newStatus });
  };

  const handleCreateContent = async () => {
    if (!newContentTitle.trim()) {
      setIsAddingContent(false);
      return;
    }
    const title = newContentTitle.trim();
    setIsAddingContent(false);
    setNewContentTitle('');
    const tempId = 'temp-' + Date.now();
    const newItem = { id: tempId, title, status: 'idee', category: 'Creator', priority: 'normal' };
    setContentItems(prev => [newItem, ...prev]);
    const res = await createContentItem({ title, status: 'idee', category: 'Creator', priority: 'normal' });
    if (res.success) {
      setContentItems(prev => prev.map(i => i.id === tempId ? res.data : i));
    }
  };

  const ideas = contentItems.filter(i => i.status === 'idee');
  const drafts = contentItems.filter(i => i.status === 'draft');

  return (
    <div className="crm-card h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="bg-elevated border border-border/50 p-1 rounded-xl flex items-center w-full max-w-sm mx-auto shadow-sm relative">
          <div 
            className="absolute inset-y-1 bg-background shadow rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: 'calc(33.33% - 4px)', transform: `translateX(${tabIndex * 100}%)`, left: '4px' }}
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 text-center py-1.5 text-xs font-medium z-10 transition-colors ${activeTab === tab.id ? 'text-foreground' : 'text-muted hover:text-foreground/80'}`}
            >
              {tab.label}
              {tab.id === 'tasks' && overdueCount > 0 && (
                <span className="ml-1.5 text-[9px] bg-red-500/15 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[350px] pr-1">
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-2">
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
                            placeholder="Notizen oder Checkliste (mit [ ] und [x])..."
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
                              <div className="mt-1.5 space-y-0.5">
                                {task.notes.split('\n').map((line: string, i: number) => {
                                  const isUnchecked = line.trim().startsWith('[ ]');
                                  const isChecked = line.trim().startsWith('[x]') || line.trim().startsWith('[X]');
                                  if (isUnchecked || isChecked) {
                                    const text = line.replace(/^\[[ xX]\]\s*/, '');
                                    return (
                                      <div key={i} className="flex items-start gap-1.5">
                                        <button 
                                          onClick={() => toggleChecklist(task.id, task.notes, i, isChecked)} 
                                          className="mt-[3px] shrink-0 hover:scale-110 transition-transform"
                                        >
                                          {isChecked ? (
                                            <CheckCircle className="h-3 w-3 text-accent" />
                                          ) : (
                                            <Circle className="h-3 w-3 text-muted/60 hover:text-accent/50 transition-colors" />
                                          )}
                                        </button>
                                        <span className={`text-[10px] leading-snug ${isChecked ? 'line-through text-muted/60' : 'text-muted'}`}>{text}</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <p key={i} className={`text-[11px] leading-relaxed whitespace-pre-wrap ${isDone ? 'text-muted/60 line-through' : 'text-muted'}`}>
                                      {line}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {task.dueDate && (() => {
                                const badge = getDateBadge(task.dueDate);
                                return badge ? <span className={badge.className}>{badge.text}</span> : null;
                              })()}
                              
                              {task.goal && (
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Target className="h-2 w-2" /> {task.goal.title}
                                </span>
                              )}
                              
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
        )}

        {activeTab === 'content' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/20 pb-2">
              <h3 className="text-xs font-bold tracking-tight text-muted flex items-center gap-1.5">
                Content Pipeline
              </h3>
              <button 
                onClick={() => setIsAddingContent(true)} 
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 p-1 rounded-md transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            
            <div className="space-y-4">
              {isAddingContent && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-background/60 border border-purple-500/30 rounded-xl">
                  <input
                    type="text"
                    autoFocus
                    value={newContentTitle}
                    onChange={e => setNewContentTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateContent(); if (e.key === 'Escape') setIsAddingContent(false); }}
                    onBlur={() => handleCreateContent()}
                    placeholder="Neue Idee..."
                    className="w-full bg-transparent text-xs text-foreground outline-none"
                  />
                </motion.div>
              )}

              {drafts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Video className="w-3 h-3 text-purple-400" /> In Produktion ({drafts.length})
                  </h4>
                  <AnimatePresence>
                    {drafts.map(item => (
                      <motion.div key={item.id} layout className="p-2.5 bg-background/60 border border-border/40 rounded-xl flex items-center gap-2.5 group">
                        <button onClick={() => handleUpdateContentStatus(item.id, item.status)} className="shrink-0 text-amber-400/80 hover:text-green-400 transition-colors bg-amber-400/10 p-1.5 rounded-lg">
                          <PenTool className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs font-semibold text-foreground flex-1 truncate">{item.title}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {ideas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-yellow-400" /> Ideen ({ideas.length})
                  </h4>
                  <AnimatePresence>
                    {ideas.map(item => (
                      <motion.div key={item.id} layout className="p-2.5 bg-overlay/20 border border-border/20 rounded-xl flex items-center gap-2.5 group">
                        <button onClick={() => handleUpdateContentStatus(item.id, item.status)} className="shrink-0 text-muted/60 hover:text-amber-400 transition-colors p-1.5">
                          <Circle className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs font-medium text-muted-foreground flex-1 truncate group-hover:text-foreground transition-colors">{item.title}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {contentItems.length === 0 && !isAddingContent && (
                <p className="text-xs text-muted italic text-center py-4">Keine Content-Ideen vorhanden.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="flex flex-col gap-2">
            {initialEvents.length > 0 ? (
              initialEvents.map(ev => {
                const startTime = ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Ganztägig';
                return (
                  <div key={ev.id} className="p-3 bg-background/60 border border-border/40 rounded-xl flex items-start gap-3">
                    <div className="mt-0.5 text-blue-400/80 bg-blue-400/10 p-1.5 rounded-lg">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-foreground truncate">{ev.summary}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">{startTime}</span>
                        <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          Termin
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted italic text-center p-4">Keine weiteren Termine.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
