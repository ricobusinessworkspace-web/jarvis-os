import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RulesCard, type RuleRow } from './RulesCard';
import { TodayProvider } from './TodayProvider';

const karte = (rows: RuleRow[]) => (
  <TodayProvider heute={{ causes: [], rules: rows, routines: [] }}>
    <RulesCard date="2026-10-07" since="2026-10-07" />
  </TodayProvider>
);

vi.mock('@/actions/today', () => ({ toggleCause: vi.fn() }));
vi.mock('@/actions/verlauf', () => ({ clearCause: vi.fn() }));

const row = (over: Partial<RuleRow> = {}): RuleRow => ({
  metricKey: 'rule_a', label: 'Regel A', state: 'soll',
  streak: 2, bestStreak: 3, adherence: 1, broken: 0,
  ...over,
});

const relapses = () => screen.getByText('Rückfälle').querySelector('span')!.textContent;

afterEach(() => vi.restoreAllMocks());

describe('RulesCard', () => {
  it('summiert die Rückfälle aller Regeln', () => {
    render(karte([row({ broken: 1 }), row({ metricKey: 'rule_b', broken: 2 })]));
    expect(relapses()).toBe('3');
  });

  /**
   * Der Konsolenfehler „Received NaN for the `children` attribute": beim Hot
   * Reload bekam die neue Karte noch Zeilen der alten Seite, ohne `broken`.
   */
  it('zeigt „–" statt NaN, wenn einer Zeile Zahlen fehlen', () => {
    const error = vi.spyOn(console, 'error');
    const { rerender } = render(karte([row()]));

    const stale = { ...row(), broken: undefined, adherence: undefined, streak: undefined } as unknown as RuleRow;
    rerender(karte([stale]));

    expect(relapses()).toBe('–');
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.innerHTML).not.toContain('NaN');
    expect(error.mock.calls.flat().join(' ')).not.toContain('NaN');
  });
});
