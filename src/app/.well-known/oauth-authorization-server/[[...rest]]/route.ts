import { anmeldeServerBeschreibung, CORS_OPTIONEN } from '@/lib/mcp/metadata';

/**
 * Beschreibung des Anmelde-Servers (RFC 8414). Auch unter
 * `/.well-known/oauth-authorization-server/api/mcp`, siehe Nachbar-Route.
 */
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return anmeldeServerBeschreibung(req);
}

export const OPTIONS = CORS_OPTIONEN;
