import { Flag, Trophy, Sparkles, CalendarRange } from 'lucide-react';
import type { Kette, KettenZustand, Zielbild as ZielbildDaten } from '@/core/services/MotivationService';
import { addDays, daysBetween, isoWeekday } from '@/lib/blocks';
import { GOLD_AB } from '@/lib/motivation';
import { formatPercent } from '@/lib/metricState';
import { cn } from '@/lib/utils';

/**
 * Die Ziele-Seite als Zielbild — von oben nach unten: die Reise, das
 * Ergebnisziel, die Ketten, die Rekordwand. Rechnet nichts: alles kommt aus
 * `zielbild()` im `MotivationService`. Gold nur für erreichte Stufen ab 7,
 * Rekorde und perfekte Tage.
 */

const datum = (d: string, jahr = false) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'short', ...(jahr ? { year: 'numeric' } : {}), timeZone: 'UTC',
  });

const euro = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

// ── 1. Reise ─────────────────────────────────────────────────────────────────

function Reise({ reise }: { reise: ZielbildDaten['reise'] }) {
  const { start, ende, heute } = reise;
  const gesamt = reise.tageGesamt;
  const pos = (d: string) => (gesamt ? Math.min(100, Math.max(0, (daysBetween(start, d) / (gesamt - 1)) * 100)) : 0);

  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title"><Flag className="h-4 w-4 text-muted" />Die Reise</h3>
        {ende && <span className="text-[11px] text-muted">{datum(start, true)} → {datum(ende, true)}</span>}
      </div>

      {!ende || !gesamt ? (
        <p className="text-[13px] text-muted">
          Kein Stichtag hinterlegt — die Reise braucht ein Umsatzziel mit Datum (unten in den Einstellungen).
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[38px] leading-none tabular-nums">{reise.tageUebrig}</span>
            <span className="text-[13px] text-muted">
              Tage bis {datum(ende, true)} · Tag {reise.tageVorbei} von {gesamt}
            </span>
          </div>

          <div className="relative mt-7 pb-9">
            {/* Phasen über der Schiene */}
            {reise.phasen.map(p => (
              <div
                key={p.nummer}
                className="absolute -top-5 truncate text-[10px] text-muted"
                style={{ left: `${pos(p.von)}%`, maxWidth: `${100 - pos(p.von)}%` }}
                title={`${p.name} · ab ${datum(p.von)}`}
              >
                <span className="mr-1 inline-block h-2 w-px translate-y-[2px] bg-white/30" />
                Phase {p.nummer}
              </div>
            ))}

            {/* Schiene: Blöcke als Abschnitte, gefüllt bis heute */}
            <div className="relative flex h-2.5 gap-[3px]">
              {reise.bloecke.map(b => {
                const breite = ((daysBetween(b.von, b.bis) + 1) / gesamt) * 100;
                const voll = heute >= b.bis ? 100 : heute < b.von ? 0 : ((daysBetween(b.von, heute) + 1) / (daysBetween(b.von, b.bis) + 1)) * 100;
                return (
                  <div key={b.nummer} className="relative h-full overflow-hidden rounded-full bg-white/[0.07]" style={{ width: `${breite}%` }}>
                    <div className="h-full rounded-full bg-foreground/80" style={{ width: `${voll}%` }} />
                  </div>
                );
              })}
            </div>

            {/* Du bist hier */}
            <div className="absolute top-[-3px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${pos(heute)}%` }}>
              <span className="h-4 w-4 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_3px_rgba(255,255,255,0.12)]" />
              <span className="mt-1.5 whitespace-nowrap text-[10.5px] font-medium">Du bist hier</span>
            </div>

            {/* Blockbeschriftung unter der Schiene */}
            <div className="absolute inset-x-0 top-[22px] flex gap-[3px]">
              {reise.bloecke.map(b => (
                <div
                  key={b.nummer}
                  className="truncate pt-5 text-[10px] text-muted"
                  style={{ width: `${((daysBetween(b.von, b.bis) + 1) / gesamt) * 100}%` }}
                >
                  Block {b.nummer}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 2. Ergebnisziel ──────────────────────────────────────────────────────────

function Ergebnis({ umsatz }: { umsatz: ZielbildDaten['umsatz'] }) {
  const anteil = umsatz.betrag !== null && umsatz.ziel ? Math.min(1, umsatz.betrag / umsatz.ziel) : null;
  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Ergebnisziel</h3>
        <span className="text-[11px] text-muted">
          {umsatz.ziel !== null ? `${euro(umsatz.ziel)}${umsatz.bis ? ` bis ${datum(umsatz.bis, true)}` : ''}` : 'kein Ziel'}
        </span>
      </div>
      {umsatz.betrag === null ? (
        <p className="text-[13px] leading-relaxed text-muted">
          Noch keine Provision erfasst. Eine 0 % stünde hier für die fehlende Eingabe, nicht für das Ergebnis —
          sobald der erste Abschluss einen Wert im CRM hat, rechnet die Leiste von selbst.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[38px] leading-none tabular-nums">{euro(umsatz.betrag)}</span>
            {umsatz.ziel !== null && <span className="font-mono text-[13px] text-muted">/ {euro(umsatz.ziel)}</span>}
          </div>
          {anteil !== null && (
            <div className="mt-4 h-3 rounded-full bg-white/[0.07]">
              <div
                className={cn('h-full rounded-full', anteil >= 1 ? 'bg-gold' : 'bg-foreground')}
                style={{ width: `${anteil * 100}%` }}
              />
            </div>
          )}
          <p className="text-[11px] text-muted">Erwartete Provision aus dem CRM, seit Planbeginn.</p>
        </>
      )}
    </div>
  );
}

// ── 3. Ketten ────────────────────────────────────────────────────────────────

const ZELLE: Record<KettenZustand, string> = {
  erfuellt: 'bg-foreground',
  verfehlt: 'bg-error/70',
  offen: 'border border-dashed border-white/40',
  leer: 'ring-1 ring-inset ring-white/15',
  frei: 'bg-white/[0.04]',
  vor: '',
};

const TEXT: Record<KettenZustand, string> = {
  erfuellt: 'erfüllt', verfehlt: 'verfehlt', offen: 'heute offen', leer: 'nicht eingetragen', frei: 'frei', vor: 'gab es noch nicht',
};

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** GitHub-artig: Spalten = Wochen (Mo–So), Zeilen = Wochentage. Der Sonntag ist als Joker markiert. */
function KettenGitter({ kette }: { kette: Kette }) {
  const erster = kette.tage[0]?.datum;
  if (!erster) return null;
  const vorlauf = isoWeekday(erster) - 1; // Plan beginnt an einem Dienstag
  const zellen: Array<Kette['tage'][number] | null> = [...Array(vorlauf).fill(null), ...kette.tage];
  const wochen: typeof zellen[] = [];
  for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7));

  return (
    <div className="flex gap-[3px]">
      <div className="mr-1 flex flex-col gap-[3px] text-[8.5px] leading-[11px] text-muted">
        {WOCHENTAGE.map(w => <span key={w} className={cn('h-[11px]', w === 'So' && 'text-foreground/70')}>{w}</span>)}
      </div>
      {wochen.map((woche, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {Array.from({ length: 7 }, (_, j) => {
            const t = woche[j];
            if (!t) return <span key={j} className="h-[11px] w-[11px]" />;
            return (
              <span
                key={j}
                title={`${datum(t.datum)} · ${TEXT[t.zustand]}${t.joker ? ' · Sonntag ist Joker' : ''}`}
                className={cn('relative h-[11px] w-[11px] rounded-[2.5px]', ZELLE[t.zustand])}
              >
                {t.joker && t.zustand !== 'vor' && (
                  <span className="absolute inset-0 m-auto h-[3px] w-[3px] rounded-full bg-background/80 ring-1 ring-white/40" />
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Ketten({ ketten }: { ketten: Kette[] }) {
  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Ketten</h3>
        <span className="text-[11px] text-muted">Kette nicht reißen lassen</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {ketten.map(k => (
          <div key={k.key} className="min-w-0">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="flex-1 truncate text-[13px]">{k.label}</span>
              <span className={cn('font-mono text-[12px] tabular-nums', k.serie >= GOLD_AB ? 'text-gold' : 'text-foreground')}>
                Serie {k.serie}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted">Rekord {k.rekord}</span>
            </div>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <KettenGitter kette={k} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-3 text-[10.5px] text-muted">
        {(['erfuellt', 'verfehlt', 'leer', 'frei', 'offen'] as const).map(z => (
          <span key={z} className="flex items-center gap-1.5">
            <span className={cn('h-[9px] w-[9px] rounded-[2px]', ZELLE[z])} />
            {TEXT[z]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="relative h-[9px] w-[9px] rounded-[2px] bg-white/[0.04]">
            <span className="absolute inset-0 m-auto h-[3px] w-[3px] rounded-full bg-background/80 ring-1 ring-white/40" />
          </span>
          Sonntag = Joker, reißt keine Serie
        </span>
      </div>
    </div>
  );
}

// ── 4. Rekordwand ────────────────────────────────────────────────────────────

function Rekordwand({ rekorde }: { rekorde: ZielbildDaten['rekorde'] }) {
  const { serien, perfekt, besteWoche } = rekorde;
  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title"><Trophy className="h-4 w-4 text-muted" />Rekordwand</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {serien.map(s => (
          <div key={s.key} className={cn('rounded-xl border p-3', s.gold ? 'border-gold/40 bg-gold/[0.06]' : 'border-border/50')}>
            <div className="truncate text-[11.5px] text-muted">{s.label}</div>
            <div className={cn('mt-1 font-mono text-[26px] leading-none tabular-nums', s.gold ? 'text-gold' : 'text-foreground')}>
              {s.rekord}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted">Tage längste Serie</div>
            {s.meilensteine.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {s.meilensteine.map(m => (
                  <span
                    key={m}
                    className={cn(
                      'rounded-md px-1.5 py-[1px] font-mono text-[9.5px]',
                      m >= GOLD_AB ? 'bg-gold/15 text-gold' : 'bg-white/[0.06] text-muted'
                    )}
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className={cn('rounded-xl border p-3', perfekt.anzahl > 0 ? 'border-gold/40 bg-gold/[0.06]' : 'border-border/50')}>
          <div className="flex items-center gap-1 text-[11.5px] text-muted"><Sparkles className="h-3 w-3" />Perfekte Tage</div>
          <div className={cn('mt-1 font-mono text-[26px] leading-none tabular-nums', perfekt.anzahl > 0 ? 'text-gold' : 'text-foreground')}>
            {perfekt.anzahl}
          </div>
          <div className="mt-0.5 text-[10.5px] text-muted">
            seit Phase 2{perfekt.rekord > 1 ? ` · ${perfekt.rekord} in Folge` : ''}
          </div>
        </div>

        <div className="rounded-xl border border-border/50 p-3">
          <div className="flex items-center gap-1 text-[11.5px] text-muted"><CalendarRange className="h-3 w-3" />Beste Blockwoche</div>
          {besteWoche ? (
            <>
              <div className="mt-1 font-mono text-[26px] leading-none tabular-nums">{formatPercent(besteWoche.quote)}</div>
              <div className="mt-0.5 text-[10.5px] text-muted">
                {datum(besteWoche.von)} – {datum(addDays(besteWoche.von, 6))} · {formatPercent(besteWoche.abdeckung)} eingetragen
              </div>
            </>
          ) : (
            <div className="mt-1 text-[11px] leading-snug text-muted">
              Noch keine abgeschlossene Woche mit mindestens 70 % Einträgen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Zielbild({ daten }: { daten: ZielbildDaten }) {
  return (
    <div className="flex flex-col gap-3">
      <Reise reise={daten.reise} />
      <Ergebnis umsatz={daten.umsatz} />
      <Ketten ketten={daten.ketten} />
      <Rekordwand rekorde={daten.rekorde} />
    </div>
  );
}
