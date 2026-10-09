/**
 * Töne fürs Abhaken — clean und minimal, ohne Audiodateien.
 *
 * Zwei Sinus-Töne mit weicher Hüllkurve (Web Audio). iOS spielt Ton nur als
 * Reaktion auf eine Berührung — deshalb nur aus Klick-Handlern aufrufen, nie
 * aus einem Effekt. Ein Fehler beim Abspielen ist egal: Ton ist Zugabe, nie
 * Voraussetzung.
 *
 * Schalter „Töne" je Gerät in `localStorage`, Standard an.
 */

const SCHLUESSEL = 'jarvis:toene';
export const TOENE_EVENT = 'jarvis:toene';

export function toeneAn(): boolean {
  try {
    return localStorage.getItem(SCHLUESSEL) !== 'aus';
  } catch {
    return true;
  }
}

export function setToene(an: boolean) {
  try {
    localStorage.setItem(SCHLUESSEL, an ? 'an' : 'aus');
  } catch {
    // privater Modus o. Ä. — dann bleibt es beim Standard
  }
  window.dispatchEvent(new CustomEvent(TOENE_EVENT, { detail: an }));
}

let kontext: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    kontext ??= new Ctor();
    if (kontext.state === 'suspended') void kontext.resume();
    return kontext;
  } catch {
    return null;
  }
}

/** Ein Ton: Frequenz, Einsatz und Dauer in Sekunden, Spitzenlautstärke 0…1. */
function ton(ctx: AudioContext, frequenz: number, einsatz: number, dauer: number, laut: number) {
  const t0 = ctx.currentTime + einsatz;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequenz, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(laut, t0 + 0.008); // kein Klicken am Anfang
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer); // sanft aus
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dauer + 0.02);
}

function spiele(toene: Array<[frequenz: number, einsatz: number, dauer: number, laut: number]>) {
  if (!toeneAn()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    for (const [f, e, d, l] of toene) ton(ctx, f, e, d, l);
  } catch {
    // Ton ist Zugabe
  }
}

/** Kurzer, leiser „Tick" beim Abhaken. */
export const tick = () => spiele([[1568, 0, 0.08, 0.05]]);

/** Heller Doppelton für Rekord, Stufe und perfekten Tag. */
export const fanfare = () => spiele([[1047, 0, 0.11, 0.07], [1568, 0.1, 0.16, 0.07]]);
