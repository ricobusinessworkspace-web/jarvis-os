'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  CalendarClock, 
  Inbox, 
  Flag, 
  List as ListIcon, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2,
  X,
  AlignLeft,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import { createTask, updateTask, deleteTask, updateSetting } from '@/actions/dashboard';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';

type SmartListType = 'today' | 'scheduled' | 'all' | 'flagged';
type SelectedList = { type: 'smart', id: SmartListType } | { type: 'custom', id: string };

export default function TasksPage() {
  const tasks = useStore((state) => state.tasks);
  const addTask = useStore((state) => state.addTask);
  const updateTaskInStore = useStore((state) => state.updateTaskInStore);
  const removeTask = useStore((state) => state.removeTask);

  const settings = useStore((state) => state.settings);
  const updateSettingInStore = useStore((state) => state.updateSettingInStore);

  // --- UI State ---
  const [selectedList, setSelectedList] = useState<SelectedList>({ type: 'smart', id: 'today' });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // --- Derived Data ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d.getTime() <= today.getTime();
  };

  const smartLists = useMemo(() => ({
    today: tasks.filter(t => isToday(t.dueDate) && t.status !== 'done'),
    scheduled: tasks.filter(t => t.dueDate !== null && t.status !== 'done'),
    all: tasks.filter(t => t.status !== 'done'),
    flagged: tasks.filter(t => t.priority === 'high' && t.status !== 'done'),
  }), [tasks]);

  const customLists = useMemo(() => {
    let explicitLists: string[] = [];
    try {
      if (settings.custom_task_lists) {
        explicitLists = JSON.parse(settings.custom_task_lists);
      }
    } catch(e){}

    if (explicitLists.length === 0) {
      explicitLists = ['Personal', 'Business'];
    }

    const areas = new Set<string>(explicitLists);
    tasks.forEach(t => {
      if (t.area) areas.add(t.area);
    });
    return Array.from(areas);
  }, [tasks, settings.custom_task_lists]);

  const currentTasks = useMemo(() => {
    let filtered: Task[] = [];
    if (selectedList.type === 'smart') {
      filtered = smartLists[selectedList.id];
    } else {
      filtered = tasks.filter(t => t.area === selectedList.id && t.status !== 'done');
    }
    // Sort: high priority first, then by date, then by creation
    return filtered.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [selectedList, smartLists, tasks]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // --- Handlers ---
  const handleToggleTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'todo' ? 'done' : 'todo';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;
    try {
      const res = await updateTask(task.id, { status: newStatus, completedAt });
      if (res.success) updateTaskInStore(task.id, { status: newStatus, completedAt });
      if (newStatus === 'done' && selectedTaskId === task.id) {
        setSelectedTaskId(null); // Close detail view if completed
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    let dueDate = null;
    let priority = 'normal';
    let area = 'Personal';

    if (selectedList.type === 'smart') {
      if (selectedList.id === 'today') dueDate = new Date().toISOString();
      if (selectedList.id === 'flagged') priority = 'high';
    } else {
      area = selectedList.id;
    }

    try {
      const res = await createTask({
        title: newTaskTitle.trim(),
        status: 'todo',
        priority,
        dueDate,
        area
      });
      if (res.success && res.data) {
        addTask(res.data as any);
        setNewTaskTitle('');
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleUpdateSelectedTask = async (updates: Partial<Task>) => {
    if (!selectedTask) return;
    updateTaskInStore(selectedTask.id, updates as any); // Optimistic UI
    try {
      await updateTask(selectedTask.id, updates);
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleAddList = async (e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault();
    if (!newListName.trim()) {
      setIsAddingList(false);
      return;
    }
    
    const updatedLists = [...new Set([...customLists, newListName.trim()])];
    const jsonStr = JSON.stringify(updatedLists);
    
    // Optimistic UI update
    updateSettingInStore('custom_task_lists', jsonStr);
    setNewListName('');
    setIsAddingList(false);
    setSelectedList({ type: 'custom', id: newListName.trim() });
    
    try {
      await updateSetting('custom_task_lists', jsonStr);
    } catch (err) {
      console.error('Error saving custom list:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (selectedTaskId === id) setSelectedTaskId(null);
    try {
      const res = await deleteTask(id);
      if (res.success) removeTask(id);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // --- UI Helpers ---
  const getListTitle = () => {
    if (selectedList.type === 'custom') return selectedList.id;
    switch (selectedList.id) {
      case 'today': return 'Heute';
      case 'scheduled': return 'Geplant';
      case 'all': return 'Alle';
      case 'flagged': return 'Markiert';
    }
  };

  const getListColor = () => {
    if (selectedList.type === 'custom') return 'text-purple-500';
    switch (selectedList.id) {
      case 'today': return 'text-blue-500';
      case 'scheduled': return 'text-red-500';
      case 'all': return 'text-zinc-500';
      case 'flagged': return 'text-orange-500';
    }
  };

  const getDateText = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === -1) return 'Gestern';
    if (diff < 0) return `Vor ${Math.abs(diff)} Tagen`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] overflow-hidden bg-background rounded-2xl border border-border/40 shadow-sm">
      
      {/* ── Left Sidebar (Lists) ── */}
      <div className="w-72 shrink-0 bg-elevated/40 border-r border-border/40 flex flex-col hidden md:flex">
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Smart Lists Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => { setSelectedList({ type: 'smart', id: 'today' }); setSelectedTaskId(null); }}
              className={cn("flex flex-col p-3 rounded-xl bg-background border transition-all text-left", selectedList.type === 'smart' && selectedList.id === 'today' ? "border-blue-500 shadow-sm" : "border-border/50 hover:border-border")}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="bg-blue-500 text-white p-1.5 rounded-full"><Calendar className="h-5 w-5" /></div>
                <span className="text-xl font-bold text-foreground">{smartLists.today.length}</span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Heute</span>
            </button>
            
            <button 
              onClick={() => { setSelectedList({ type: 'smart', id: 'scheduled' }); setSelectedTaskId(null); }}
              className={cn("flex flex-col p-3 rounded-xl bg-background border transition-all text-left", selectedList.type === 'smart' && selectedList.id === 'scheduled' ? "border-red-500 shadow-sm" : "border-border/50 hover:border-border")}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="bg-red-500 text-white p-1.5 rounded-full"><CalendarClock className="h-5 w-5" /></div>
                <span className="text-xl font-bold text-foreground">{smartLists.scheduled.length}</span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Geplant</span>
            </button>

            <button 
              onClick={() => { setSelectedList({ type: 'smart', id: 'all' }); setSelectedTaskId(null); }}
              className={cn("flex flex-col p-3 rounded-xl bg-background border transition-all text-left", selectedList.type === 'smart' && selectedList.id === 'all' ? "border-zinc-500 shadow-sm" : "border-border/50 hover:border-border")}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="bg-zinc-500 text-white p-1.5 rounded-full"><Inbox className="h-5 w-5" /></div>
                <span className="text-xl font-bold text-foreground">{smartLists.all.length}</span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Alle</span>
            </button>

            <button 
              onClick={() => { setSelectedList({ type: 'smart', id: 'flagged' }); setSelectedTaskId(null); }}
              className={cn("flex flex-col p-3 rounded-xl bg-background border transition-all text-left", selectedList.type === 'smart' && selectedList.id === 'flagged' ? "border-orange-500 shadow-sm" : "border-border/50 hover:border-border")}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="bg-orange-500 text-white p-1.5 rounded-full"><Flag className="h-5 w-5" /></div>
                <span className="text-xl font-bold text-foreground">{smartLists.flagged.length}</span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Markiert</span>
            </button>
          </div>

          <div className="pt-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-2 mb-2">Meine Listen</h3>
            <div className="space-y-1">
              {customLists.map(list => {
                const count = tasks.filter(t => t.area === list && t.status !== 'done').length;
                const isSelected = selectedList.type === 'custom' && selectedList.id === list;
                return (
                  <button
                    key={list}
                    onClick={() => { setSelectedList({ type: 'custom', id: list }); setSelectedTaskId(null); }}
                    className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group", isSelected ? "bg-accent/10 text-accent font-medium" : "hover:bg-overlay text-secondary")}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-1.5 rounded-full", isSelected ? "bg-accent text-white" : "bg-overlay text-muted")}><ListIcon className="h-3.5 w-3.5" /></div>
                      <span className="text-sm truncate">{list}</span>
                    </div>
                    <span className="text-xs font-medium opacity-60">{count}</span>
                  </button>
                );
              })}
              
              {/* Add List Input or Button */}
              {isAddingList ? (
                <form onSubmit={handleAddList} className="px-2 pt-2">
                  <div className="flex items-center gap-2 bg-background border border-accent/50 rounded-lg px-2 py-1.5">
                    <ListIcon className="h-4 w-4 text-accent shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onBlur={handleAddList}
                      placeholder="Name der Liste..."
                      className="w-full bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted/50"
                    />
                  </div>
                </form>
              ) : (
                <div className="px-2 pt-2">
                  <button
                    onClick={() => setIsAddingList(true)}
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-overlay transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Liste hinzufügen</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main List View ── */}
      <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
        <div className="p-6 md:p-8 pb-4">
          <h1 className={cn("text-3xl font-bold tracking-tight mb-6", getListColor())}>{getListTitle()}</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-20">
          <div className="space-y-1">
            {currentTasks.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted text-sm">Keine Aufgaben in dieser Liste.</p>
              </div>
            ) : (
              currentTasks.map(task => {
                const isSelected = selectedTaskId === task.id;
                const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < today.getTime();
                
                return (
                  <div 
                    key={task.id} 
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      "group flex items-start gap-3 py-3 px-3 -mx-3 rounded-xl cursor-pointer transition-colors border border-transparent",
                      isSelected ? "bg-elevated border-border shadow-sm" : "hover:bg-overlay/50"
                    )}
                  >
                    <button 
                      onClick={(e) => handleToggleTask(task, e)} 
                      className="mt-0.5 shrink-0 transition-transform active:scale-90"
                    >
                      <Circle className="h-5 w-5 text-muted hover:text-accent transition-colors" />
                    </button>
                    
                    <div className="flex-1 min-w-0 border-b border-border/40 pb-3 group-last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-foreground truncate">{task.title}</span>
                        {task.priority === 'high' && <Flag className="h-3.5 w-3.5 text-orange-500 fill-orange-500 shrink-0" />}
                      </div>
                      
                      {(task.notes || task.dueDate || task.area) && (
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                          {task.dueDate && (
                            <span className={cn("font-medium", isOverdue ? "text-red-500" : "text-muted")}>
                              {getDateText(task.dueDate)}
                            </span>
                          )}
                          {task.notes && (
                            <span className="text-muted line-clamp-1 max-w-[200px]">{task.notes}</span>
                          )}
                          {selectedList.type === 'smart' && task.area && (
                            <span className="text-muted-foreground bg-overlay px-1.5 py-0.5 rounded-sm">{task.area}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Add Input (Sticky Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/40">
          <form onSubmit={handleQuickAdd} className="flex items-center gap-3 max-w-3xl mx-auto">
            <div className="p-1.5 rounded-full bg-overlay/50"><Plus className="h-5 w-5 text-muted" /></div>
            <input 
              type="text" 
              placeholder="Neue Aufgabe..." 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] text-foreground placeholder:text-muted focus:outline-none py-2"
            />
          </form>
        </div>
      </div>

      {/* ── Right Detail Pane ── */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div 
            initial={{ width: 0, opacity: 0, borderLeftWidth: 0 }}
            animate={{ width: 320, opacity: 1, borderLeftWidth: 1 }}
            exit={{ width: 0, opacity: 0, borderLeftWidth: 0 }}
            className="shrink-0 bg-elevated/40 border-border/40 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border/40 flex justify-between items-center bg-background/50 backdrop-blur-sm">
              <span className="text-sm font-semibold text-muted-foreground">Details</span>
              <button onClick={() => setSelectedTaskId(null)} className="p-1 hover:bg-overlay rounded-md transition-colors">
                <X className="h-4 w-4 text-secondary" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Title Edit */}
              <div>
                <textarea 
                  value={selectedTask.title}
                  onChange={(e) => handleUpdateSelectedTask({ title: e.target.value })}
                  className="w-full bg-transparent text-lg font-bold text-foreground resize-none focus:outline-none min-h-[60px]"
                  placeholder="Aufgabentitel"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <AlignLeft className="h-4 w-4" /> Notizen
                </div>
                <textarea 
                  value={selectedTask.notes || ''}
                  onChange={(e) => handleUpdateSelectedTask({ notes: e.target.value })}
                  className="w-full bg-background border border-border/50 rounded-xl p-3 text-sm text-foreground resize-y min-h-[100px] focus:outline-none focus:border-accent transition-colors"
                  placeholder="Notizen hinzufügen..."
                />
              </div>

              {/* Date & Prio Controls */}
              <div className="bg-background border border-border/50 rounded-xl overflow-hidden divide-y divide-border/50">
                
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <div className="p-1.5 rounded-md bg-red-500/10 text-red-500"><CalendarDays className="h-4 w-4" /></div>
                    Datum
                  </div>
                  <input 
                    type="date" 
                    value={selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleUpdateSelectedTask({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="bg-transparent text-sm text-secondary focus:outline-none"
                  />
                </div>

                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500"><AlertCircle className="h-4 w-4" /></div>
                    Priorität
                  </div>
                  <select 
                    value={selectedTask.priority}
                    onChange={(e) => handleUpdateSelectedTask({ priority: e.target.value as 'high' | 'normal' })}
                    className="bg-transparent text-sm text-secondary focus:outline-none"
                  >
                    <option value="normal">Ohne</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>
                
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500"><ListIcon className="h-4 w-4" /></div>
                    Liste
                  </div>
                  <select 
                    value={selectedTask.area || 'Personal'}
                    onChange={(e) => handleUpdateSelectedTask({ area: e.target.value })}
                    className="bg-transparent text-sm text-secondary focus:outline-none"
                  >
                    {customLists.map(list => (
                      <option key={list} value={list}>{list}</option>
                    ))}
                  </select>
                </div>

              </div>

            </div>

            <div className="p-4 border-t border-border/40 flex justify-end bg-background/50 backdrop-blur-sm">
              <button 
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Löschen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
