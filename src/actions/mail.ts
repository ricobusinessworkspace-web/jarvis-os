'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { MailService, type DraftView } from '@/core/services/MailService';

/**
 * Anschreiben — Entwürfe und Vorlagen.
 *
 * Das Setzen der Platzhalter passiert in der Oberfläche (`lib/mailTemplate.ts`),
 * damit der Text beim Tippen mitläuft. Hier kommt nur an, was gespeichert
 * werden soll. Ein Entwurf wird deshalb nie serverseitig „neu gerendert" —
 * sonst überschriebe ein Klick Ricos Änderungen von Hand.
 */

type Result<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const fail = (error: unknown): Result<never> => ({
  success: false,
  error: error instanceof Error ? error.message : 'Unbekannter Fehler',
});

const ok = <T,>(data: T): Result<T> => ({ success: true, data });

function touch() {
  revalidatePath('/mail');
}

// ── Entwürfe ──────────────────────────────────────────────────────────────

export async function openDraft(item: {
  taskKey: string; leadId: string; toEmail: string; auftrag: string;
}): Promise<Result<DraftView>> {
  try {
    const draft = await MailService.openDraft(item);
    touch();
    return ok(draft);
  } catch (e) { return fail(e); }
}

export async function saveDraft(id: string, patch: {
  templateId?: string | null;
  toEmail?: string;
  subject?: string;
  body?: string;
  gespraechAm?: string | null;
  gesprochenMit?: string;
  thema?: string;
}): Promise<Result<DraftView>> {
  try {
    const draft = await MailService.updateDraft(id, patch);
    touch();
    return ok(draft);
  } catch (e) { return fail(e); }
}

export async function setDraftStatus(
  id: string,
  status: DraftView['status'],
): Promise<Result<DraftView>> {
  try {
    const draft = await MailService.setStatus(id, status);
    touch();
    return ok(draft);
  } catch (e) { return fail(e); }
}

export async function deleteDraft(id: string): Promise<Result> {
  try {
    await MailService.deleteDraft(id);
    touch();
    return ok(undefined);
  } catch (e) { return fail(e); }
}

// ── Vorlagen ──────────────────────────────────────────────────────────────

export async function createTemplate(name: string): Promise<Result> {
  try {
    const clean = name.trim();
    if (!clean) return { success: false, error: 'Die Vorlage braucht einen Namen.' };

    const last = await prisma.mailTemplate.findFirst({
      orderBy: { sortOrder: 'desc' }, select: { sortOrder: true },
    });
    await prisma.mailTemplate.create({
      data: { name: clean, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    touch();
    return ok(undefined);
  } catch (e) { return fail(e); }
}

export async function updateTemplate(id: string, patch: {
  name?: string; subject?: string; body?: string; guidance?: string;
}): Promise<Result> {
  try {
    if (patch.name !== undefined && !patch.name.trim()) {
      return { success: false, error: 'Die Vorlage braucht einen Namen.' };
    }
    await prisma.mailTemplate.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.subject !== undefined && { subject: patch.subject }),
        ...(patch.body !== undefined && { body: patch.body }),
        ...(patch.guidance !== undefined && { guidance: patch.guidance }),
      },
    });
    touch();
    return ok(undefined);
  } catch (e) { return fail(e); }
}

/**
 * Vorlage stilllegen statt löschen: an ihr hängen Entwürfe, die sonst nicht
 * mehr sagen könnten, woraus sie entstanden sind.
 */
export async function archiveTemplate(id: string): Promise<Result> {
  try {
    await prisma.mailTemplate.update({ where: { id }, data: { isActive: false } });
    touch();
    return ok(undefined);
  } catch (e) { return fail(e); }
}

export async function moveTemplate(id: string, direction: 'up' | 'down'): Promise<Result> {
  try {
    const all = await prisma.mailTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, sortOrder: true },
    });
    const i = all.findIndex(t => t.id === id);
    if (i < 0) return { success: false, error: 'Vorlage nicht gefunden.' };

    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return ok(undefined); // schon ganz oben/unten

    await prisma.$transaction([
      prisma.mailTemplate.update({ where: { id: all[i].id }, data: { sortOrder: all[j].sortOrder } }),
      prisma.mailTemplate.update({ where: { id: all[j].id }, data: { sortOrder: all[i].sortOrder } }),
    ]);
    touch();
    return ok(undefined);
  } catch (e) { return fail(e); }
}

/**
 * Drei Startvorlagen — nur auf Knopfdruck und nur, wenn noch keine da sind.
 * Bewusst nicht im Seed: in Ricos Datenbank soll nichts stehen, das er nicht
 * angefordert hat.
 */
export async function seedStarterTemplates(): Promise<Result> {
  try {
    const count = await prisma.mailTemplate.count({ where: { isActive: true } });
    if (count > 0) return { success: false, error: 'Es gibt bereits Vorlagen.' };

    await prisma.mailTemplate.createMany({
      data: [
        {
          name: 'Nach dem Gespräch',
          sortOrder: 1,
          subject: 'Unsere Unterlagen für {{firma}}',
          body: [
            '{{anrede}},',
            '',
            'vielen Dank für das Gespräch am {{gespraech_am}} mit {{gesprochen_mit}}.',
            'Wie besprochen schicke ich Ihnen die Unterlagen zu {{thema}}.',
            '',
            'Für Rückfragen bin ich jederzeit erreichbar.',
            '',
            'Viele Grüße',
          ].join('\n'),
          guidance: [
            'Kurz und sachlich, höchstens 120 Wörter. Kein Verkaufsjargon.',
            'Beziehe dich konkret auf {{thema}} aus dem Gespräch.',
            'Nenne keine Preise, Tarife oder Konditionen — die stehen im Angebot.',
          ].join('\n'),
        },
        {
          name: 'Angebot nachreichen',
          sortOrder: 2,
          subject: 'Ihr Angebot — {{firma}}',
          body: [
            '{{anrede}},',
            '',
            'anbei wie am {{gespraech_am}} besprochen das Angebot zu {{thema}}.',
            '',
            'Melden Sie sich gern, wenn etwas offen ist.',
            '',
            'Viele Grüße',
          ].join('\n'),
          guidance: [
            'Sehr kurz, das Angebot spricht für sich. Höchstens 80 Wörter.',
            'Keine Zahlen aus dem Angebot wiederholen — nichts, was im Anhang steht.',
            'Ein klarer nächster Schritt am Schluss.',
          ].join('\n'),
        },
        {
          name: 'Nachfassen',
          sortOrder: 3,
          subject: 'Kurz nachgefragt — {{firma}}',
          body: [
            '{{anrede}},',
            '',
            'ich melde mich noch einmal zu {{thema}}.',
            'Konnten Sie sich das ansehen?',
            '',
            'Viele Grüße',
          ].join('\n'),
          guidance: [
            'Freundlich, ohne Druck, höchstens 60 Wörter.',
            'Kein Vorwurf und keine Dringlichkeit erfinden.',
            'Eine einzige, leicht zu beantwortende Frage.',
          ].join('\n'),
        },
      ],
    });
    touch();
    return ok(undefined);
  } catch (e) { return fail(e); }
}
