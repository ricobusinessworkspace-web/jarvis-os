'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, PenTool, Plus, CheckCircle2, Video } from 'lucide-react';
import { updateContentItem, createContentItem } from '@/actions/dashboard';

interface Props {
  initialItems: any[];
}

export function ContentClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    let newStatus = 'idee';
    if (currentStatus === 'idee') newStatus = 'draft';
    else if (currentStatus === 'draft') newStatus = 'published';
    else newStatus = 'idee';

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    await updateContentItem(id, { status: newStatus });
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      setIsAdding(false);
      return;
    }
    const title = newTitle.trim();
    setIsAdding(false);
    setNewTitle('');

    // Optimistic
    const tempId = 'temp-' + Date.now();
    const newItem = { id: tempId, title, status: 'idee', category: 'Creator', priority: 'normal' };
    setItems(prev => [newItem, ...prev]);

    const res = await createContentItem({ title, status: 'idee', category: 'Creator', priority: 'normal' });
    if (res.success) {
      setItems(prev => prev.map(i => i.id === tempId ? res.data : i));
    }
  };

  const ideas = items.filter(i => i.status === 'idee');
  const drafts = items.filter(i => i.status === 'draft');

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <Video className="h-4 w-4 text-purple-400" /> Content Pipeline
        </h3>
        <button 
          onClick={() => setIsAdding(true)} 
          className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 p-1 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[300px]">
        {isAdding && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-background/60 border border-purple-500/30 rounded-xl">
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsAdding(false); }}
              onBlur={() => handleCreate()}
              placeholder="Neue Idee..."
              className="w-full bg-transparent text-xs text-foreground outline-none"
            />
          </motion.div>
        )}

        {drafts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">In Produktion ({drafts.length})</h4>
            <AnimatePresence>
              {drafts.map(item => (
                <motion.div key={item.id} layout className="p-2.5 bg-background/60 border border-border/40 rounded-xl flex items-center gap-2.5 group">
                  <button onClick={() => handleUpdateStatus(item.id, item.status)} className="shrink-0 text-amber-400/80 hover:text-green-400 transition-colors bg-amber-400/10 p-1.5 rounded-lg">
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
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Ideen ({ideas.length})</h4>
            <AnimatePresence>
              {ideas.map(item => (
                <motion.div key={item.id} layout className="p-2.5 bg-overlay/20 border border-border/20 rounded-xl flex items-center gap-2.5 group">
                  <button onClick={() => handleUpdateStatus(item.id, item.status)} className="shrink-0 text-muted/60 hover:text-amber-400 transition-colors p-1.5">
                    <Lightbulb className="h-3.5 w-3.5" />
                  </button>
                  <p className="text-xs font-medium text-muted-foreground flex-1 truncate group-hover:text-foreground transition-colors">{item.title}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {items.length === 0 && !isAdding && (
          <p className="text-xs text-muted italic text-center py-4">Keine Content-Ideen vorhanden.</p>
        )}
      </div>
    </div>
  );
}
