import { Square, Circle } from 'lucide-react';
import type { CrmTaskItem } from '@/core/services/TaskInboxService';

/**
 * Zwei Quellen, klar getrennt: Apple Notes links, die eigenen CRM-Leads
 * rechts. Sie werden bewusst nicht in eine Liste gemischt — die eine
 * bearbeitest du in Notizen, die andere im CRM.
 */

function Column({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
        {title}
        <span className="font-mono normal-case tracking-normal opacity-70">{count}</span>
      </div>
      {children}
    </div>
  );
}

export function TaskInbox({ crmTasks, notesConnected }: { crmTasks: CrmTaskItem[]; notesConnected: boolean }) {
  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Aufgaben</h3>
      </div>

      <div className="grid gap-5 md:grid-cols-2 md:gap-0">
        <div className="md:pr-6">
          <Column title="Notizen" count={notesConnected ? '' : 'nicht verbunden'}>
            {notesConnected ? null : (
              <p className="border-t border-border/40 py-3 text-[12.5px] leading-relaxed text-muted">
                Apple Notes ist noch nicht angebunden. Die Aufgaben kommen über einen
                iOS-Kurzbefehl herein — bis dahin bleibt die Liste leer statt geraten.
              </p>
            )}
          </Column>
        </div>

        <div className="border-t border-border/40 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <Column title="CRM · deine Leads" count={`${crmTasks.length} offen`}>
            {crmTasks.length === 0 ? (
              <p className="border-t border-border/40 py-3 text-[12.5px] text-muted">
                Keine offenen Aufgaben an deinen Leads.
              </p>
            ) : (
              <div className="flex flex-col">
                {crmTasks.slice(0, 5).map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2.5 border-t border-border/40 py-2 text-[12.5px]"
                  >
                    <Square className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{task.text}</div>
                      <div className="mt-0.5 truncate text-[10.5px] text-muted">
                        {task.leadName}
                        {task.openSubtasks > 0 &&
                          ` · ${task.openSubtasks} Unteraufgabe${task.openSubtasks > 1 ? 'n' : ''}`}
                      </div>
                    </div>
                    {task.deadline && (
                      <span className="shrink-0 font-mono text-[10.5px] text-amber-500">
                        {task.deadline.slice(8)}.{task.deadline.slice(5, 7)}.
                      </span>
                    )}
                    <span className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[9.5px] text-muted">
                      {task.stage}
                    </span>
                  </div>
                ))}
                {crmTasks.length > 5 && (
                  <div className="flex items-center gap-2 border-t border-border/40 pt-2.5 text-[11.5px] text-muted">
                    <Circle className="h-2 w-2 fill-current" />
                    {crmTasks.length - 5} weitere im CRM
                  </div>
                )}
              </div>
            )}
          </Column>
        </div>
      </div>
    </div>
  );
}
