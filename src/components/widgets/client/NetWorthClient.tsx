'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, TrendingUp, Plus, Check, ArrowDownRight, ArrowUpRight, X, Building, Landmark, PiggyBank, Receipt, Banknote } from 'lucide-react';
import { updateFinanceBuckets, addPipelineItem, markPipelineItemCleared } from '@/actions/dashboard';

interface NetWorthEntry { id: string; value: number; target: number; date: string; }
interface Transaction { id: string; amount: number; type: string; category: string; description: string; date: string; status: string; }
interface Buckets { liquid: number; depot: number; assets: number; debt: number; }

interface Props {
  initialHistory: NetWorthEntry[];
  initialCurrent: NetWorthEntry | null;
  initialBuckets: Buckets;
  initialPipeline: Transaction[];
}

export function NetWorthClient({ initialHistory, initialCurrent, initialBuckets, initialPipeline }: Props) {
  const [history, setHistory] = useState(initialHistory);
  const [current, setCurrent] = useState(initialCurrent);
  const [buckets, setBuckets] = useState(initialBuckets);
  const [pipeline, setPipeline] = useState(initialPipeline);
  
  const [activeTab, setActiveTab] = useState<'balances' | 'pipeline'>('balances');
  
  // Balances Update State
  const [isUpdatingBuckets, setIsUpdatingBuckets] = useState(false);
  const [bLiquid, setBLiquid] = useState(buckets.liquid.toString());
  const [bDepot, setBDepot] = useState(buckets.depot.toString());
  const [bAssets, setBAssets] = useState(buckets.assets.toString());
  const [bDebt, setBDebt] = useState(buckets.debt.toString());

  // Pipeline Add State
  const [isAddingTx, setIsAddingTx] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');

  const displayValue = current?.value || 0;
  const displayTarget = current?.target || 100000;
  const progressPercent = Math.min(100, Math.max(0, (displayValue / displayTarget) * 100));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const handleUpdateBuckets = async () => {
    const l = parseFloat(bLiquid) || 0;
    const d = parseFloat(bDepot) || 0;
    const a = parseFloat(bAssets) || 0;
    const db = parseFloat(bDebt) || 0;
    
    setIsUpdatingBuckets(false);
    const newBuckets = { liquid: l, depot: d, assets: a, debt: db };
    setBuckets(newBuckets);
    
    const newVal = l + d + a - db;
    const newEntry: NetWorthEntry = { id: 'temp-' + Date.now(), value: newVal, target: displayTarget, date: new Date().toISOString() };
    
    setCurrent(newEntry);
    setHistory(prev => [...prev, newEntry]);

    await updateFinanceBuckets(newBuckets, displayTarget);
  };

  const handleAddPipeline = async () => {
    const amount = parseFloat(txAmount.replace(/[^0-9.-]+/g, ''));
    if (isNaN(amount) || !txCategory) return;
    setIsAddingTx(false);

    const newTx: Transaction = {
      id: 'temp-' + Date.now(),
      amount, type: txType, category: txCategory, description: '', date: new Date().toISOString(), status: 'pending'
    };

    setPipeline(prev => [...prev, newTx]);
    setTxAmount(''); setTxCategory('');
    await addPipelineItem({ amount, type: txType, category: txCategory });
  };

  const handleClearPipelineItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPipeline(prev => prev.filter(p => p.id !== id));
    await markPipelineItemCleared(id);
  };

  const chartData = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
    NetWorth: h.value
  }));

  const pendingIncome = pipeline.filter(p => p.type === 'income').reduce((sum, p) => sum + p.amount, 0);
  const pendingExpense = pipeline.filter(p => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0);
  const safeToSpend = buckets.liquid + pendingIncome - pendingExpense;

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-3xl shadow-sm h-full flex flex-col xl:flex-col 2xl:flex-row overflow-hidden relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* LEFT: Net Worth Chart */}
      <div className="flex-1 p-6 flex flex-col relative z-10 border-b 2xl:border-b-0 2xl:border-r border-border/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
            <div className="bg-emerald-500/20 p-1.5 rounded-lg"><Wallet className="h-4 w-4 text-emerald-400" /></div>
            Vermögen
          </h3>
        </div>

        <div className="flex-1 flex flex-col">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">{formatCurrency(displayValue)}</h1>
          <div className="flex items-center gap-2 mt-2 mb-6">
            <span className="text-xs font-semibold text-muted bg-overlay/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" /> Ziel: {formatCurrency(displayTarget)}
            </span>
          </div>

          <div className="space-y-2 mb-6 max-w-sm">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
              <span className="text-emerald-400">Fortschritt</span><span className="text-muted">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full bg-background/60 rounded-full overflow-hidden border border-border/30">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" />
            </div>
          </div>

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
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#34d399', fontWeight: 'bold' }} labelStyle={{ color: '#888' }} formatter={(value: any) => formatCurrency(Number(value) || 0)} />
                  <Area type="monotone" dataKey="NetWorth" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorNw)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"><p className="text-[10px] font-bold text-muted/40 uppercase tracking-widest text-center">Mehr Daten benötigt</p></div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Tabs (Balances / Pipeline) */}
      <div className="w-full 2xl:w-[360px] bg-background/30 flex flex-col z-10 relative">
        <div className="flex border-b border-border/20">
          <button onClick={() => setActiveTab('balances')} className={`flex-1 p-4 text-[11px] font-bold tracking-widest uppercase transition-colors ${activeTab === 'balances' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-muted hover:text-foreground'}`}>Balances</button>
          <button onClick={() => setActiveTab('pipeline')} className={`flex-1 p-4 text-[11px] font-bold tracking-widest uppercase transition-colors ${activeTab === 'pipeline' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-muted hover:text-foreground'}`}>Pipeline</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'balances' ? (
              <motion.div key="balances" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                
                {isUpdatingBuckets ? (
                  <div className="space-y-3 bg-overlay/30 p-3 rounded-2xl border border-border/30">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted">Giro / Cash (€)</label>
                      <input type="number" value={bLiquid} onChange={e => setBLiquid(e.target.value)} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted">Depots / Crypto (€)</label>
                      <input type="number" value={bDepot} onChange={e => setBDepot(e.target.value)} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted">Sachwerte (€)</label>
                      <input type="number" value={bAssets} onChange={e => setBAssets(e.target.value)} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted">Schulden / Steuern (€)</label>
                      <input type="number" value={bDebt} onChange={e => setBDebt(e.target.value)} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <button onClick={handleUpdateBuckets} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-lg text-xs mt-2 transition-colors">Speichern</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-overlay/30 p-3 rounded-2xl border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-500/10 p-2 rounded-lg"><Landmark className="h-4 w-4 text-blue-400" /></div>
                        <p className="text-xs font-bold text-foreground">Liquidität</p>
                      </div>
                      <p className="text-sm font-black">{formatCurrency(buckets.liquid)}</p>
                    </div>
                    
                    <div className="flex justify-between items-center bg-overlay/30 p-3 rounded-2xl border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-500/10 p-2 rounded-lg"><TrendingUp className="h-4 w-4 text-purple-400" /></div>
                        <p className="text-xs font-bold text-foreground">Depot</p>
                      </div>
                      <p className="text-sm font-black">{formatCurrency(buckets.depot)}</p>
                    </div>

                    <div className="flex justify-between items-center bg-overlay/30 p-3 rounded-2xl border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-500/10 p-2 rounded-lg"><Building className="h-4 w-4 text-orange-400" /></div>
                        <p className="text-xs font-bold text-foreground">Assets</p>
                      </div>
                      <p className="text-sm font-black">{formatCurrency(buckets.assets)}</p>
                    </div>

                    <div className="flex justify-between items-center bg-red-500/5 p-3 rounded-2xl border border-red-500/20">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 p-2 rounded-lg"><Receipt className="h-4 w-4 text-red-400" /></div>
                        <p className="text-xs font-bold text-red-400">Schulden</p>
                      </div>
                      <p className="text-sm font-black text-red-400">-{formatCurrency(buckets.debt)}</p>
                    </div>

                    <button onClick={() => setIsUpdatingBuckets(true)} className="w-full bg-elevated border border-border/50 hover:border-emerald-500/50 text-xs font-bold py-2 rounded-xl transition-colors mt-2 text-muted-foreground">Buckets updaten</button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="pipeline" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                
                {/* Safe to Spend Widget */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-4 rounded-2xl border border-emerald-500/20 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">Safe to Spend</p>
                  <p className="text-2xl font-black text-emerald-400">{formatCurrency(safeToSpend)}</p>
                  <p className="text-[10px] text-muted mt-1">Girokonto minus anstehende Ausgaben + Einnahmen.</p>
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold tracking-widest uppercase text-muted">Ausstehend</h4>
                  <button onClick={() => setIsAddingTx(true)} className="bg-overlay p-1.5 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"><Plus className="h-3 w-3" /></button>
                </div>

                <AnimatePresence>
                  {isAddingTx && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-elevated border border-border/50 rounded-xl p-3 space-y-3 mb-2 overflow-hidden">
                      <div className="flex bg-overlay/50 rounded-lg p-1">
                        <button onClick={() => setTxType('income')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${txType === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted'}`}>Einnahme</button>
                        <button onClick={() => setTxType('expense')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${txType === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-muted'}`}>Ausgabe</button>
                      </div>
                      <input type="number" placeholder="Betrag (€)" value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
                      <input type="text" placeholder="Bezeichnung (z.B. Steuern)" value={txCategory} onChange={e => setTxCategory(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <button onClick={handleAddPipeline} className="flex-1 bg-emerald-500/20 text-emerald-400 font-bold py-2 rounded-lg text-xs">Hinzufügen</button>
                        <button onClick={() => setIsAddingTx(false)} className="p-2 text-muted"><X className="h-4 w-4" /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  {pipeline.length === 0 && !isAddingTx && (
                    <p className="text-xs text-muted/60 text-center italic py-4">Pipeline ist leer.</p>
                  )}
                  {pipeline.map(tx => {
                    const isIncome = tx.type === 'income';
                    return (
                      <motion.div layout key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl bg-overlay/20 border border-border/30 group">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => handleClearPipelineItem(tx.id, e)}
                            className={`p-1.5 rounded-lg border border-dashed hover:border-solid transition-colors ${isIncome ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'border-red-500/30 text-red-400 hover:bg-red-500/20'}`}
                            title="Als bezahlt markieren"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <div>
                            <p className="text-xs font-bold text-foreground">{tx.category}</p>
                            <p className="text-[9px] text-muted">{new Date(tx.date).toLocaleDateString('de-DE')}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-black tracking-tight ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
