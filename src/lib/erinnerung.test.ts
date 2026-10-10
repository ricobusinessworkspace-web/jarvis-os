import { describe, expect, it } from 'vitest';
import { erinnerungWaehlen, type ErinnerungsLage } from './motivation';

const lage = (o: Partial<ErinnerungsLage> = {}): ErinnerungsLage => ({
  stunde: 18,
  ursachen: [
    { label: 'Training', offen: false, zaehlt: true, serie: 4, serieWennErledigt: 5 },
    { label: 'Post', offen: false, zaehlt: true, serie: 0, serieWennErledigt: 1 },
  ],
  calls: { wert: 40, basis: 30, zaehlt: true },
  routinen: [
    { label: 'Morgenroutine', art: 'morgen', erledigt: 6, gesamt: 6, basis: 3, zaehlt: true },
    { label: 'Abendroutine', art: 'abend', erledigt: 6, gesamt: 6, basis: 3, zaehlt: true },
  ],
  ...o,
});
const ursache = (label: string, serie: number, offen = true) =>
  ({ label, offen, zaehlt: true, serie, serieWennErledigt: offen ? serie + 1 : serie });

describe('erinnerungWaehlen', () => {
  it('alles erledigt → keine Mitteilung', () => {
    expect(erinnerungWaehlen(lage())).toEqual({ zeigen: false, titel: '', text: '' });
  });

  it('eine Stufe in Reichweite geht vor', () => {
    const e = erinnerungWaehlen(lage({ ursachen: [ursache('Training', 6), ursache('Post', 9)] }));
    expect(e).toMatchObject({ zeigen: true, titel: 'Stufe 7 in Reichweite' });
    expect(e.text).toContain('Training');
  });

  it('sonst die längste Serie in Gefahr', () => {
    const e = erinnerungWaehlen(lage({ ursachen: [ursache('Training', 4), ursache('Post', 9)] }));
    expect(e).toMatchObject({ titel: 'Post: Serie 9', text: 'Heute noch erledigen, dann sind es 10. Sonst reißt die Serie.' });
  });

  it('Abendroutine erst ab 19 Uhr, Morgenroutine bis 14 Uhr', () => {
    const routinen: ErinnerungsLage['routinen'] = [
      { label: 'Morgenroutine', art: 'morgen', erledigt: 1, gesamt: 6, basis: 3, zaehlt: true },
      { label: 'Abendroutine', art: 'abend', erledigt: 2, gesamt: 6, basis: 3, zaehlt: true },
    ];
    expect(erinnerungWaehlen(lage({ stunde: 9, routinen }))).toMatchObject({ titel: 'Morgenroutine 1/6', text: 'Basis ab 3 — noch 2 Schritte.' });
    expect(erinnerungWaehlen(lage({ stunde: 21, routinen }))).toMatchObject({ titel: 'Abendroutine 2/6', text: 'Basis ab 3 — noch 1 Schritt.' });
    expect(erinnerungWaehlen(lage({ stunde: 16, routinen })).zeigen).toBe(false);
  });

  it('Calls unter Basis nur vor 18 Uhr', () => {
    const calls = { wert: 12, basis: 30, zaehlt: true };
    expect(erinnerungWaehlen(lage({ stunde: 15, calls }))).toMatchObject({ titel: 'Calls 12/30', text: 'Noch 18 bis zur Basis.' });
    expect(erinnerungWaehlen(lage({ stunde: 19, calls })).zeigen).toBe(false);
  });

  it('Sonntag: nichts zählt → nichts zeigen', () => {
    const e = erinnerungWaehlen(lage({
      ursachen: [{ label: 'Training', offen: true, zaehlt: false, serie: 5, serieWennErledigt: 5 }],
      calls: { wert: null, basis: 30, zaehlt: false },
      routinen: [{ label: 'Abendroutine', art: 'abend', erledigt: 0, gesamt: 6, basis: 3, zaehlt: false }],
      stunde: 21,
    }));
    expect(e.zeigen).toBe(false);
  });

  it('am Ende eine offene Ursache ohne Serie', () => {
    expect(erinnerungWaehlen(lage({ ursachen: [ursache('Post', 0)] }))).toMatchObject({ titel: 'Post noch offen' });
  });
});
