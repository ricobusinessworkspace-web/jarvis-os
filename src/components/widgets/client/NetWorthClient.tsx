'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, TrendingUp, Plus, Check, ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import { logNetWorth, logTransaction } from '@/actions/dashboard';

interface NetWorthEntry {
  id: string;
  value: number;
  target: number;
  date: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  date: string;
}

interface Props {
  initialHistory: NetWorthEntry[];
  initialCurrent: NetWorthEntry | null;
  initialTransactions: Transaction[];
}

export function NetWorthClient({ initialHistory, initialCurrent, initialTransactions }: Props) {
  const [history, setHistory] = useState(initialHistory);
  const [current, setCurrent] = useState(initialCurrent);
  const [transactions, setTransactions] = useState(initialTransactions);
  
  // Correction Mode (Manual)
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [newValue, setNewValue] = useState(current?.value?.toString() || '');
  const [newTarget, setNewTarget] = useState(current?.target?.toString() || '100000');

  // Transaction Mode
  const [isAddingTx, setIsAddingTx] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txDescription, setTxDescription] = useState('');

  const displayValue = current?.value || 0;
  const displayTarget = current?.target || 100000;
  const progressPercent = Math.min(100, Math.max(0, (displayValue / displayTarget) * 100));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const handleManualCorrection = async () => {
    const v = parseFloat(newValue.replace(/[^0-9.-]+/g, ''));
    const t = parseFloat(newTarget.replace(/[^0-9.-]+/g, ''));
    if (isNaN(v) || isNaN(t)) return;

    setIsCorrecting(false);

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

  const handleAddTransaction = async () => {
    const amount = parseFloat(txAmount.replace(/[^0-9.-]+/g, ''));
    if (isNaN(amount) || !txCategory) return;
    setIsAddingTx(false);

    const newTx: Transaction = {
      id: 'temp-' + Date.now(),
      amount,
      type: txType,
      category: txCategory,
      description: txDescription,
      date: new Date().toISOString(),
    };

    setTransactions(prev => [newTx, ...prev]);

    // Optimistically update net worth
    const diff = txType === 'income' ? amount : -amount;
    const nextVal = displayValue + diff;
    const newNwEntry: NetWorthEntry = {
      id: 'temp-nw-' + Date.now(),
      value: nextVal,
      target: displayTarget,
      date: new Date().toISOString(),
    };
    setCurrent(newNwEntry);
    setHistory(prev => [...prev, newNwEntry]);

    setTxAmount('');
    setTxCategory('');
    setTxDescription('');

    await logTransaction({ amount, type: txType, category: txCategory, description: txDescription });
  };

  const chartData = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
    NetWorth: h.value
  }));

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl shadow-sm h-full flex flex-col md:flex-row overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* LEFT: Net Worth Chart */}
      <div className="flex-1 p-6 flex flex-col relative z-10 border-b md:border-b-0 md:border-r border-border/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
            <div className="bg-emerald-500/20 p-1.5 rounded-lg">
              <Wallet className="h-4 w-4 text-emerald-400" />
            </div>
            Vermögen
          </h3>
          <button onClick={() => setIsCorrecting(!isCorrecting)} className="text-[10px] uppercase font-bold text-muted hover:text-emerald-400 transition-colors">
            {isCorrecting ? 'Abbrechen' : 'Korrigieren'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isCorrecting ? (
            <motion.div 
              key="correcting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-4"
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Ziel (€)</label>
                <input 
                  type="number" 
                  value={newTarget} 
                  onChange={e => setNewTarget(e.target.value)} 
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground focus:border-emerald-500/50 outline-none"
                  placeholder="1000000"
                />
              </div>
              <button 
                onClick={handleManualCorrection} 
                className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-1.5 text-sm"
              >
                <Check className="h-4 w-4" /> Aktualisieren
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="viewing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                {formatCurrency(displayValue)}
              </h1>
              <div className="flex items-center gap-2 mt-2 mb-6">
                <span className="text-xs font-semibold text-muted bg-overlay/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  Ziel: {formatCurrency(displayTarget)}
                </span>
              </div>

              {/* Progress */}
              <div className="space-y-2 mb-6 max-w-sm">
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

              {/* Sparkline */}
              <div className="flex-1 min-h-[120px] w-full mt-auto relative -mx-2">
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
                    <p className="text-[10px] font-bold text-muted/40 uppercase tracking-widest text-center">Mehr Daten benötigt</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT: Transaction Ledger */}
      <div className="w-full md:w-[320px] bg-background/30 flex flex-col z-10 relative">
        <div className="p-4 border-b border-border/20 flex items-center justify-between">
          <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted">Cashflow</h4>
          <button 
            onClick={() => setIsAddingTx(true)}
            className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {isAddingTx && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-elevated border border-border/50 rounded-xl p-3 space-y-3 mb-4"
              >
                <div className="flex bg-overlay/50 rounded-lg p-1">
                  <button onClick={() => setTxType('income')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${txType === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted'}`}>Einnahme</button>
                  <button onClick={() => setTxType('expense')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${txType === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-muted'}`}>Ausgabe</button>
                </div>
                
                <input type="number" placeholder="Betrag (€)" value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-accent" />
                <input type="text" placeholder="Kategorie (z.B. Provision)" value={txCategory} onChange={e => setTxCategory(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-accent" />
                
                <div className="flex gap-2">
                  <button onClick={handleAddTransaction} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-2 rounded-lg text-xs transition-colors">Buchen</button>
                  <button onClick={() => setIsAddingTx(false)} className="p-2 text-muted hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
                </div>
              </motion.div>
            )}

            {transactions.length === 0 && !isAddingTx && (
              <p className="text-xs text-muted/60 text-center italic py-4">Noch keine Transaktionen geloggt.</p>
            )}

            {transactions.map(tx => {
              const isIncome = tx.type === 'income';
              return (
                <motion.div key={tx.id} layout className="flex items-center justify-between p-2.5 rounded-xl bg-overlay/20 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {isIncome ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{tx.category}</p>
                      <p className="text-[9px] text-muted">{new Date(tx.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-black tracking-tight ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
