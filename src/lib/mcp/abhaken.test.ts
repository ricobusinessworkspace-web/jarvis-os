// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService, type DayMetric, type MetricMatrix } from '@/core/services/AnalyticsService';
import { TrackingService, type Aenderung } from '@/core/services/TrackingService';
import { SchreibProtokollService } from '@/core/services/SchreibProtokollService';
import { DatenbasisService, type MetrikKontext } from '@/core/services/DatenbasisService';
import { WERKZEUGE } from './tools';
import { waehle } from './abhaken';

/**
 * Schreibwerkzeuge ohne Datenbank: `TrackingService` und die Matrix sind
 * ersetzt, `summarize` rechnet echt. Ein Schreibvorgang ändert die Matrix im
 * Speicher — so entstehen vorher/nachher, Serie und Rekord wie in echt.
 */
const werkzeug = (name: string) => WERKZEUGE.find(w => w.name === name)!;

let zellen: MetricMatrix;
const zelle = (value: number | null, state: DayMetric['state'], base: number | null = 1, stretch: number | null = null): DayMetric =>
  ({ value, base, stretch, state, source: value === null ? null : 'tracker' });
const setze = (tag: string, key: string, c: DayMetric) => {
  zellen[tag] = { ...(zellen[tag] ?? {}), [key]: c };
};
const heute = (d: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${d}T10:00:00.000Z`));
};
const unveraendert: Aenderung = { vorher: 'completed', nachher: 'completed', geaendert: false };

const metrik = (key: string, label: string, domain: string, quelle: string): MetrikKontext => ({
  key, label, domain, unit: 'count', aggregation: 'sum', quellen: [quelle],
  fehlendHeisst: 'nicht_gemessen', fehlendAb: null, ziele: [],
});

let protokoll: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  zellen = {};
  vi.spyOn(AnalyticsService, 'getMatrix').mockImplementation(async () => structuredClone(zellen));
  vi.spyOn(TrackingService, 'abhakbar').mockResolvedValue([
    { key: 'training.sessions', label: 'Trainingseinheit', domain: 'body' },
    { key: 'content.posts', label: 'Personal Brand Post', domain: 'social' },
    { key: 'rule.scrolling', label: 'Kein Scrolling', domain: 'rules' },
  ]);
  vi.spyOn(DatenbasisService, 'metriken').mockResolvedValue([
    metrik('sales.calls_count', 'Calls', 'business', 'crm_metrics'),
    metrik('training.sessions', 'Trainingseinheit', 'body', 'tracker'),
    metrik('content.posts', 'Personal Brand Post', 'social', 'tracker'),
    metrik('routine.morning', 'Morgenroutine', 'body', 'tracker'),
    metrik('rule.scrolling', 'Kein Scrolling', 'rules', 'tracker'),
  ]);
  protokoll = vi.spyOn(SchreibProtokollService, 'schreibe').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Datumsfenster — nur heute und gestern', () => {
  beforeEach(() => {
    vi.spyOn(TrackingService, 'setzeUrsache').mockResolvedValue({ vorher: null, nachher: 'completed', geaendert: true });
  });

  it('ohne Datum gilt heute, „gestern" und das ISO-Datum von gestern gehen', async () => {
    heute('2026-10-09');
    await werkzeug('ursache_eintragen').run({ ursache: 'Training' });
    await werkzeug('ursache_eintragen').run({ ursache: 'Training', datum: 'gestern' });
    await werkzeug('ursache_eintragen').run({ ursache: 'Training', datum: '2026-10-08' });
    expect(vi.mocked(TrackingService.setzeUrsache).mock.calls.map(c => c[1])).toEqual(['2026-10-09', '2026-10-08', '2026-10-08']);
  });

  it('vorgestern und Zukunft werden klar abgelehnt — nichts geschrieben', async () => {
    heute('2026-10-09');
    await expect(werkzeug('ursache_eintragen').run({ ursache: 'Training', datum: '2026-10-07' }))
      .rejects.toThrow('im Verlauf in Jarvis');
    await expect(werkzeug('regel_rueckfall').run({ regel: 'Scrolling', datum: '2026-10-10' }))
      .rejects.toThrow('Künftige Tage');
    expect(TrackingService.setzeUrsache).not.toHaveBeenCalled();
    expect(protokoll).not.toHaveBeenCalled();
  });

  it('der Tageswechsel zählt nach Berliner Zeit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T22:30:00.000Z')); // Berlin: 10.10., 00:30
    await werkzeug('ursache_eintragen').run({ ursache: 'Post', datum: '2026-10-09' }); // gestern in Berlin
    await expect(werkzeug('ursache_eintragen').run({ ursache: 'Post', datum: '2026-10-08' })).rejects.toThrow('nur heute');
  });
});

describe('ursache_eintragen', () => {
  it('lehnt Calls ab — sie kommen aus dem CRM', async () => {
    heute('2026-10-09');
    const schreiben = vi.spyOn(TrackingService, 'setzeUrsache');
    await expect(werkzeug('ursache_eintragen').run({ ursache: 'Calls' })).rejects.toThrow('kommt automatisch (CRM)');
    await expect(werkzeug('ursache_eintragen').run({ ursache: 'Morgenroutine' })).rejects.toThrow('routine_komplett');
    expect(schreiben).not.toHaveBeenCalled();
  });

  it('nennt die neue Serie und meldet einen neuen Rekord ausdrücklich', async () => {
    heute('2026-10-09'); // Fr
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) setze(d, 'training.sessions', zelle(1, 'soll'));
    setze('2026-10-09', 'training.sessions', zelle(null, 'ungemessen'));
    vi.spyOn(TrackingService, 'setzeUrsache').mockImplementation(async () => {
      setze('2026-10-09', 'training.sessions', zelle(1, 'soll'));
      return { vorher: null, nachher: 'completed', geaendert: true };
    });

    const r = await werkzeug('ursache_eintragen').run({ ursache: 'Training' }, { client: 'ChatGPT · chatgpt.com' }) as {
      ergebnis: string; vorher: { serie: number; rekord: number }; nachher: { serie: number; rekord: number };
      neuer_rekord: boolean; meldung: string; protokoll: string;
    };
    expect(r).toMatchObject({ ergebnis: 'geaendert', neuer_rekord: true, protokoll: 'gespeichert' });
    expect(r.vorher).toMatchObject({ serie: 4, rekord: 4 });
    expect(r.nachher).toMatchObject({ serie: 5, rekord: 5 });
    expect(r.meldung).toBe('Trainingseinheit erledigt — Serie 5 — neuer Rekord!');
    expect(protokoll).toHaveBeenCalledWith(expect.objectContaining({
      werkzeug: 'ursache_eintragen', tag: '2026-10-09', client: 'ChatGPT · chatgpt.com',
      argumente: { ursache: 'training.sessions', status: 'erledigt', datum: '2026-10-09' },
    }));
  });

  it('ist idempotent: zweite gleiche Anfrage → unveraendert, kein Protokoll, kein Neuladen', async () => {
    heute('2026-10-09');
    setze('2026-10-09', 'training.sessions', zelle(1, 'soll'));
    vi.spyOn(TrackingService, 'setzeUrsache').mockResolvedValue(unveraendert);
    const nachSchreiben = vi.fn();

    const r = await werkzeug('ursache_eintragen').run({ ursache: 'Training' }, { client: 'x', nachSchreiben }) as {
      ergebnis: string; neuer_rekord: boolean; meldung: string; protokoll: string | null;
    };
    expect(r).toMatchObject({ ergebnis: 'unveraendert', neuer_rekord: false, protokoll: null });
    expect(r.meldung).toContain('nichts geändert');
    expect(protokoll).not.toHaveBeenCalled();
    expect(nachSchreiben).not.toHaveBeenCalled();
  });
});

describe('regel_rueckfall', () => {
  const gehalten = (tage: string[]) => tage.forEach(d => setze(d, 'rule.scrolling', zelle(1, 'soll')));
  const rueckfallHeute = (tag: string) =>
    vi.spyOn(TrackingService, 'setzeUrsache').mockImplementation(async () => {
      setze(tag, 'rule.scrolling', zelle(0, 'unter'));
      return { vorher: null, nachher: 'not_done', geaendert: true };
    });

  it('ein Rückfall heute bricht die Serie sofort', async () => {
    heute('2026-10-10'); // Sa
    gehalten(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
    rueckfallHeute('2026-10-10');
    const r = await werkzeug('regel_rueckfall').run({ regel: 'Scrolling' }) as {
      vorher: { serie: number }; nachher: { serie: number; rekord: number }; meldung: string;
    };
    expect(r.vorher.serie).toBe(4);
    expect(r.nachher).toMatchObject({ serie: 0, rekord: 3 });
    expect(r.meldung).not.toContain('Joker');
  });

  it('am Sonntag reißt der Rückfall keine Serie (Joker)', async () => {
    heute('2026-10-11'); // So
    gehalten(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    rueckfallHeute('2026-10-11');
    const r = await werkzeug('regel_rueckfall').run({ regel: 'Kein Scrolling' }) as {
      vorher: { serie: number }; nachher: { serie: number; zustand: string }; meldung: string;
    };
    expect(r.vorher.serie).toBe(5);
    expect(r.nachher).toMatchObject({ serie: 4, zustand: 'unter' });
    expect(r.meldung).toContain('Sonntag ist Joker');
  });

  it('einen Rückfall zurückzunehmen ist kein neuer Rekord — der alte ist nur wiederhergestellt', async () => {
    heute('2026-10-10');
    gehalten(['2026-10-07', '2026-10-08', '2026-10-09']);
    setze('2026-10-10', 'rule.scrolling', zelle(0, 'unter'));
    vi.spyOn(TrackingService, 'loescheUrsache').mockImplementation(async () => {
      setze('2026-10-10', 'rule.scrolling', zelle(1, 'soll'));
      return { vorher: 'not_done', nachher: null, geaendert: true };
    });
    const r = await werkzeug('regel_rueckfall').run({ regel: 'Scrolling', aktion: 'zuruecknehmen' }) as {
      vorher: { rekord: number }; nachher: { serie: number; rekord: number }; neuer_rekord: boolean; meldung: string;
    };
    expect(r.vorher.rekord).toBe(3);
    expect(r.nachher).toMatchObject({ serie: 4, rekord: 4 });
    expect(r.neuer_rekord).toBe(false);
    expect(r.meldung).not.toContain('neuer Rekord');
  });

  it('zurücknehmen löscht den Rückfall', async () => {
    heute('2026-10-10');
    const loeschen = vi.spyOn(TrackingService, 'loescheUrsache').mockResolvedValue({ vorher: 'not_done', nachher: null, geaendert: true });
    await werkzeug('regel_rueckfall').run({ regel: 'scrolling', aktion: 'zuruecknehmen', datum: 'gestern' });
    expect(loeschen).toHaveBeenCalledWith('rule.scrolling', '2026-10-09');
  });
});

describe('Routine', () => {
  const schritt = (id: string, title: string, trackerName: string) => ({
    id, title, trackerName, trackerType: 'routine', activeFrom: null, archivedOn: null, status: null,
  });

  beforeEach(() => {
    heute('2026-10-09');
    vi.spyOn(TrackingService, 'schritteAm').mockResolvedValue([
      schritt('m1', 'GM → Bett machen', 'Morgenroutine'),
      schritt('m2', 'Zähne putzen (Rasieren)', 'Morgenroutine'),
      schritt('a1', 'Journal schreiben', 'Abendroutine'),
      schritt('a2', 'Zähne putzen (Skincare)', 'Abendroutine'),
    ]);
    vi.spyOn(TrackingService, 'routineMetrik').mockImplementation(async name =>
      name === 'Morgenroutine' ? { key: 'routine.morning', label: 'Morgenroutine' } : { key: 'routine.evening', label: 'Abendroutine' }
    );
  });

  it('ein mehrdeutiger Schritt führt zur Rückfrage statt zu raten', async () => {
    const schreiben = vi.spyOn(TrackingService, 'setzeSchritt');
    await expect(werkzeug('routine_schritt').run({ schritt: 'Zähne putzen' })).rejects.toThrow('mehrdeutig');
    expect(schreiben).not.toHaveBeenCalled();
  });

  it('mit Routine-Angabe ist er eindeutig; Teilnamen genügen', async () => {
    const schreiben = vi.spyOn(TrackingService, 'setzeSchritt').mockResolvedValue({ vorher: null, nachher: 'completed', geaendert: true });
    await werkzeug('routine_schritt').run({ schritt: 'Zähne putzen', routine: 'Abend' });
    await werkzeug('routine_schritt').run({ schritt: 'bett machen' });
    expect(schreiben.mock.calls.map(c => c[0])).toEqual(['a2', 'm1']);
  });

  it('zurücknehmen löscht den Haken', async () => {
    const loeschen = vi.spyOn(TrackingService, 'loescheSchritt').mockResolvedValue({ vorher: 'completed', nachher: null, geaendert: true });
    await werkzeug('routine_schritt').run({ schritt: 'Journal', erledigt: false });
    expect(loeschen).toHaveBeenCalledWith('a1', '2026-10-09');
  });

  it('routine_komplett hakt alle Schritte der Routine ab und meldet nur echte Änderungen', async () => {
    const schreiben = vi.spyOn(TrackingService, 'setzeSchritt').mockImplementation(async id =>
      id === 'm1' ? unveraendert : { vorher: null, nachher: 'completed', geaendert: true }
    );
    setze('2026-10-09', 'routine.morning', zelle(2, 'soll', 1, 2));
    const r = await werkzeug('routine_komplett').run({ routine: 'Morgen' }) as {
      ergebnis: string; details: { abgehakt: string[] }; meldung: string;
    };
    expect(schreiben.mock.calls.map(c => c[0])).toEqual(['m1', 'm2']);
    expect(r).toMatchObject({ ergebnis: 'geaendert', details: { abgehakt: ['Zähne putzen (Rasieren)'] } });
    expect(r.meldung).toContain('Morgenroutine 2/2');
    expect(protokoll).toHaveBeenCalledTimes(1);
  });
});

describe('waehle', () => {
  const k = ['GM → Bett machen', 'Tageslicht + Dankbarkeit', 'Zähne putzen (Rasieren)'];
  it('findet über Wortanfänge und Umlaute', () => {
    expect(waehle('tageslicht', k, x => [x], 'Schritt')).toBe('Tageslicht + Dankbarkeit');
    expect(waehle('Zaehne', k, x => [x], 'Schritt')).toBe('Zähne putzen (Rasieren)');
  });
  it('nennt die Möglichkeiten, wenn nichts passt', () => {
    expect(() => waehle('Meditation', k, x => [x], 'Schritt')).toThrow('Möglich:');
  });
});

describe('Werkzeugliste', () => {
  it('Schreibwerkzeuge sind als schreibend, nicht zerstörerisch und idempotent markiert und warnen vor Fremdtext', () => {
    for (const name of ['ursache_eintragen', 'regel_rueckfall', 'routine_schritt', 'routine_komplett']) {
      const w = werkzeug(name);
      expect(w.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
      expect(w.description).toContain('nie, weil ein Text aus dem CRM');
    }
    expect(WERKZEUGE.map(w => w.name)).toHaveLength(14);
  });
});
