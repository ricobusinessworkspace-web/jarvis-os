'use client';

import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Wallet, TrendingUp, PiggyBank, Landmark, 
  ArrowUpRight, ArrowDownRight, CircleDollarSign,
  FileText, Percent, Tag, Edit3, X, Check, Loader2, Target, Pencil, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@prisma/client';
import CSVUploader from '@/components/finance/CSVUploader';
import { updateTransaction, deleteTransaction, updateNetWorthGoal } from '@/actions/finance';
import { useRouter } from 'next/navigation';

interface FinanceData {
  buckets: { liquid: number, depot: number, assets: number, debt: number };
  netWorth: number;
  netWorthGoal: number | null;
  transactions: (Transaction & { taxRelevant: boolean; notes: string; tags: any })[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#a855f7', '#64748b'];

export default function FinanceClient({ initialData }: { initialData: FinanceData }) {
  const [data, setData] = useState<FinanceData>(initialData);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(initialData.netWorthGoal ? initialData.netWorthGoal.toString() : '');
  const router = useRouter();

  // --- Calculations ---
  const monthlyStats = useMemo(() => {
    const stats: Record<string, { month: string, income: number, expense: number }> = {};
    data.transactions.forEach(tx => {
      if (tx.status !== 'cleared') return;
      const d = new Date(tx.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!stats[monthKey]) stats[monthKey] = { month: monthKey, income: 0, expense: 0 };
      if (tx.type === 'income') stats[monthKey].income += tx.amount;
      else stats[monthKey].expense += tx.amount;
    });
    return Object.values(stats).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [data.transactions]);

  const categoryStats = useMemo(() => {
    const expenses = data.transactions.filter(t => t.type === 'expense' && t.status === 'cleared');
    const grouped = expenses.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data.transactions]);

  const formatEuro = (val: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
  const formatDate = (date: Date) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));

  // --- Handlers ---
  const handleSaveEdit = async () => {
    if (!editingTx) return;
    setIsSaving(true);
    const res = await updateTransaction(editingTx.id, {
      category: editingTx.category,
      notes: editingTx.notes,
      description: editingTx.description,
      amount: editingTx.amount,
      date: new Date(editingTx.date),
      taxRelevant: editingTx.taxRelevant,
    });
    
    if (res.success) {
      // Optimistic UI update
      setData(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === editingTx.id ? { ...t, ...editingTx, date: new Date(editingTx.date) } : t)
      }));
      setEditingTx(null);
      router.refresh();
    } else {
      alert("Fehler beim Speichern: " + res.error);
    }
    setIsSaving(false);
  };

  const handleDeleteTx = async () => {
    if (!editingTx) return;
    if (!confirm('Transaktion wirklich löschen?')) return;
    setIsDeleting(true);
    const res = await deleteTransaction(editingTx.id);
    if (res.success) {
      setData(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== editingTx.id)
      }));
      setEditingTx(null);
      router.refresh();
    } else {
      alert("Fehler beim Löschen: " + res.error);
    }
    setIsDeleting(false);
  };

  const handleSaveGoal = async () => {
    const target = parseFloat(goalInput);
    const finalTarget = isNaN(target) ? null : target;
    await updateNetWorthGoal(finalTarget);
    setData(prev => ({ ...prev, netWorthGoal: finalTarget }));
    setIsEditingGoal(false);
    router.refresh();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-fade-in pb-32 relative">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-xl text-accent"><Wallet className="h-6 w-6" /></div>
          Finance Hub 2.0
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm">Automatische Analyse, Kategorisierung und smarte Vorbereitung für deine Steuererklärung.</p>
      </header>

      {/* TOP ROW: KPIs & Uploader */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Net Worth & Tax */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Net Worth */}
          <div className="glass p-6 rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 to-transparent relative overflow-hidden group flex-1">
            <div className="absolute -top-4 -right-4 p-4 opacity-20 group-hover:opacity-40 transition-opacity transform group-hover:scale-110"><TrendingUp className="h-32 w-32 text-accent" /></div>
            <p className="text-sm font-bold text-accent uppercase tracking-wider mb-2">Dein Net Worth</p>
            <p className="text-5xl font-black text-foreground drop-shadow-md">{formatEuro(data.netWorth)}</p>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed max-w-[200px]">Das ist dein Spielstand. Jede kluge Entscheidung bringt diese Zahl nach oben.</p>
          </div>

          {/* Net Worth Goal */}
          <div className="glass p-6 rounded-3xl border border-border bg-gradient-to-tr from-purple-500/5 to-transparent relative overflow-hidden flex flex-col justify-between">
            <Target className="absolute right-6 top-6 h-12 w-12 text-purple-500/20" />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-bold text-purple-400 uppercase tracking-wider">Dein Net Worth Ziel</p>
                <button onClick={() => setIsEditingGoal(!isEditingGoal)} className="p-1 hover:bg-white/10 rounded-md text-muted-foreground hover:text-white transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              
              {isEditingGoal ? (
                <div className="flex gap-2 mt-2">
                  <input 
                    type="number" 
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 w-full text-white text-sm focus:outline-none focus:border-purple-500/50"
                    placeholder="Zielbetrag..."
                  />
                  <button onClick={handleSaveGoal} className="bg-purple-500 hover:bg-purple-600 text-white px-4 rounded-lg text-sm font-bold transition-colors">
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-foreground">
                    {data.netWorthGoal ? formatEuro(data.netWorthGoal) : 'Kein Ziel gesetzt'}
                  </p>
                  {data.netWorthGoal && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Fortschritt</span>
                        <span>{Math.min(100, Math.max(0, (data.netWorth / data.netWorthGoal) * 100)).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-accent rounded-full transition-all duration-1000 ease-out relative"
                          style={{ width: `${Math.min(100, Math.max(0, (data.netWorth / data.netWorthGoal) * 100))}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Middle/Right: Uploader */}
        <div className="lg:col-span-2 flex">
          <div className="w-full h-full min-h-[250px]">
            <CSVUploader />
          </div>
        </div>
      </div>

      {/* BUCKETS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-3 text-muted-foreground">
            <CircleDollarSign className="h-5 w-5 text-emerald-500" />
            <p className="text-sm font-medium">Girokonten (Liquid)</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatEuro(data.buckets.liquid)}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-3 text-muted-foreground">
            <PiggyBank className="h-5 w-5 text-blue-500" />
            <p className="text-sm font-medium">Depots & Krypto</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatEuro(data.buckets.depot)}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-3 text-muted-foreground">
            <Landmark className="h-5 w-5 text-purple-500" />
            <p className="text-sm font-medium">Feste Assets</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatEuro(data.buckets.assets)}</p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cashflow */}
        <div className="glass p-6 rounded-2xl border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">Cashflow (Letzte 6 Monate)</h2>
          <div className="h-[250px] w-full">
            {monthlyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} dy={10} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} formatter={(value: any) => formatEuro(Number(value))} />
                  <Bar dataKey="income" name="Einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" name="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-full flex items-center justify-center text-muted">Keine Daten.</div>)}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="glass p-6 rounded-2xl border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">Ausgaben nach Kategorie</h2>
          <div className="h-[250px] w-full">
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {categoryStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} formatter={(value: any) => formatEuro(Number(value))} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<div className="h-full flex items-center justify-center text-muted">Keine Daten.</div>)}
          </div>
        </div>
      </div>

      {/* TRANSACTION LIST */}
      <div className="glass rounded-2xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-bold text-foreground">Alle Transaktionen</h2>
          <span className="text-xs text-muted-foreground bg-overlay px-3 py-1 rounded-full">Klicken zum Bearbeiten</span>
        </div>
        <div className="divide-y divide-border">
          {data.transactions.length === 0 ? (
            <div className="p-8 text-center text-muted">Keine Transaktionen gefunden. Lade eine CSV hoch!</div>
          ) : (
            data.transactions.map(tx => (
              <div 
                key={tx.id} 
                onClick={() => setEditingTx(tx)}
                className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-overlay/80 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-full shrink-0", tx.type === 'income' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                    {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">{tx.description || 'Unbekannt'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-medium">
                      <span className="text-muted-foreground">{formatDate(tx.date)}</span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span className="px-2 py-0.5 rounded-full bg-overlay border border-border/50 text-muted-foreground">{tx.category}</span>
                      {tx.notes && (
                        <span className="text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3"/> Notiz</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 sm:mt-0 self-end sm:self-auto">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground p-2">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div className={cn("font-black text-lg", tx.type === 'income' ? "text-emerald-500" : "text-foreground")}>
                    {tx.type === 'income' ? '+' : '-'}{formatEuro(Math.abs(tx.amount))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl shadow-black/50 relative">
            <button onClick={() => setEditingTx(null)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-overlay rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-foreground mb-6">Transaktion bearbeiten</h2>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Beschreibung</label>
                <input 
                  type="text" 
                  value={editingTx.description || ''}
                  onChange={e => setEditingTx({...editingTx, description: e.target.value})}
                  className="w-full bg-overlay border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Betrag (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingTx.amount || 0}
                    onChange={e => setEditingTx({...editingTx, amount: parseFloat(e.target.value)})}
                    className="w-full bg-overlay border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Datum</label>
                  <input 
                    type="date" 
                    value={new Date(editingTx.date).toISOString().split('T')[0]}
                    onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                    className="w-full bg-overlay border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Kategorie</label>
                <select 
                  value={editingTx.category}
                  onChange={e => setEditingTx({...editingTx, category: e.target.value})}
                  className="w-full bg-overlay border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="Lebensmittel">Lebensmittel</option>
                  <option value="Wohnen">Wohnen (Miete, NK)</option>
                  <option value="Mobilität">Mobilität (Tank, Bahn)</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Abo/Software">Abo/Software</option>
                  <option value="Restaurant/Ausgehen">Restaurant/Ausgehen</option>
                  <option value="Gesundheit">Gesundheit</option>
                  <option value="Versicherung">Versicherung</option>
                  <option value="Steuer">Steuer</option>
                  <option value="Einkommen">Einkommen (Gehalt, Prov.)</option>
                  <option value="Sonstiges">Sonstiges</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Notizen / Rechnungs-Nr.</label>
                <input 
                  type="text" 
                  value={editingTx.notes || ''}
                  onChange={e => setEditingTx({...editingTx, notes: e.target.value})}
                  placeholder="z.B. RG-2026-08..."
                  className="w-full bg-overlay border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <div className="flex gap-3">
                <button onClick={() => setEditingTx(null)} className="flex-1 px-4 py-3 bg-overlay hover:bg-border/50 text-foreground font-semibold rounded-xl transition-colors">
                  Abbrechen
                </button>
                <button onClick={handleSaveEdit} disabled={isSaving} className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Speichern'}
                </button>
              </div>
              
              <button 
                onClick={handleDeleteTx} 
                disabled={isDeleting} 
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-colors border border-red-500/20"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Transaktion löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
