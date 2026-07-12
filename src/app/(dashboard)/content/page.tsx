'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  KanbanSquare, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle, 
  Circle,
  FolderDot,
  Pencil,
  X,
  Check,
  ListChecks,
  CalendarCheck,
  Star,
  FileText
} from 'lucide-react';
import {
  createTask,
  updateTask,
  deleteTask,
  createContentItem,
  updateContentItem,
  deleteContentItem,
  updateSetting
} from '@/actions/dashboard';
import type { ContentItem, Task, Subtask } from '@/types';

type ContentStatus = 'idee' | 'in_arbeit' | 'geplant' | 'veroeffentlicht';

const DEFAULT_COLUMNS: { id: ContentStatus; label: string; color: string; bg: string }[] = [
  { id: 'idee', label: 'Ideen', color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/10' },
  { id: 'in_arbeit', label: 'In Arbeit', color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/10' },
  { id: 'geplant', label: 'Geplant', color: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/10' },
  { id: 'veroeffentlicht', label: 'Veröffentlicht', color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/10' },
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function ContentAndTasksPage() {
  const contentItems = useStore((state) => state.contentItems);
  const tasks = useStore((state) => state.tasks);
  const settings = useStore((state) => state.settings);
  
  const addContentItem = useStore((state) => state.addContentItem);
  const updateContentItemInStore = useStore((state) => state.updateContentItemInStore);
  const removeContentItem = useStore((state) => state.removeContentItem);
  
  const addTask = useStore((state) => state.addTask);
  const updateTaskInStore = useStore((state) => state.updateTaskInStore);
  const removeTask = useStore((state) => state.removeTask);
  const updateSettingInStore = useStore((state) => state.updateSettingInStore);

  // --- Content Form ---
  const [newContentTitle, setNewContentTitle] = useState('');
  const [newContentProject, setNewContentProject] = useState('');
  const [newContentDeadline, setNewContentDeadline] = useState('');
  const [showAddContentForm, setShowAddContentForm] = useState(false);

  // --- Task Form ---
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // --- Inline Edit State ---
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  
  // --- Task Edit State ---
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDeadline, setEditTaskDeadline] = useState('');
  const [editTaskNotes, setEditTaskNotes] = useState('');

  // --- Subtask State ---
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // --- Column Edit State ---
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState('');

  
  // --- Helpers ---
  const getProjectTags = (item: ContentItem): string[] => {
    if (!item.projectTags) return [];
    if (typeof item.projectTags === 'string') {
      try { return JSON.parse(item.projectTags); } catch { return []; }
    }
    return item.projectTags;
  };

  const getColName = (id: string, defaultName: string) => {
    return settings[`kanban_col_${id}`] || defaultName;
  };

  const handleSaveColName = async (id: string) => {
    if (!editColName.trim()) return;
    try {
      const res = await updateSetting(`kanban_col_${id}`, editColName.trim());
      if (res.success) {
        updateSettingInStore(`kanban_col_${id}`, editColName.trim());
        setEditingColId(null);
      }
    } catch (e) {
      console.error('Error saving col name:', e);
    }
  };

  // --- Content CRUD ---
  const handleAddContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContentTitle.trim()) return;
    
    const tags = newContentProject.trim() ? [newContentProject.trim()] : [];
    
    try {
      const isoDeadline = newContentDeadline ? new Date(newContentDeadline).toISOString() : null;
      const res = await createContentItem({
        title: newContentTitle,
        status: 'idee',
        publishDate: isoDeadline,
        projectTags: JSON.stringify(tags),
      });
      if (res.success && res.data) {
        addContentItem({ ...(res.data as any), subtasks: [], projectTags: tags });
        setNewContentTitle('');
        setNewContentProject('');
        setNewContentDeadline('');
        setShowAddContentForm(false);
      }
    } catch (err) {
      console.error('Error creating content item:', err);
    }
  };

  const handleMoveContent = async (item: ContentItem, nextStatus: ContentStatus) => {
        try {
      const res = await updateContentItem(item.id, { status: nextStatus });
      if (res.success) updateContentItemInStore(item.id, { status: nextStatus });
    } catch (err) {
      console.error('Error updating content status:', err);
    }
  };

  const handleDeleteContent = async (id: string) => {
        try {
      const res = await deleteContentItem(id);
      if (res.success) removeContentItem(id);
    } catch (err) {
      console.error('Error deleting content item:', err);
    }
  };

  const handleSaveCardEdit = async (item: ContentItem) => {
    if (!editTitle.trim()) return;
    const tags = editProject.trim() ? [editProject.trim()] : [];
    
    try {
      const isoDeadline = editDeadline ? new Date(editDeadline).toISOString() : null;
      const res = await updateContentItem(item.id, { 
        title: editTitle, 
        publishDate: isoDeadline,
        projectTags: JSON.stringify(tags) 
      });
      if (res.success) {
        updateContentItemInStore(item.id, { title: editTitle, publishDate: isoDeadline, projectTags: tags });
        setEditingCard(null);
      }
    } catch (err) {
      console.error('Error saving card edit:', err);
    }
  };

  // --- Subtask CRUD ---
  const getSubtasks = (item: ContentItem): Subtask[] => {
    if (!item.subtasks) return [];
    if (typeof item.subtasks === 'string') {
      try { return JSON.parse(item.subtasks); } catch { return []; }
    }
    return item.subtasks;
  };

  const handleAddSubtask = async (item: ContentItem) => {
    if (!newSubtaskTitle.trim()) return;
    const subtasks = getSubtasks(item);
    const updated = [...subtasks, { id: generateId(), title: newSubtaskTitle.trim(), done: false }];
    try {
      const res = await updateContentItem(item.id, { subtasks: JSON.stringify(updated) });
      if (res.success) {
        updateContentItemInStore(item.id, { subtasks: updated });
        setNewSubtaskTitle('');
      }
    } catch (err) {
      console.error('Error adding subtask:', err);
    }
  };

  const handleToggleSubtask = async (item: ContentItem, subtaskId: string) => {
        const subtasks = getSubtasks(item);
    const updated = subtasks.map(st => st.id === subtaskId ? { ...st, done: !st.done } : st);
    try {
      const res = await updateContentItem(item.id, { subtasks: JSON.stringify(updated) });
      if (res.success) updateContentItemInStore(item.id, { subtasks: updated });
    } catch (err) {
      console.error('Error toggling subtask:', err);
    }
  };

  const handleDeleteSubtask = async (item: ContentItem, subtaskId: string) => {
        const subtasks = getSubtasks(item);
    const updated = subtasks.filter(st => st.id !== subtaskId);
    try {
      const res = await updateContentItem(item.id, { subtasks: JSON.stringify(updated) });
      if (res.success) updateContentItemInStore(item.id, { subtasks: updated });
    } catch (err) {
      console.error('Error deleting subtask:', err);
    }
  };

  // --- Task CRUD ---
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const isoDeadline = newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null;
      const res = await createTask({
        title: newTaskTitle,
        dueDate: isoDeadline,
        status: 'todo' as const,
        priority: 'normal' as const
      });
      if (res.success && res.data) {
        addTask(res.data as any);
        setNewTaskTitle('');
        setNewTaskDeadline('');
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleToggleTask = async (task: Task) => {
        const newStatus = task.status === 'todo' ? 'done' : 'todo';
    const completedAt = newStatus === 'done' ? new Date().toISOString().split('T')[0] : null;
    try {
      const res = await updateTask(task.id, { status: newStatus, completedAt });
      if (res.success) updateTaskInStore(task.id, { status: newStatus, completedAt });
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
        try {
      const res = await deleteTask(id);
      if (res.success) removeTask(id);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleSaveTaskEdit = async (task: Task) => {
    if (!editTaskTitle.trim()) return;
    try {
      const isoDeadline = editTaskDeadline ? new Date(editTaskDeadline).toISOString() : null;
      const res = await updateTask(task.id, { title: editTaskTitle, dueDate: isoDeadline, notes: editTaskNotes });
      if (res.success) {
        updateTaskInStore(task.id, { title: editTaskTitle, dueDate: isoDeadline, notes: editTaskNotes });
        setEditingTask(null);
      }
    } catch (err) {
      console.error('Error saving task edit:', err);
    }
  };

  const getDateBadge = (dateStr: string | null) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: `Überfällig (${Math.abs(diffDays)} T.)`, className: 'bg-red-500/10 text-red-400 border border-red-500/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
    if (diffDays === 0) return { text: 'Heute', className: 'bg-red-500/15 text-red-500 border border-red-500/30 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 animate-pulse-soft' };
    if (diffDays === 1) return { text: 'Morgen', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
    if (diffDays <= 7) return { text: `In ${diffDays} Tagen`, className: 'bg-accent/10 text-accent border border-accent/20 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
    return { text: dateStr, className: 'bg-overlay/50 text-muted border border-border/50 font-medium px-2 py-0.5 rounded text-[10px] flex items-center gap-1' };
  };

  const handleToggleTaskPriority = async (task: Task) => {
        const newPriority = task.priority === 'high' ? 'normal' : 'high';
    try {
      const res = await updateTask(task.id, { priority: newPriority });
      if (res.success) updateTaskInStore(task.id, { priority: newPriority });
    } catch (err) { console.error('Error toggling task priority:', err); }
  };

  const handleToggleContentPriority = async (item: ContentItem) => {
        const newPriority = item.priority === 'high' ? 'normal' : 'high';
    try {
      const res = await updateContentItem(item.id, { priority: newPriority });
      if (res.success) updateContentItemInStore(item.id, { priority: newPriority as any });
    } catch (err) { console.error('Error toggling content priority:', err); }
  };

  return (
    <div className="flex flex-col min-h-full space-y-10 pb-16">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <KanbanSquare className="h-6 w-6 text-accent" /> Creator Pipeline & To-Do
          </h1>
          <p className="text-sm text-muted font-medium mt-1.5">
            Projektübersicht und Aufgabenverwaltung.
          </p>
        </div>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
        
        {/* Kanban */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Projekte Pipeline</h2>
            <button
              onClick={() => setShowAddContentForm(!showAddContentForm)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-accent/10 hover:bg-accent/20 text-accent px-4 py-2 rounded-xl transition-all"
            >
              <Plus className="h-4 w-4" /> Neues Item
            </button>
          </div>

          {/* Add Form */}
          <AnimatePresence>
            {showAddContentForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddContent}
                className="overflow-hidden bg-elevated/30 border border-border/30 rounded-2xl p-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="text-xs text-muted font-medium block mb-1.5">Titel</label>
                    <input type="text" required placeholder="z.B. Podcast Episode 5..." value={newContentTitle} onChange={(e) => setNewContentTitle(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted font-medium block mb-1.5">Projekt (Optional)</label>
                    <input type="text" placeholder="z.B. Personal Brand" value={newContentProject} onChange={(e) => setNewContentProject(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-muted font-medium block mb-1.5">Deadline (Optional)</label>
                    <input type="date" value={newContentDeadline} onChange={(e) => setNewContentDeadline(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 text-xs font-semibold pt-2">
                  <button type="button" onClick={() => setShowAddContentForm(false)} className="px-4 py-2 border border-border rounded-xl text-secondary hover:bg-overlay transition-colors">Abbrechen</button>
                  <button type="submit" className="px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors">Sichern</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 h-full min-h-[500px]">
            {DEFAULT_COLUMNS.map((col) => {
              const items = contentItems.filter(item => item.status === col.id).sort((a, b) => {
                const pa = a.priority === 'high' ? 1 : 0;
                const pb = b.priority === 'high' ? 1 : 0;
                return pb - pa;
              });
              const colName = getColName(col.id, col.label);
              const isEditingCol = editingColId === col.id;
              
              return (
                <div key={col.id} className={`flex flex-col rounded-2xl border p-4 ${col.bg} space-y-4 min-h-[300px]`}>
                  <div className="flex items-center justify-between border-b border-border/20 pb-3 group">
                    {isEditingCol ? (
                      <input 
                        type="text" 
                        value={editColName} 
                        onChange={(e) => setEditColName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveColName(col.id)}
                        onBlur={() => handleSaveColName(col.id)}
                        autoFocus
                        className="bg-background border border-border rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-foreground w-2/3 outline-none"
                      />
                    ) : (
                      <span 
                        className={`text-xs font-bold uppercase tracking-wider ${col.color} cursor-pointer`}
                        onClick={() => { setEditingColId(col.id); setEditColName(colName); }}
                      >
                        {colName}
                      </span>
                    )}
                    <span className="text-xs bg-overlay/60 px-2 py-0.5 rounded-full text-secondary font-semibold">{items.length}</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[550px] pr-1">
                    <AnimatePresence mode="popLayout">
                      {items.map((item) => {
                        const isEditing = editingCard === item.id;
                        const subtasks = getSubtasks(item);
                        const doneCount = subtasks.filter(st => st.done).length;
                        const projectTags = getProjectTags(item);
                        
                        return (
                          <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col bg-elevated/60 border border-border/30 rounded-xl p-4 space-y-3 hover:border-border/50 transition-all">
                            {isEditing ? (
                              <div className="space-y-3">
                                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent" autoFocus placeholder="Titel" />
                                <div className="flex gap-2">
                                  <input type="text" placeholder="Projekt..." value={editProject} onChange={(e) => setEditProject(e.target.value)} className="w-1/2 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent" />
                                  <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="w-1/2 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleSaveCardEdit(item)} className="text-accent text-xs font-semibold flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Speichern</button>
                                  <button onClick={() => setEditingCard(null)} className="text-muted text-xs font-medium flex items-center gap-1"><X className="h-3.5 w-3.5" /> Abbrechen</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    {projectTags.length > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <FolderDot className="h-3.5 w-3.5 text-accent" />
                                        <span className="text-xs text-muted font-semibold tracking-wide">{projectTags[0]}</span>
                                      </div>
                                    )}
                                    {(() => { const badge = getDateBadge(item.publishDate); return badge ? <span className={badge.className}>{badge.text}</span> : null; })()}
                                  </div>
                                  <h4 className="text-sm font-medium text-foreground leading-snug">{item.title}</h4>
                                </div>

                                {subtasks.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted">
                                    <ListChecks className="h-3.5 w-3.5" />
                                    <span>{doneCount}/{subtasks.length} erledigt</span>
                                  </div>
                                )}
                              </>
                            )}

                            {!isEditing && (
                              <div className="space-y-2 border-t border-border/20 pt-2">
                                {subtasks.map((st) => (
                                  <div key={st.id} className="flex items-center gap-2 group">
                                    <button onClick={() => handleToggleSubtask(item, st.id)} className="shrink-0">
                                      {st.done ? <CheckCircle className="h-3.5 w-3.5 text-accent" /> : <Circle className="h-3.5 w-3.5 text-muted/40" />}
                                    </button>
                                    <span className={`text-xs flex-1 ${st.done ? 'line-through text-muted' : 'text-secondary'}`}>{st.title}</span>
                                    <button onClick={() => handleDeleteSubtask(item, st.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"><X className="h-3 w-3" /></button>
                                  </div>
                                ))}
                                <div className="flex items-center gap-2">
                                  <Plus className="h-3 w-3 text-muted/40 shrink-0" />
                                  <input type="text" placeholder="Subtask..." value={editingCard === `sub-${item.id}` ? newSubtaskTitle : ''} onFocus={() => setEditingCard(`sub-${item.id}`)} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { handleAddSubtask(item); setEditingCard(null); } }} onBlur={() => { if (newSubtaskTitle.trim()) handleAddSubtask(item); setEditingCard(null); }} className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted/30 focus:outline-none py-1" />
                                </div>
                              </div>
                            )}

                            {!isEditing && (
                              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleToggleContentPriority(item)} className="p-1 transition-colors" title="Priorität"><Star className={`h-3.5 w-3.5 ${item.priority === 'high' ? 'fill-amber-400 text-amber-400' : 'text-muted/30 hover:text-amber-400/60'}`} /></button>
                                  <button onClick={() => { setEditingCard(item.id); setEditTitle(item.title); setEditProject(getProjectTags(item)[0] || ''); setEditDeadline(item.publishDate ? (typeof item.publishDate === 'string' ? item.publishDate.split('T')[0] : new Date(item.publishDate).toISOString().split('T')[0]) : ''); }} className="text-muted hover:text-foreground p-1 transition-colors" title="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleDeleteContent(item.id)} className="text-muted hover:text-red-400 p-1 transition-colors" title="Löschen"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                                <div className="flex items-center gap-1">
                                  {col.id !== 'idee' && <button onClick={() => { const prevIdx = DEFAULT_COLUMNS.findIndex(c => c.id === col.id) - 1; handleMoveContent(item, DEFAULT_COLUMNS[prevIdx].id); }} className="text-muted hover:text-foreground p-1 transition-colors bg-overlay/30 rounded"><ChevronLeft className="h-3.5 w-3.5" /></button>}
                                  {col.id !== 'veroeffentlicht' && <button onClick={() => { const nextIdx = DEFAULT_COLUMNS.findIndex(c => c.id === col.id) + 1; handleMoveContent(item, DEFAULT_COLUMNS[nextIdx].id); }} className="text-muted hover:text-foreground p-1 transition-colors bg-overlay/30 rounded"><ChevronRight className="h-3.5 w-3.5" /></button>}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {items.length === 0 && <div className="flex-1 flex items-center justify-center border border-dashed border-border/15 rounded-xl p-8 text-center"><span className="text-xs text-muted font-medium italic">Leer</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global To-Do List */}
        <div className="space-y-6 xl:col-span-1">
          <h2 className="text-base font-bold text-foreground">To-Do Liste</h2>

          <form onSubmit={handleAddTask} className="bg-elevated/30 border border-border/30 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs text-muted font-medium block mb-1.5">Neue Aufgabe</label>
              <div className="flex flex-col gap-2">
                <input type="text" required placeholder="Titel..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
                <div className="flex gap-2">
                  <input type="date" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent transition-colors" />
                  <button type="submit" className="bg-accent text-white px-3 py-2 rounded-xl hover:bg-accent-hover transition-all"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </form>

          <div className="bg-elevated/15 border border-border/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Allgemeine Aufgaben</h3>
            
            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {tasks
                  .sort((a, b) => {
                    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
                    const pa = a.priority === 'high' ? 1 : 0;
                    const pb = b.priority === 'high' ? 1 : 0;
                    if (pa !== pb) return pb - pa;
                    return 0;
                  })
                  .map((task) => {
                    const isDone = task.status === 'done';
                    const isEditing = editingTask === task.id;

                    return (
                      <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`p-3.5 rounded-xl border transition-all ${isDone ? 'bg-overlay/10 border-border/15 opacity-50' : 'bg-elevated/30 border-border/30'}`}>
                        {isEditing ? (
                          <div className="space-y-3">
                            <input type="text" value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent" autoFocus placeholder="Titel..." />
                            <textarea value={editTaskNotes} onChange={(e) => setEditTaskNotes(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent min-h-[60px] resize-y" placeholder="Notizen zur Aufgabe..." />
                            <input type="date" value={editTaskDeadline} onChange={(e) => setEditTaskDeadline(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent" />
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveTaskEdit(task)} className="text-accent text-xs font-semibold flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Sichern</button>
                              <button onClick={() => setEditingTask(null)} className="text-muted text-xs font-medium flex items-center gap-1"><X className="h-3.5 w-3.5" /> Abbrechen</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <button onClick={() => handleToggleTask(task)} className="mt-0.5 shrink-0">
                              {isDone ? <CheckCircle className="h-5 w-5 text-accent fill-accent/10" /> : <Circle className="h-5 w-5 text-muted/40" />}
                            </button>
                            <button onClick={() => handleToggleTaskPriority(task)} className="mt-0.5 shrink-0 transition-colors" title="Priorität">
                              <Star className={`h-4 w-4 ${task.priority === 'high' ? 'fill-amber-400 text-amber-400' : 'text-muted/30 hover:text-amber-400/60'}`} />
                            </button>
                            
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className={`text-sm font-medium leading-relaxed block ${isDone ? 'line-through text-muted' : 'text-foreground'}`}>{task.title}</span>
                              {task.notes && (
                                <p className={`text-xs leading-relaxed mt-1 mb-2 whitespace-pre-wrap ${isDone ? 'text-muted/60 line-through' : 'text-muted'}`}>
                                  {task.notes}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {(() => { const badge = getDateBadge(task.dueDate); return badge ? <span className={badge.className}>{badge.text}</span> : null; })()}
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <button onClick={() => { setEditingTask(task.id); setEditTaskTitle(task.title); setEditTaskDeadline(task.dueDate ? (typeof task.dueDate === 'string' ? task.dueDate.split('T')[0] : new Date(task.dueDate).toISOString().split('T')[0]) : ''); setEditTaskNotes(task.notes || ''); }} className="text-muted hover:text-foreground p-1 transition-colors" title="Bearbeiten"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDeleteTask(task.id)} className="text-muted hover:text-red-400 p-1 transition-colors" title="Löschen"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
              {tasks.length === 0 && <div className="text-center p-8 border border-dashed border-border/15 rounded-xl"><p className="text-sm text-muted italic">Keine Aufgaben vorhanden.</p></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
