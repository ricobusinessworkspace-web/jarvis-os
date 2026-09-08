import { CrmService } from './CrmService';
import { RoutineService } from './RoutineService';
import { TaskInboxService } from './TaskInboxService';
import { AnalyticsService } from './AnalyticsService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo } from '@/lib/blocks';

/**
 * Kontext-Export für Claude — läuft nur auf Knopfdruck und holt sich deshalb
 * seine Daten selbst, statt am schlanken Layout-Fetch zu hängen.
 */
export class ExportService {
  static async generateClaudeContextMarkdown(): Promise<string> {
    try {
      const today = getBerlinDateStr();
      const block = blockInfo(today);

      // Nacheinander: eine Pooler-Verbindung pro Instanz.
      const crm = await CrmService.getOverview();
      const pipeline = await CrmService.getPipeline();
      const routines = await RoutineService.getRoutineBlocks(today);
      const crmTasks = await TaskInboxService.getCrmTasks();
      const reminders = await TaskInboxService.getReminders(today);
      const analytics = await AnalyticsService.getToday(today);

      const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString('de-DE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      });

      const lines: string[] = [
        '# Jarvis OS — Kontext-Export',
        `**Datum:** ${dateLabel}`,
        block.beforeStart
          ? ''
          : `**Position:** Block ${block.blockNumber}, Woche ${block.weekOfBlock} von 12, noch ${block.daysRemaining} Tage`,
        '',
        'Du bist mein Coach. Unten steht der aktuelle Stand meines Systems.',
        'Wichtig: „nicht gemessen" heißt fehlender Eintrag, nicht der Wert null.',
        '',
        '## 1. Ursachen heute',
      ];

      for (const [key, cell] of Object.entries(analytics.today)) {
        const s = analytics.summaries[key];
        const value = cell.value === null ? 'nicht gemessen' : String(cell.value);
        const target = cell.base === null ? 'ohne Ziel' : `Ziel ${cell.base}${cell.stretch ? `/${cell.stretch}` : ''}`;
        const rate = s ? ` · Adherence ${Math.round((s.adherence ?? 0) * 100)} %, Coverage ${Math.round((s.coverage ?? 0) * 100)} %, Streak ${s.streak}` : '';
        lines.push(`- **${key}**: ${value} (${target})${rate}`);
      }

      lines.push('', '## 2. Vertrieb (aus dem CRM)');
      if ('error' in crm) {
        lines.push('- CRM gerade nicht erreichbar');
      } else {
        lines.push(`- Leads gesamt: ${crm.totalLeads}`);
        lines.push(`- Calls heute / Woche: ${crm.todayCalls} / ${crm.weeklyCalls}`);
      }
      lines.push(`- Pipeline: ${pipeline.stages.map(s => `${s.label} ${s.count}`).join(' · ')}`);
      lines.push(`- Mir zugewiesen: ${pipeline.mine} Leads`);
      lines.push('- Umsatzziel: bewusst nicht gesetzt, Messphase läuft');

      lines.push('', '## 3. Offene Aufgaben');
      if (crmTasks.length) {
        lines.push('**CRM-Leads:**');
        crmTasks.forEach(t => lines.push(`- [ ] ${t.text} — ${t.leadName} (${t.stage})`));
      }
      if (reminders.connected && reminders.items.length) {
        lines.push('**Erinnerungen:**');
        reminders.items.forEach(r => lines.push(`- [ ] ${r.title}${r.listName ? ` (${r.listName})` : ''}`));
      } else if (!reminders.connected) {
        lines.push('- Apple Erinnerungen noch nicht angebunden');
      }

      lines.push('', '## 4. Routine heute');
      for (const block of routines) {
        const done = block.items.filter(i => i.done).length;
        lines.push(`### ${block.name} (${done}/${block.items.length})`);
        block.items.forEach(i => lines.push(`- [${i.done ? 'x' : ' '}] ${i.title}`));
      }

      lines.push('', '## Ende des Kontexts');
      return lines.filter(l => l !== undefined).join('\n');
    } catch (error) {
      console.error('generateClaudeContextMarkdown error:', error);
      return `Fehler beim Erzeugen des Kontexts: ${error instanceof Error ? error.message : 'unbekannt'}`;
    }
  }
}
