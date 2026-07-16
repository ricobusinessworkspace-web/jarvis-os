'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Wallet, TrendingUp, Plus, Check } from 'lucide-react';
import { logNetWorth } from '@/actions/dashboard';

interface NetWorthEntry {
  id: string;
  value: number;
  target: number;
  date: string;
}

interface Props {
  initialHistory: NetWorthEntry[];
  initialCurrent: NetWorthEntry | null;
}

export function NetWorthClient({ initialHistory, initialCurrent }: Props) {
  const [history, setHistory] = useState(initialHistory);
  const [current, setCurrent] = useState(initialCurrent);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [newValue, setNewValue] = useState(current?.value?.toString() || '');
  const [newTarget, setNewTarget] = useState(current?.target?.toString() || '100000');

  // We ensure there's a baseline to render something decent, even if it's 0.
  const displayValue = current?.value || 0;
  const displayTarget = current?.target || 100000;
  const progressPercent = Math.min(100, Math.max(0, (displayValue / displayTarget) * 100));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const handleSave = async () => {
    const v = parseFloat(newValue.replace(/[^0-9.-]+/g, ''));
    const t = parseFloat(newTarget.replace(/[^0-9.-]+/g, ''));
    if (isNaN(v) || isNaN(t)) return;

    setIsUpdating(false);

    // Optimistic Update
    const newEntry: NetWorthEntry = {
      id: 'temp-' + Date.now(),
      value: v,
      target: t,
      date: new Date().toISOString(),
    };
    
    setCurrent(newEntry);
    setHistory(prev => [...prev, newEntry]);

    const res = await logNetWorth(v, t);
    if (res.success && res.data) {
      setCurrent(res.data as unknown as NetWorthEntry);
      setHistory(prev => prev.map(item => item.id === newEntry.id ? (res.data as unknown as NetWorthEntry) : item));
    }
  };

  // Prepare data for recharts
  const chartData = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
    NetWorth: h.value
  }));

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl p-6 shadow-sm flex flex-col space-y-6 h-full relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <div className="bg-emerald-500/20 p-1.5 rounded-lg">
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          Net Worth
        </h3>
        {!isUpdating && (
          <button 
            onClick={() => setIsUpdating(true)} 
            className="text-xs font-semibold text-emerald-400/80 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Update
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isUpdating ? (
          <motion.div 
            key="updating"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col gap-4 z-10"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Aktueller Wert (€)</label>
              <input 
                type="number" 
                value={newValue} 
                onChange={e => setNewValue(e.target.value)} 
                className="w-full bg-background/50 border border-emerald-500/30 rounded-xl px-4 py-3 text-lg font-bold text-foreground focus:border-emerald-500 outline-none"
                placeholder="150000"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Ziel / Target (€)</label>
              <input 
                type="number" 
                value={newTarget} 
                onChange={e => setNewTarget(e.target.value)} 
                className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground focus:border-emerald-500/50 outline-none"
                placeholder="1000000"
              />
            </div>
            <div className="flex gap-2 mt-auto">
              <button 
                onClick={handleSave} 
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-1.5 text-sm"
              >
                <Check className="h-4 w-4" /> Speichern
              </button>
              <button 
                onClick={() => setIsUpdating(false)} 
                className="px-4 bg-overlay/50 hover:bg-overlay text-muted font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Abbrechen
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="viewing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col z-10"
          >
            {/* Value Display */}
            <div className="mb-6">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                {formatCurrency(displayValue)}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-semibold text-muted bg-overlay/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  Ziel: {formatCurrency(displayTarget)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="text-emerald-400">Fortschritt</span>
                <span className="text-muted">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full bg-background/60 rounded-full overflow-hidden border border-border/30">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                />
              </div>
            </div>

            {/* Mini Chart */}
            <div className="flex-1 min-h-[100px] w-full mt-auto relative -mx-2">
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                      labelStyle={{ color: '#888' }}
                      formatter={(value: any) => formatCurrency(Number(value) || 0)}
                    />
                    <Area type="monotone" dataKey="NetWorth" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorNw)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-[10px] font-bold text-muted/40 uppercase tracking-widest text-center">Mehr Daten benötigt für Chart</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
