'use client';

import { useState, useTransition } from 'react';
import { ChevronUp, ChevronDown, Plus, Archive, AlertTriangle } from 'lucide-react';
import type { TemplateView } from '@/core/services/MailService';
import { PLACEHOLDERS } from '@/lib/mailTemplate';
import {
  createTemplate, updateTemplate, archiveTemplate, moveTemplate, seedStarterTemplates,
} from '@/actions/mail';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/**
 * Vorlagen bearbeiten.
 *
 * Eine Vorlage hat zwei Hälften, und die Trennung ist Absicht:
 * **Text** ist das Gerüst mit Platzhaltern — der Weg ohne Modell.
 * **Anweisung** ist das, was Claude beachten soll, wenn es die Mail individuell
 * schreibt. Dort steht vor allem, was *nicht* erfunden werden darf.
 */
export function TemplateEditor({ templates }: { templates: TemplateView[] }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) setError(res.error ?? 'Unbekannter Fehler');
    });
  }

  return (
    <section className="rounded-3xl border border-border/30 bg-elevated/40 p-5 space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-black tracking-tight">Vorlagen</h2>
        <span className="text-xs text-muted">{pending ? 'speichert …' : `${templates.length} aktiv`}</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-error/40 bg-error/5 p-3 text-sm text-error">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Platzhalter-Legende */}
      <div className="rounded-2xl border border-border/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
          Verfügbare Platzhalter
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {PLACEHOLDERS.map(p => (
            <span key={p.key} className="text-xs">
              <code className="text-foreground">{`{{${p.key}}}`}</code>
              <span className="text-muted"> — {p.hint}</span>
            </span>
          ))}
        </div>
      </div>

      {templates.length === 0 && (
        <div className="rounded-2xl border border-border/30 p-4 space-y-3">
          <p className="text-sm text-muted">
            Noch keine Vorlagen. Drei Startvorlagen anlegen, die du danach frei änderst?
          </p>
          <Button variant="outline" onClick={() => run(seedStarterTemplates)} disabled={pending}>
            Startvorlagen anlegen
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {templates.map((t, i) => (
          <div key={t.id} className="rounded-2xl border border-border/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                defaultValue={t.name}
                onBlur={e => {
                  if (e.target.value !== t.name) run(() => updateTemplate(t.id, { name: e.target.value }));
                }}
                className="font-semibold"
              />
              <button
                onClick={() => run(() => moveTemplate(t.id, 'up'))}
                disabled={i === 0 || pending}
                className="p-1.5 text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                title="nach oben"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => run(() => moveTemplate(t.id, 'down'))}
                disabled={i === templates.length - 1 || pending}
                className="p-1.5 text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                title="nach unten"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => run(() => archiveTemplate(t.id))}
                disabled={pending}
                className="p-1.5 text-muted hover:text-error transition-colors"
                title="stilllegen"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Betreff</span>
              <Input
                defaultValue={t.subject}
                onBlur={e => {
                  if (e.target.value !== t.subject) run(() => updateTemplate(t.id, { subject: e.target.value }));
                }}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Text · Gerüst mit Platzhaltern
                </span>
                <Textarea
                  rows={10}
                  className="font-mono text-[13px] leading-relaxed"
                  defaultValue={t.body}
                  onBlur={e => {
                    if (e.target.value !== t.body) run(() => updateTemplate(t.id, { body: e.target.value }));
                  }}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Anweisung · für Claude
                </span>
                <Textarea
                  rows={10}
                  className="text-[13px] leading-relaxed"
                  placeholder="Ton, Länge — und vor allem, was nicht erfunden werden darf."
                  defaultValue={t.guidance}
                  onBlur={e => {
                    if (e.target.value !== t.guidance) run(() => updateTemplate(t.id, { guidance: e.target.value }));
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name der neuen Vorlage"
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) {
              run(() => createTemplate(name));
              setName('');
            }
          }}
        />
        <Button
          variant="outline"
          disabled={!name.trim() || pending}
          onClick={() => { run(() => createTemplate(name)); setName(''); }}
        >
          <Plus className="h-4 w-4 mr-2" /> Anlegen
        </Button>
      </div>
    </section>
  );
}
