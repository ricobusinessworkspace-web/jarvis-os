import { CrmService } from '@/core/services/CrmService';
import { TrendingUp, Phone, PhoneCall, Star } from 'lucide-react';

export default async function CrmWidget() {
  const crmMetrics: any = await CrmService.getOverview();

  if (crmMetrics.error) {
    return (
      <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 flex-1">
        <div className="flex items-center justify-between border-b border-border/20 pb-3">
          <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-green-400" /> Sales Engine
          </h3>
        </div>
        <p className="text-xs text-red-400">Error loading CRM Data</p>
      </div>
    );
  }

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 flex-1">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <TrendingUp className="h-4 w-4 text-green-400" /> Sales Engine
        </h3>
        <span className="text-[10px] font-black bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full tracking-wider uppercase">Online</span>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col p-3 rounded-xl bg-background/60 border border-border/40">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1.5"><Phone className="h-3 w-3" /> Heute</span>
            <span className="text-xl font-black text-foreground mt-0.5">{crmMetrics.todayCalls}</span>
          </div>
          <div className="flex flex-col p-3 rounded-xl bg-background/60 border border-border/40">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1.5"><PhoneCall className="h-3 w-3" /> Woche</span>
            <span className="text-xl font-black text-foreground mt-0.5">{crmMetrics.weeklyCalls}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col p-2 rounded-xl bg-accent/10 border border-accent/20 text-center">
            <span className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Entscheider</span>
            <span className="text-lg font-black text-accent">{crmMetrics.pipeline?.entscheider || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-xl bg-accent/10 border border-accent/20 text-center">
            <span className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Kontakt</span>
            <span className="text-lg font-black text-accent">{crmMetrics.pipeline?.kontakt || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-xl bg-accent/10 border border-accent/20 text-center">
            <span className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Rechnung</span>
            <span className="text-lg font-black text-accent">{crmMetrics.pipeline?.rechnung || 0}</span>
          </div>
          <div className="flex flex-col p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
            <span className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-0.5"><Star className="h-2.5 w-2.5" /> Prio</span>
            <span className="text-lg font-black text-yellow-500">{crmMetrics.prioLeads || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
