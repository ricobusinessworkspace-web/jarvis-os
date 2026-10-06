/**
 * OAuth-Endpunkte bekommen ihre Felder je nach Client als Formular
 * (`application/x-www-form-urlencoded`, so will es die Spezifikation) oder
 * als JSON. Beides wird zu einem flachen Objekt aus Zeichenketten.
 */
export async function felderLesen(req: Request): Promise<Record<string, string>> {
  const art = req.headers.get('content-type') ?? '';
  const text = await req.text();
  if (!text) return {};

  if (art.includes('application/json')) {
    try {
      const daten = JSON.parse(text);
      if (!daten || typeof daten !== 'object') return {};
      return Object.fromEntries(
        Object.entries(daten).filter(([, v]) => typeof v === 'string') as Array<[string, string]>,
      );
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}
