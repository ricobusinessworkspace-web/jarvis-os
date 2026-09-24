import { MailService } from '@/core/services/MailService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { MailQueue } from '@/components/mail/MailQueue';

export const dynamic = 'force-dynamic';

/**
 * Anschreiben.
 *
 * Was ansteht, kommt aus dem CRM — eine Aufgabe am Lead, deren Text mit „Mail"
 * beginnt. Jarvis führt dazu keine eigene Liste; es hält nur den Entwurf.
 */
export default async function MailPage() {
  const today = getBerlinDateStr();

  // Nacheinander: eine Pooler-Verbindung pro Instanz.
  const queue = await MailService.getQueue();
  const loose = await MailService.getLooseDrafts(queue.map(q => q.taskKey));
  const templates = await MailService.listTemplates();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Anschreiben</h1>
        <p className="text-sm text-muted mt-1">
          Im CRM eine Aufgabe <span className="text-foreground">„Mail: …"</span> am Lead
          anlegen — sie erscheint hier. Abends schreiben, freigeben, abhaken.
        </p>
      </header>

      <MailQueue
        items={queue}
        loose={loose}
        templates={templates}
        today={today}
      />
    </div>
  );
}
