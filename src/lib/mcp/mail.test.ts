// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * `mail_entwurf_speichern` gegen eine Datenbank im Speicher — nie gegen die
 * geteilte Supabase-Instanz. Geprüft wird, was das Übergabedokument verlangt:
 * genau ein Schreibvorgang bei gültigem Aufruf, keiner bei ungültiger
 * Aufgabe, veraltetem Stand, Wiederholung oder CRM-Ausfall.
 */

type Zeile = {
  id: string; leadId: bigint; taskKey: string | null; templateId: string | null;
  toEmail: string; subject: string; body: string; gespraechAm: Date | null;
  gesprochenMit: string; thema: string; status: string; createdAt: Date; updatedAt: Date; sentAt: Date | null;
};

type Wo = { id?: string; taskKey?: { in: Array<string | null> }; status?: { in: string[] }; updatedAt?: { gte: Date; lt: Date } };
type Arg = { where?: Wo; data?: Partial<Zeile> };

const db = vi.hoisted(() => ({ zeilen: [] as Zeile[], schreibvorgaenge: 0, uhr: 1_760_000_000_000 }));

vi.mock('@/lib/prisma', () => {
  const tick = () => new Date((db.uhr += 1000));
  const passt = (z: Zeile, where: Wo) => {
    if (where.id && z.id !== where.id) return false;
    if (where.taskKey?.in && !where.taskKey.in.includes(z.taskKey)) return false;
    if (where.status?.in && !where.status.in.includes(z.status)) return false;
    if (where.updatedAt) {
      const t = z.updatedAt.getTime();
      if (t < where.updatedAt.gte.getTime() || t >= where.updatedAt.lt.getTime()) return false;
    }
    return true;
  };
  return {
    prisma: {
      mailDraft: {
        findMany: async ({ where }: Arg) => db.zeilen.filter(z => passt(z, where ?? {})).map(z => ({ ...z })),
        findUniqueOrThrow: async ({ where }: Arg) => {
          const z = db.zeilen.find(r => r.id === where?.id);
          if (!z) throw new Error('nicht gefunden');
          return { ...z };
        },
        create: async ({ data = {} }: Arg) => {
          if (data.taskKey && db.zeilen.some(z => z.taskKey === data.taskKey)) {
            throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
          }
          db.schreibvorgaenge++;
          const jetzt = tick();
          const z: Zeile = {
            id: `d${db.zeilen.length + 1}`, templateId: null, gespraechAm: null, gesprochenMit: '',
            subject: '', body: '', toEmail: '', thema: '', status: 'offen', sentAt: null,
            createdAt: jetzt, updatedAt: jetzt, taskKey: null, leadId: BigInt(0), ...data,
          };
          db.zeilen.push(z);
          return { ...z };
        },
        updateMany: async ({ where = {}, data }: Arg) => {
          const treffer = db.zeilen.filter(z => passt(z, where));
          for (const z of treffer) Object.assign(z, data, { updatedAt: tick() });
          if (treffer.length) db.schreibvorgaenge++;
          return { count: treffer.length };
        },
      },
    },
  };
});

const crm = vi.hoisted(() => ({
  status: 'ok' as 'ok' | 'kein_profil' | 'nicht_erreichbar',
  aufgaben: [] as Array<{ id: string; text: string; leadId: string; leadName: string; stage: string; deadline: string | null; openSubtasks: number }>,
  adressen: true,
}));

vi.mock('@/core/services/TaskInboxService', () => ({
  TaskInboxService: {
    getCrmTasksMitStatus: async () => ({ status: crm.status, items: crm.status === 'ok' ? crm.aufgaben : [] }),
  },
}));

vi.mock('@/core/services/CrmService', () => ({
  CrmService: {
    loadLeadsForMail: async (ids: string[]) => {
      if (!crm.adressen) throw new Error('CRM weg');
      return new Map(ids.map(id => [id, { email: `kontakt-${id}@firma.example`, ansprechpartner: 'Frau Beispiel', firma: `Firma ${id}`, ort: 'Dresden' }]));
    },
  },
}));

import { MailService } from '@/core/services/MailService';
import { WERKZEUGE } from './tools';

const speichern = WERKZEUGE.find(w => w.name === 'mail_entwurf_speichern')!;
const anzeigen = WERKZEUGE.find(w => w.name === 'mail_warteschlange_anzeigen')!;

const AUFGABE = '592:1700000000000';

beforeEach(() => {
  db.zeilen.length = 0;
  db.schreibvorgaenge = 0;
  crm.status = 'ok';
  crm.adressen = true;
  crm.aufgaben = [
    { id: AUFGABE, text: 'Mail: Angebot nachreichen', leadId: '592', leadName: 'Bäckerei Klein', stage: 'offer', deadline: null, openSubtasks: 0 },
    { id: '600:1', text: 'Rückruf Montag', leadId: '600', leadName: 'Keine Mail', stage: 'pitch', deadline: null, openSubtasks: 0 },
  ];
});

async function standAusWarteschlange(taskKey = AUFGABE) {
  const w = await anzeigen.run({});
  const v = (w.vorgaenge as Array<{ taskKey: string; entwurf: { stand: string } | null }>).find(x => x.taskKey === taskKey);
  return v?.entwurf?.stand ?? null;
}

describe('mail_entwurf_speichern', () => {
  it('legt einen Entwurf an — Empfänger und Thema aus dem CRM, Status „entwurf"', async () => {
    const r = await speichern.run({ taskKey: AUFGABE, betreff: 'Ihr Angebot', text: 'Guten Tag,\nanbei.' });
    expect(r.ergebnis).toBe('angelegt');
    expect(db.schreibvorgaenge).toBe(1);
    expect(db.zeilen[0]).toMatchObject({
      leadId: BigInt(592), taskKey: AUFGABE, toEmail: 'kontakt-592@firma.example',
      thema: 'Angebot nachreichen', subject: 'Ihr Angebot', status: 'entwurf',
    });
  });

  it('derselbe Aufruf zweimal: ein Entwurf, ein Schreibvorgang', async () => {
    await speichern.run({ taskKey: AUFGABE, betreff: 'Ihr Angebot', text: 'Text' });
    const stand = await standAusWarteschlange();
    const r = await speichern.run({ taskKey: AUFGABE, betreff: 'Ihr Angebot', text: 'Text', stand });
    expect(r.ergebnis).toBe('unveraendert');
    // Auch ohne Stand ändert eine reine Wiederholung nichts.
    const r2 = await speichern.run({ taskKey: AUFGABE, betreff: 'Ihr Angebot', text: 'Text' });
    expect(r2.ergebnis).toBe('unveraendert');
    expect(db.zeilen).toHaveLength(1);
    expect(db.schreibvorgaenge).toBe(1);
  });

  it('ändert mit aktuellem Stand genau einmal', async () => {
    await speichern.run({ taskKey: AUFGABE, betreff: 'A', text: 'eins' });
    const stand = await standAusWarteschlange();
    const r = await speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'zwei', stand });
    expect(r.ergebnis).toBe('aktualisiert');
    expect(db.zeilen[0]).toMatchObject({ subject: 'B', body: 'zwei' });
    expect(db.schreibvorgaenge).toBe(2);
  });

  it('veralteter Stand: Ricos Änderung bleibt stehen', async () => {
    await speichern.run({ taskKey: AUFGABE, betreff: 'A', text: 'eins' });
    const alterStand = await standAusWarteschlange();
    // Rico ändert in Jarvis.
    await MailService.entwurfSpeichern({ taskKey: AUFGABE, betreff: 'Rico', text: 'von Hand', stand: alterStand });
    const vorher = db.schreibvorgaenge;

    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'Modell', text: 'überschreibt', stand: alterStand }))
      .rejects.toThrow(/geändert/);
    expect(db.zeilen[0]).toMatchObject({ subject: 'Rico', body: 'von Hand' });
    expect(db.schreibvorgaenge).toBe(vorher);
  });

  it('bestehender Entwurf ohne Stand wird nicht überschrieben', async () => {
    await speichern.run({ taskKey: AUFGABE, betreff: 'A', text: 'eins' });
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'zwei' })).rejects.toThrow(/Stand/);
    expect(db.zeilen[0].subject).toBe('A');
  });

  it('Stand genannt, aber kein Entwurf da → nichts angelegt', async () => {
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'zwei', stand: new Date().toISOString() }))
      .rejects.toThrow(/nicht mehr/);
    expect(db.zeilen).toHaveLength(0);
  });

  it('Aufgabe, die keine Mail-Aufgabe ist oder nicht existiert → kein Entwurf', async () => {
    await expect(speichern.run({ taskKey: '600:1', betreff: 'B', text: 'x' })).rejects.toThrow(/keine offene Mail-Aufgabe/);
    await expect(speichern.run({ taskKey: '999:1', betreff: 'B', text: 'x' })).rejects.toThrow(/keine offene Mail-Aufgabe/);
    expect(db.schreibvorgaenge).toBe(0);
  });

  it('CRM nicht erreichbar → nichts gespeichert', async () => {
    crm.status = 'nicht_erreichbar';
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'x' })).rejects.toThrow(/nicht lesbar/);
    expect(db.schreibvorgaenge).toBe(0);
  });

  it('freigegebener Entwurf wird nicht mehr angefasst', async () => {
    await speichern.run({ taskKey: AUFGABE, betreff: 'A', text: 'eins' });
    db.zeilen[0].status = 'freigegeben';
    const stand = await standAusWarteschlange();
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'zwei', stand })).rejects.toThrow(/freigegeben/);
    expect(db.zeilen[0]).toMatchObject({ subject: 'A', status: 'freigegeben' });
  });

  it('Rico hat die Aufgabe nur geöffnet (leerer Entwurf „offen") → mit Stand wird daraus „entwurf"', async () => {
    db.zeilen.push({
      id: 'd1', leadId: BigInt(592), taskKey: AUFGABE, templateId: null, toEmail: 'von-rico@korrigiert.example',
      subject: '', body: '', gespraechAm: null, gesprochenMit: 'Herr Klein', thema: 'Angebot',
      status: 'offen', createdAt: new Date(db.uhr), updatedAt: new Date(db.uhr), sentAt: null,
    });
    const stand = await standAusWarteschlange();
    const r = await speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'zwei', stand });
    expect(r.ergebnis).toBe('aktualisiert');
    // Empfänger und Gesprächskontext bleiben, wie Rico sie gesetzt hat.
    expect(db.zeilen[0]).toMatchObject({ status: 'entwurf', toEmail: 'von-rico@korrigiert.example', gesprochenMit: 'Herr Klein' });
  });

  it('ein paralleler Aufruf war schneller → Ablehnung statt zweiter Entwurf', async () => {
    const original = MailService.getQueueMitStatus.bind(MailService);
    const spy = vi.spyOn(MailService, 'getQueueMitStatus').mockImplementationOnce(async () => {
      const q = await original();
      // Zwischen Lesen und Anlegen legt jemand anderes den Entwurf an.
      db.zeilen.push({ id: 'fremd', taskKey: AUFGABE, leadId: BigInt(592),
        subject: 'x', body: 'y', status: 'entwurf', createdAt: new Date(), updatedAt: new Date(), sentAt: null,
        templateId: null, gespraechAm: null, gesprochenMit: '', thema: '', toEmail: '' });
      return q;
    });
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'x' })).rejects.toThrow(/Inzwischen/);
    expect(db.zeilen.filter(z => z.taskKey === AUFGABE)).toHaveLength(1);
    spy.mockRestore();
  });

  it('Eingaben werden serverseitig geprüft', async () => {
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'x', status: 'freigegeben' })).rejects.toThrow(/Unbekannter Parameter/);
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'x', userName: 'Jemand' })).rejects.toThrow(/Unbekannter Parameter/);
    await expect(speichern.run({ taskKey: 'kein-schluessel', betreff: 'B', text: 'x' })).rejects.toThrow(/Form/);
    await expect(speichern.run({ taskKey: AUFGABE, betreff: '   ', text: 'x' })).rejects.toThrow(/Betreff ist leer/);
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B', text: 'x'.repeat(10_001) })).rejects.toThrow(/länger/);
    await expect(speichern.run({ taskKey: AUFGABE, betreff: 'B' })).rejects.toThrow(/text fehlt/);
    expect(db.schreibvorgaenge).toBe(0);
  });
});

describe('mail_warteschlange_anzeigen', () => {
  it('nur Mail-Aufgaben, mit Empfänger aus dem CRM', async () => {
    const w = await anzeigen.run({});
    expect(w.crm_status).toBe('ok');
    expect(w.anzahl).toBe(1);
    expect(w.vorgaenge).toEqual([expect.objectContaining({
      taskKey: AUFGABE, auftrag: 'Angebot nachreichen', empfaenger: 'kontakt-592@firma.example', entwurf: null,
    })]);
  });

  it('CRM-Ausfall wird gemeldet, nicht als leere Warteschlange verkauft', async () => {
    crm.status = 'nicht_erreichbar';
    const w = await anzeigen.run({});
    expect(w.crm_status).toBe('nicht_erreichbar');
  });

  it('Lead-Daten nicht lesbar → „Adresse unbekannt", nicht „keine Adresse im CRM"', async () => {
    crm.adressen = false;
    const w = await anzeigen.run({});
    expect(w.adressen_status).toBe('nicht_erreichbar');
    expect((w.vorgaenge as Array<{ empfaenger_hinweis: string }>)[0].empfaenger_hinweis).toMatch(/unbekannt/);
  });

  it('limit wird geprüft', async () => {
    await expect(anzeigen.run({ limit: 0 })).rejects.toThrow(/limit/);
    await expect(anzeigen.run({ limit: '5' })).rejects.toThrow(/limit/);
  });
});
