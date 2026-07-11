'use client';

import { useState, useEffect } from 'react';
import { getCrmMetrics } from '@/actions/dashboard';
import { motion } from 'framer-motion';
import { Phone, TrendingUp, Star, PhoneCall } from 'lucide-react';
import { type CrmMetrics } from '@/types';
import { cn } from '@/lib/utils';

export default function SalesEngineWidget() {
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const result = await getCrmMetrics();
        if (result.success) {
          setMetrics(result.data as any);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 300000); // refresh every 5m
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-8 h-[240px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center h-[240px]">
        <p className="text-sm text-destructive font-medium mb-2">CRM Offline</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" /> Sales Engine
        </h3>
        <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-full">Calling Station</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col p-3 rounded-lg bg-secondary/40 border border-border/50">
          <span className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" /> Calls Today
          </span>
          <span className="text-2xl font-bold">{metrics.todayCalls}</span>
        </div>
        
        <div className="flex flex-col p-3 rounded-lg bg-secondary/40 border border-border/50">
          <span className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <PhoneCall className="h-3.5 w-3.5" /> Calls (7d)
          </span>
          <span className="text-2xl font-bold">{metrics.weeklyCalls}</span>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sales Pipeline</h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col p-2 rounded-lg bg-accent/10 border border-accent/20 text-center">
            <span className="text-[10px] text-muted-foreground uppercase mb-1">Entscheider</span>
            <span className="text-lg font-bold text-accent">{metrics.pipeline?.entscheider || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-accent/10 border border-accent/20 text-center">
            <span className="text-[10px] text-muted-foreground uppercase mb-1">Kontakt</span>
            <span className="text-lg font-bold text-accent">{metrics.pipeline?.kontakt || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-accent/10 border border-accent/20 text-center">
            <span className="text-[10px] text-muted-foreground uppercase mb-1">Rechnung</span>
            <span className="text-lg font-bold text-accent">{metrics.pipeline?.rechnung || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
            <span className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center justify-center gap-1"><Star className="h-3 w-3" /> Prio</span>
            <span className="text-lg font-bold text-yellow-600 dark:text-yellow-500">{metrics.prioLeads || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
