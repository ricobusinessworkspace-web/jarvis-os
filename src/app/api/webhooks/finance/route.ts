/**
 * Finance Webhook Route — /api/webhooks/finance
 * ------------------------------------------------
 * Receives bank transaction data from n8n (via GoCardless) and:
 * 1. Validates the N8N_WEBHOOK_SECRET bearer token
 * 2. Deduplicates transactions using bankTransactionId (or a hash fallback)
 * 3. Saves them as "cleared" transactions in jarvis_transactions
 * 4. Updates the finance_buckets.liquid value with the current bank balance
 * 5. Revalidates the dashboard for live updates
 *
 * POST — Ingest bank transactions
 */
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { validateWebhookAuth, unauthorizedResponse } from '@/lib/webhook-auth';
import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────
interface IncomingTransaction {
  bankTransactionId?: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description?: string;
  date: string;
}

interface FinancePayload {
  transactions: IncomingTransaction[];
  current_balance?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic hash from transaction data as fallback dedup key
 * when no bankTransactionId is provided by GoCardless/n8n.
 */
function generateTransactionHash(tx: IncomingTransaction): string {
  const raw = `${tx.date}|${tx.amount}|${tx.type}|${tx.description || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * Validate the incoming payload structure.
 */
function validatePayload(body: unknown): { valid: true; data: FinancePayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const payload = body as Record<string, unknown>;

  if (!Array.isArray(payload.transactions)) {
    return { valid: false, error: '"transactions" must be an array' };
  }

  if (payload.transactions.length === 0) {
    return { valid: false, error: '"transactions" array must not be empty' };
  }

  for (let i = 0; i < payload.transactions.length; i++) {
    const tx = payload.transactions[i] as Record<string, unknown>;
    if (typeof tx.amount !== 'number') {
      return { valid: false, error: `transactions[${i}].amount must be a number` };
    }
    if (tx.type !== 'income' && tx.type !== 'expense') {
      return { valid: false, error: `transactions[${i}].type must be "income" or "expense"` };
    }
    if (typeof tx.category !== 'string' || !tx.category.trim()) {
      return { valid: false, error: `transactions[${i}].category must be a non-empty string` };
    }
    if (typeof tx.date !== 'string' || isNaN(Date.parse(tx.date))) {
      return { valid: false, error: `transactions[${i}].date must be a valid ISO date string` };
    }
  }

  if (payload.current_balance !== undefined && typeof payload.current_balance !== 'number') {
    return { valid: false, error: '"current_balance" must be a number if provided' };
  }

  return { valid: true, data: payload as unknown as FinancePayload };
}

// ─── POST: Ingest bank transactions ─────────────────────────────────────────
export async function POST(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const validation = validatePayload(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { transactions, current_balance } = validation.data;

    let created = 0;
    let skipped = 0;

    // ── Process transactions ──
    for (const tx of transactions) {
      const bankTxId = tx.bankTransactionId || generateTransactionHash(tx);

      try {
        // Check if this transaction already exists (dedup)
        const existing = await prisma.transaction.findUnique({
          where: { bankTransactionId: bankTxId }
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.transaction.create({
          data: {
            bankTransactionId: bankTxId,
            amount: tx.amount,
            type: tx.type,
            status: 'cleared',
            category: tx.category,
            description: tx.description || '',
            date: new Date(tx.date),
          }
        });

        created++;
      } catch (err: unknown) {
        // Handle unique constraint violation (race condition safety)
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
          skipped++;
          continue;
        }
        throw err;
      }
    }

    // ── Update liquid balance in finance_buckets ──
    let balanceUpdated = false;

    if (current_balance !== undefined) {
      const bucketSetting = await prisma.setting.findUnique({
        where: { key: 'finance_buckets' }
      });

      const buckets = bucketSetting?.value
        ? JSON.parse(bucketSetting.value)
        : { liquid: 0, depot: 0, assets: 0, debt: 0 };

      buckets.liquid = current_balance;

      await prisma.setting.upsert({
        where: { key: 'finance_buckets' },
        update: { value: JSON.stringify(buckets) },
        create: { key: 'finance_buckets', value: JSON.stringify(buckets) }
      });

      balanceUpdated = true;
    }

    // ── Revalidate dashboard ──
    revalidatePath('/', 'layout');

    console.log(`[webhooks/finance] Processed: ${created} created, ${skipped} skipped, balance_updated=${balanceUpdated}`);

    return NextResponse.json(
      {
        success: true,
        created,
        skipped,
        balance_updated: balanceUpdated
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[webhooks/finance] POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
