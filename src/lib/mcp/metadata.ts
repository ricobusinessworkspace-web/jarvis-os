import { basisAdresse, mcpAdresse, SCOPE } from './oauth';

/**
 * Die zwei Beschreibungen, die ein Connector sucht, bevor er sich anmeldet.
 *
 * Zuerst die der geschützten Sache (RFC 9728): sie nennt den zuständigen
 * Anmelde-Server. Dann dessen eigene (RFC 8414): wohin der Browser geht, wo
 * es das Zeichen gibt, wie man sich registriert.
 *
 * `issuer` und `authorization_servers` müssen **zeichengenau** gleich sein —
 * sonst verweigert ChatGPT die feste Rücksprung-Adresse.
 */

const KOPF = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300',
};

export function ressourcenBeschreibung(req: Request): Response {
  return Response.json(
    {
      resource: mcpAdresse(req),
      authorization_servers: [basisAdresse(req)],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Jarvis OS',
    },
    { headers: KOPF },
  );
}

export function anmeldeServerBeschreibung(req: Request): Response {
  const basis = basisAdresse(req);
  return Response.json(
    {
      issuer: basis,
      authorization_endpoint: `${basis}/api/oauth/authorize`,
      token_endpoint: `${basis}/api/oauth/token`,
      registration_endpoint: `${basis}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [SCOPE],
      // RFC 9207: `iss` steht in jeder Antwort der Zustimmungsseite.
      authorization_response_iss_parameter_supported: true,
    },
    { headers: KOPF },
  );
}

export const CORS_OPTIONEN = () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
    },
  });
