import type { CrmTaskItem, ReminderItem } from '@/core/services/TaskInboxService';
import { cn } from '@/lib/utils';

/**
 * Zwei Quellen, klar getrennt: Apple Erinnerungen links, die eigenen
 * CRM-Leads rechts. Sie werden bewusst nicht in eine Liste gemischt —
 * die eine bearbeitest du in Erinnerungen, die andere im CRM.
 *
 * Beide Spalten sind reine Anzeige. Deshalb sitzt links ein offener Kreis wie
 * in Erinnerungen und kein Kästchen: ein Kästchen sieht nach „hier abhaken"
 * aus, und das geht hier nicht.
 */

const MAX_ROWS = 5;

function Column({
  title, count, children,
}: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
          {title}
        </span>
        <span className="font-mono text-[10.5px] text-muted/70">{count}</span>
      </div>
      {children}
    </div>
  );
}

/** Offener Kreis wie in Apple Erinnerungen — Anzeige, kein Bedienelement. */
function Bullet() {
  return <span className="mt-[5px] h-[13px] w-[13px] shrink-0 rounded-full border border-white/25" />;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-border/25 py-2.5 first:border-t-0 first:pt-0">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[12.5px] leading-relaxed text-muted">{children}</p>;
}

function More({ n, where }: { n: number; where: string }) {
  return (
    <div className="border-t border-border/25 pt-2.5 text-[11px] text-muted">
      {n} weitere in {where}
    </div>
  );
}

export function TaskInbox({
  crmTasks, reminders, remindersConnected,
}: {
  crmTasks: CrmTaskItem[];
  reminders: ReminderItem[];
  remindersConnected: boolean;
}) {
  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Aufgaben</h3>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-0">
        <div className="md:pr-7">
          <Column
            title="Erinnerungen"
            count={!remindersConnected ? 'nicht verbunden' : `${reminders.length} offen`}
          >
            {!remindersConnected ? (
              <Empty>
                Apple Erinnerungen sind noch nicht angebunden. Sie kommen über einen
                iOS-Kurzbefehl herein — bis dahin bleibt die Liste leer statt geraten.
              </Empty>
            ) : reminders.length === 0 ? (
              <Empty>Nichts offen für heute.</Empty>
            ) : (
              <div className="flex flex-col">
                {reminders.slice(0, MAX_ROWS).map(r => (
                  <Row key={r.id}>
                    <Bullet />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] leading-snug">{r.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                        {r.listName && <span className="truncate">{r.listName}</span>}
                        {r.listName && (r.overdue || r.dueTime) && (
                          <span className="opacity-40">·</span>
                        )}
                        <span className={cn('shrink-0', r.overdue && 'text-error')}>
                          {r.overdue ? 'überfällig' : (r.dueTime ?? '')}
                        </span>
                      </div>
                    </div>
                  </Row>
                ))}
                {reminders.length > MAX_ROWS && (
                  <More n={reminders.length - MAX_ROWS} where="Erinnerungen" />
                )}
              </div>
            )}
          </Column>
        </div>

        <div className="border-t border-border/25 pt-6 md:border-l md:border-t-0 md:pl-7 md:pt-0">
          <Column title="CRM · deine Leads" count={`${crmTasks.length} offen`}>
            {crmTasks.length === 0 ? (
              <Empty>Keine offenen Aufgaben an deinen Leads.</Empty>
            ) : (
              <div className="flex flex-col">
                {crmTasks.slice(0, MAX_ROWS).map(task => (
                  <Row key={task.id}>
                    <Bullet />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] leading-snug">{task.text}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="truncate">{task.leadName}</span>
                        <span className="opacity-40">·</span>
                        <span className="shrink-0">{task.stage}</span>
                        {task.openSubtasks > 0 && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="shrink-0">
                              {task.openSubtasks} Unteraufgabe{task.openSubtasks > 1 ? 'n' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {task.deadline && (
                      <span className="mt-[1px] shrink-0 font-mono text-[11px] tabular-nums text-muted">
                        {task.deadline.slice(8)}.{task.deadline.slice(5, 7)}.
                      </span>
                    )}
                  </Row>
                ))}
                {crmTasks.length > MAX_ROWS && (
                  <More n={crmTasks.length - MAX_ROWS} where="CRM" />
                )}
              </div>
            )}
          </Column>
        </div>
      </div>
    </div>
  );
}
