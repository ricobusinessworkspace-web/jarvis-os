'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Mail, Check, Copy, ExternalLink, Trash2, AlertTriangle, Inbox, Settings2,
} from 'lucide-react';
import type { QueueItem, DraftView, TemplateView } from '@/core/services/MailService';
import { renderTemplate, PLACEHOLDERS, type MailContext } from '@/lib/mailTemplate';
import { openDraft, saveDraft, setDraftStatus, deleteDraft } from '@/actions/mail';
import { TemplateEditor } from './TemplateEditor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  items: QueueItem[];
  loose: DraftView[];
  templates: TemplateView[];
  today: string;
}

const STATUS_LABEL: Record<DraftView['status'], string> = {
  offen: 'offen',
  entwurf: 'Entwurf',
  freigegeben: 'freigegeben',
  gesendet: 'gesendet',
};

const STATUS_STYLE: Record<DraftView['status'], string> = {
  offen: 'text-muted border-border/40',
  entwurf: 'text-foreground/70 border-border/60',
  freigegeben: 'text-foreground border-foreground/40',
  gesendet: 'text-muted border-border/30 line-through',
};

export function MailQueue({ items, loose, templates, today }: Props) {
  // Bewusst nichts vorausgewählt: ein Entwurf entsteht erst durch einen Klick.
  // Sonst legte allein das Öffnen der Seite eine Zeile in mail_drafts an.
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pending, start] = useTransition();

  const item = items.find(i => i.taskKey === selected) ?? null;

  /** Kontext für die Platzhalter: Lead aus dem CRM, Rest aus dem Entwurf. */
  const context = useMemo<MailContext>(() => ({
    ansprechpartner: item?.ansprechpartner ?? '',
    firma: item?.firma ?? '',
    ort: item?.ort ?? '',
    thema: draft?.thema ?? '',
    gesprochenMit: draft?.gesprochenMit ?? '',
    gespraechAm: draft?.gespraechAm ?? null,
  }), [item, draft]);

  /**
   * Lücken im fertigen Text.
   *
   * Bewusst am **gespeicherten Text** gemessen, nicht an der Vorlage: sobald
   * eine Vorlage angewandt ist, stehen dort keine `{{…}}` mehr, sondern die
   * sichtbaren Marker `[… fehlt]`. Gegen die Vorlage zu prüfen würde melden,
   * was Rico längst von Hand ausgefüllt hat — und schweigen, wo im Text
   * tatsächlich noch eine Lücke klafft.
   */
  const gaps = useMemo(() => {
    if (!draft) return { missing: [] as string[], unknown: [] as string[] };
    const text = `${draft.subject}\n${draft.body}`;

    const missing = [...new Set(
      [...text.matchAll(/\[([^\]\n]+) fehlt\]/g)].map(m => m[1]),
    )];

    const known = new Set(PLACEHOLDERS.map(p => p.key));
    const unknown = [...new Set(
      [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)]
        .map(m => m[1])
        .filter(k => !known.has(k)),
    )];

    return { missing, unknown };
  }, [draft]);

  function choose(next: QueueItem) {
    setError(null);
    setSelected(next.taskKey);
    setDraft(next.draft);
    if (next.draft) return;

    start(async () => {
      const res = await openDraft({
        taskKey: next.taskKey,
        leadId: next.leadId,
        toEmail: next.toEmail,
        auftrag: next.auftrag,
      });
      if (res.success) setDraft(res.data);
      else setError(res.error);
    });
  }

  /** Optimistisch anzeigen, dann speichern — wie überall im Dashboard. */
  function patch(next: Partial<DraftView>) {
    if (!draft) return;
    const merged = { ...draft, ...next };
    setDraft(merged);
    setError(null);
    start(async () => {
      const res = await saveDraft(draft.id, {
        templateId: next.templateId,
        toEmail: next.toEmail,
        subject: next.subject,
        body: next.body,
        gespraechAm: next.gespraechAm,
        gesprochenMit: next.gesprochenMit,
        thema: next.thema,
      });
      if (!res.success) setError(res.error);
    });
  }

  /** Vorlage anwenden: Platzhalter jetzt setzen, Text danach frei bearbeitbar. */
  function applyTemplate(tpl: TemplateView) {
    if (!draft) return;
    const r = renderTemplate({ subject: tpl.subject, body: tpl.body }, context, today);
    patch({ templateId: tpl.id, subject: r.subject, body: r.body });
  }

  function status(next: DraftView['status']) {
    if (!draft) return;
    setError(null);
    start(async () => {
      const res = await setDraftStatus(draft.id, next);
      if (res.success) setDraft(res.data);
      else setError(res.error);
    });
  }

  function remove() {
    if (!draft) return;
    const id = draft.id;
    setDraft(null);
    start(async () => {
      const res = await deleteDraft(id);
      if (!res.success) setError(res.error);
    });
  }

  const mailto = draft
    ? `mailto:${encodeURIComponent(draft.toEmail)}` +
      `?subject=${encodeURIComponent(draft.subject)}` +
      `&body=${encodeURIComponent(draft.body)}`
    : '#';

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-error/40 bg-error/5 p-3 text-sm text-error">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Warteschlange ─────────────────────────────────────────── */}
        <aside className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted px-1">
            Aus dem CRM · {items.length}
          </h2>

          {items.length === 0 && (
            <div className="rounded-2xl border border-border/30 bg-elevated/40 p-4 text-sm text-muted">
              <Inbox className="h-5 w-5 mb-2 opacity-60" />
              Nichts offen. Lege im CRM am Lead eine Aufgabe an, die mit
              <span className="text-foreground"> Mail:</span> beginnt.
            </div>
          )}

          {items.map(i => {
            const st = i.draft?.status ?? 'offen';
            return (
              <button
                key={i.taskKey}
                onClick={() => choose(i)}
                className={cn(
                  'w-full text-left rounded-2xl border p-3 transition-colors',
                  selected === i.taskKey
                    ? 'border-accent/60 bg-elevated/70'
                    : 'border-border/30 bg-elevated/40 hover:bg-elevated/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm leading-tight">{i.leadName}</span>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px]', STATUS_STYLE[st])}>
                    {STATUS_LABEL[st]}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 line-clamp-2">{i.auftrag || '—'}</p>
                <p className={cn('text-[11px] mt-1.5', i.toEmail ? 'text-muted' : 'text-error')}>
                  {i.toEmail || 'keine Adresse im CRM'}
                </p>
              </button>
            );
          })}

          {loose.length > 0 && (
            <p className="px-1 pt-2 text-[11px] text-muted">
              {loose.length} Entwurf/Entwürfe ohne offene CRM-Aufgabe — im CRM bereits abgehakt.
            </p>
          )}

          <button
            onClick={() => setEditorOpen(v => !v)}
            className="mt-4 flex items-center gap-2 px-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Vorlagen {editorOpen ? 'schließen' : 'bearbeiten'}
          </button>
        </aside>

        {/* ── Entwurf ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          {!item && (
            <div className="rounded-3xl border border-border/30 bg-elevated/40 p-8 text-center text-sm text-muted">
              Links einen Vorgang wählen.
            </div>
          )}

          {item && !draft && (
            <div className="rounded-3xl border border-border/30 bg-elevated/40 p-8 text-center text-sm text-muted">
              {pending ? 'Entwurf wird angelegt …' : 'Entwurf konnte nicht geöffnet werden.'}
            </div>
          )}

          {item && draft && (
            <>
              <div className="rounded-3xl border border-border/30 bg-elevated/40 p-5 space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-black tracking-tight">{item.leadName}</h2>
                  <span className="text-xs text-muted">
                    {item.firma}{item.ort && ` · ${item.ort}`}
                  </span>
                </div>

                {/* Kontext — das, was die Mail individuell macht */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Gespräch am</span>
                    <Input
                      type="date"
                      value={draft.gespraechAm ?? ''}
                      onChange={e => patch({ gespraechAm: e.target.value || null })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Gesprochen mit</span>
                    <Input
                      value={draft.gesprochenMit}
                      placeholder={item.ansprechpartner || 'Name am Telefon'}
                      onChange={e => setDraft({ ...draft, gesprochenMit: e.target.value })}
                      onBlur={e => patch({ gesprochenMit: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Empfänger</span>
                    <Input
                      type="email"
                      value={draft.toEmail}
                      placeholder="fehlt im CRM"
                      onChange={e => setDraft({ ...draft, toEmail: e.target.value })}
                      onBlur={e => patch({ toEmail: e.target.value })}
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Thema</span>
                  <Input
                    value={draft.thema}
                    placeholder="worum es ging"
                    onChange={e => setDraft({ ...draft, thema: e.target.value })}
                    onBlur={e => patch({ thema: e.target.value })}
                  />
                </label>
              </div>

              {/* Vorlagen */}
              <div className="rounded-3xl border border-border/30 bg-elevated/40 p-5 space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Vorlage anwenden
                </h3>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted">
                    Noch keine Vorlagen — unten links anlegen.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs transition-colors',
                          draft.templateId === t.id
                            ? 'border-accent/60 bg-accent/10 text-foreground'
                            : 'border-border/40 text-muted hover:text-foreground hover:border-border',
                        )}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="rounded-3xl border border-border/30 bg-elevated/40 p-5 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Betreff</span>
                  <Input
                    value={draft.subject}
                    onChange={e => setDraft({ ...draft, subject: e.target.value })}
                    onBlur={e => patch({ subject: e.target.value })}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Text</span>
                  <Textarea
                    rows={14}
                    className="font-mono text-[13px] leading-relaxed"
                    value={draft.body}
                    onChange={e => setDraft({ ...draft, body: e.target.value })}
                    onBlur={e => patch({ body: e.target.value })}
                  />
                </label>

                {(gaps.missing.length > 0 || gaps.unknown.length > 0) && (
                  <div className="space-y-1 text-xs">
                    {gaps.missing.length > 0 && (
                      <p className="text-error">
                        Fehlt noch: {gaps.missing.join(' · ')}
                        <span className="text-muted">
                          {' '}— oben ausfüllen und die Vorlage erneut anwenden.
                        </span>
                      </p>
                    )}
                    {gaps.unknown.length > 0 && (
                      <p className="text-muted">
                        Unbekannter Platzhalter: {gaps.unknown.map(u => `{{${u}}}`).join(' ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Aktionen */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`)}
                  disabled={!draft.body.trim()}
                >
                  <Copy className="h-4 w-4 mr-2" /> Kopieren
                </Button>

                <Button variant="outline" asChild disabled={!draft.toEmail.trim()}>
                  <a href={mailto}>
                    <ExternalLink className="h-4 w-4 mr-2" /> In Mail öffnen
                  </a>
                </Button>

                {draft.status !== 'freigegeben' && draft.status !== 'gesendet' && (
                  <Button onClick={() => status('freigegeben')} disabled={pending}>
                    <Check className="h-4 w-4 mr-2" /> Freigeben
                  </Button>
                )}

                {draft.status === 'freigegeben' && (
                  <Button onClick={() => status('gesendet')} disabled={pending}>
                    <Mail className="h-4 w-4 mr-2" /> Als gesendet markieren
                  </Button>
                )}

                <span className="text-xs text-muted ml-auto">
                  {pending ? 'speichert …' : `Status: ${STATUS_LABEL[draft.status]}`}
                </span>

                <button
                  onClick={remove}
                  className="text-muted hover:text-error transition-colors p-2"
                  title="Entwurf verwerfen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {editorOpen && <TemplateEditor templates={templates} />}
    </div>
  );
}
