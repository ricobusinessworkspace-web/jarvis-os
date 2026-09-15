export function getBerlinDateStr(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

/**
 * Stunde (0–23) in Berliner Zeit.
 *
 * Für Regeln, die vom Tagesverlauf abhängen — etwa die Frage, ob ein noch
 * nicht erreichtes Tagesziel „verfehlt" heißt oder „läuft noch".
 */
export function getBerlinHour(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hourCycle: 'h23'
  });
  return Number(formatter.format(date));
}
