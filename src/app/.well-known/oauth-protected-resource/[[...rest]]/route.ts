import { ressourcenBeschreibung, CORS_OPTIONEN } from '@/lib/mcp/metadata';

/**
 * Beschreibung des MCP-Servers (RFC 9728). Erreichbar unter
 * `/.well-known/oauth-protected-resource` und — weil manche Clients den Pfad
 * der Ressource anhängen — unter `/.well-known/oauth-protected-resource/api/mcp`.
 */
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return ressourcenBeschreibung(req);
}

export const OPTIONS = CORS_OPTIONEN;
