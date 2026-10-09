/**
 * Was auf diesem Gerät schon gefeiert wurde — Stufen je Lauf, der perfekte
 * Tag je Datum. Nur `localStorage`: fehlt der Speicher (privater Modus),
 * wird höchstens doppelt gefeiert, nie etwas Falsches.
 */
const PRAEFIX = 'jarvis:gefeiert:';

export function schonGefeiert(schluessel: string): boolean {
  try {
    return localStorage.getItem(PRAEFIX + schluessel) !== null;
  } catch {
    return false;
  }
}

export function merkeGefeiert(schluessel: string) {
  try {
    localStorage.setItem(PRAEFIX + schluessel, new Date().toISOString());
  } catch {
    // ohne Speicher wird beim nächsten Mal eben noch einmal gefeiert
  }
}
