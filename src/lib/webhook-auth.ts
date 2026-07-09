/**
 * Webhook Authentication Middleware
 * ----------------------------------
 * Validates incoming webhook requests against the N8N_WEBHOOK_SECRET
 * bearer token. Used by all /api/webhooks/* routes.
 */
import { NextResponse } from 'next/server';

/**
 * Validates that a request carries a valid Bearer token
 * matching the configured N8N_WEBHOOK_SECRET.
 */
export function validateWebhookAuth(req: Request): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET;

  // If no secret is configured, reject all webhook requests for security
  if (!secret) {
    console.warn('[webhook-auth] N8N_WEBHOOK_SECRET is not set — rejecting request.');
    return false;
  }

  const authHeader = req.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return false;
  }

  return token === secret;
}

/**
 * Returns a standardised 401 Unauthorized JSON response.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized — invalid or missing webhook token' },
    { status: 401 }
  );
}
