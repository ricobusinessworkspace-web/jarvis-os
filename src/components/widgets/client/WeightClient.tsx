'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Scale, Activity } from 'lucide-react';
import { addWeightEntry } from '@/actions/dashboard';

interface Props {
  initialItems: any[];
}

export function WeightClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  const handleCreate = async () => {
    const weightVal = parseFloat(newWeight.replace(',', '.'));
    if (!newWeight.trim() || isNaN(weightVal)) {
      setIsAdding(false);
      return;
    }
    setIsAdding(false);
    setNewWeight('');

    // Optimistic
    const tempId = 'temp-' + Date.now();
    const newItem = { id: tempId, weight: weightVal, date: new Date() };
    setItems(prev => [newItem, ...prev]);

    const res = await addWeightEntry(weightVal);
    if (res.success) {
      setItems(prev => prev.map(i => i.id === tempId ? res.data : i));
    }
  };

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <Scale className="h-4 w-4 text-emerald-400" /> Weight Tracker
        </h3>
        <button 
          onClick={() => setIsAdding(true)} 
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-1 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[300px]">
        {isAdding && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-background/60 border border-emerald-500/30 rounded-xl">
            <input
              type="text"
              autoFocus
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsAdding(false); }}
              onBlur={() => handleCreate()}
              placeholder="Gewicht eintragen (z.B. 80.5)"
              className="w-full bg-transparent text-xs text-foreground outline-none"
            />
          </motion.div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence>
              {items.map(item => (
                <motion.div key={item.id} layout className="p-2.5 bg-background/60 border border-border/40 rounded-xl flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0 text-emerald-400/80 bg-emerald-400/10 p-1.5 rounded-lg">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{item.weight} kg</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {new Date(item.date).toLocaleDateString('de-DE')} {new Date(item.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {items.length === 0 && !isAdding && (
          <p className="text-xs text-muted italic text-center py-4">Keine Gewichtseinträge vorhanden.</p>
        )}
      </div>
    </div>
  );
}
