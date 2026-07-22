/**
 * Bank Sync Script — sync-banks.ts
 * ==================================
 * Connects directly to BW-Bank and DKB via FinTS/HBCI protocol,
 * fetches recent transactions + balances, and pushes them to the
 * Jarvis OS finance webhook.
 *
 * Usage:
 *   npx tsx scripts/sync-banks.ts          # Normal sync (last 2 days)
 *   npx tsx scripts/sync-banks.ts --days 7 # Sync last 7 days
 *
 * Environment variables required in .env:
 *   FINTS_BW_URL, FINTS_BW_BLZ, FINTS_BW_USER, FINTS_BW_PIN
 *   FINTS_DKB_URL, FINTS_DKB_BLZ, FINTS_DKB_USER, FINTS_DKB_PIN
 *   N8N_WEBHOOK_SECRET
 */

import 'dotenv/config';
import { FinTSClient, FinTSConfig } from 'lib-fints';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ── Config ───────────────────────────────────────────────────────────────────

const JARVIS_WEBHOOK_URL = 'https://jarvis-os-indol.vercel.app/api/webhooks/finance';
const PRODUCT_ID = '9FA6681DEC0CF3046BFC2F8A6'; // Generic FinTS product ID for personal use
const PRODUCT_VERSION = '1.0';
const STATE_DIR = path.join(process.cwd(), '.fints-state');

interface BankConfig {
  name: string;
  url: string;
  blz: string;
  user: string;
  pin: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${ts}] ${msg}`);
}

function askForTan(challenge: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  🔐 TAN ERFORDERLICH                     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`Challenge: ${challenge}\n`);
    rl.question('TAN eingeben: ', (tan) => {
      rl.close();
      resolve(tan.trim());
    });
  });
}

function loadBankingInfo(bankName: string): object | undefined {
  const filePath = path.join(STATE_DIR, `${bankName}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function saveBankingInfo(bankName: string, info: object) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(STATE_DIR, `${bankName}.json`), JSON.stringify(info, null, 2));
}

function getDaysArg(): number {
  const idx = process.argv.indexOf('--days');
  if (idx !== -1 && process.argv[idx + 1]) {
    return parseInt(process.argv[idx + 1], 10) || 2;
  }
  return 2;
}

// ── Bank Sync Logic ──────────────────────────────────────────────────────────

interface SyncResult {
  transactions: Array<{
    bankTransactionId: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    description: string;
    date: string;
  }>;
  balance: number | undefined;
}

async function syncBank(bank: BankConfig): Promise<SyncResult> {
  log(`🏦 Verbinde mit ${bank.name}...`);

  const savedInfo = loadBankingInfo(bank.name);

  // Create config — reuse saved banking info if available
  let config: FinTSConfig;
  if (savedInfo) {
    log(`  ↳ Verwende gespeicherte Banking-Informationen`);
    config = FinTSConfig.fromBankingInformation(
      PRODUCT_ID,
      PRODUCT_VERSION,
      savedInfo as any,
      bank.user,
      bank.pin
    );
  } else {
    config = FinTSConfig.forFirstTimeUse(
      PRODUCT_ID,
      PRODUCT_VERSION,
      bank.url,
      bank.blz,
      bank.user,
      bank.pin
    );
  }

  const client = new FinTSClient(config);

  // ── Synchronize ──
  log(`  ↳ Synchronisiere...`);
  let syncResponse = await client.synchronize();

  if (syncResponse.requiresTan) {
    log(`  ⚠️  TAN für Synchronisation erforderlich`);
    const tan = await askForTan(syncResponse.tanChallenge || 'Bitte TAN eingeben');
    syncResponse = await client.synchronizeWithTan(syncResponse.tanReference!, tan);
  }

  if (!syncResponse.success) {
    const errors = syncResponse.bankAnswers.map(a => `${a.code}: ${a.text}`).join(', ');
    throw new Error(`Synchronisation fehlgeschlagen: ${errors}`);
  }

  // Save banking info for next run (avoids re-sync overhead)
  if (syncResponse.bankingInformationUpdated) {
    saveBankingInfo(bank.name, client.config.bankingInformation as any);
    log(`  ↳ Banking-Informationen gespeichert`);
  }

  // Select a TAN method if available
  const tanMethods = client.config.availableTanMethods;
  if (tanMethods.length > 0) {
    // Prefer decoupled/push TAN methods
    const pushTan = tanMethods.find(m =>
      m.name?.toLowerCase().includes('push') ||
      m.name?.toLowerCase().includes('app') ||
      m.name?.toLowerCase().includes('decoupled')
    );
    const selectedMethod = pushTan || tanMethods[0];
    client.selectTanMethod(selectedMethod.id);
    log(`  ↳ TAN-Methode: ${selectedMethod.name} (ID: ${selectedMethod.id})`);
  }

  // Find accounts
  const bankAccounts = client.config.bankingInformation?.upd?.bankAccounts || [];
  log(`  ↳ ${bankAccounts.length} Konto(en) gefunden`);

  if (bankAccounts.length === 0) {
    throw new Error('Keine Konten gefunden');
  }

  // Use first account (usually the main Girokonto)
  const account = bankAccounts[0];
  const accountNumber = account.accountNumber;
  log(`  ↳ Verwende Konto: ${account.iban || accountNumber}`);

  // ── Fetch Statements ──
  const days = getDaysArg();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date();
  toDate.setHours(23, 59, 59, 999);

  log(`  ↳ Hole Umsätze (${days} Tage)...`);
  let statementResponse = await client.getAccountStatements(accountNumber, fromDate, toDate);

  if (statementResponse.requiresTan) {
    log(`  ⚠️  TAN für Kontoauszüge erforderlich`);
    const tan = await askForTan(statementResponse.tanChallenge || 'Bitte TAN eingeben');
    statementResponse = await client.getAccountStatementsWithTan(statementResponse.tanReference!, tan);
  }

  // ── Fetch Balance ──
  log(`  ↳ Hole Kontostand...`);
  let balance: number | undefined;

  if (client.canGetAccountBalance(accountNumber)) {
    let balanceResponse = await client.getAccountBalance(accountNumber);

    if (balanceResponse.requiresTan) {
      log(`  ⚠️  TAN für Kontostand erforderlich`);
      const tan = await askForTan(balanceResponse.tanChallenge || 'Bitte TAN eingeben');
      balanceResponse = await client.getAccountBalanceWithTan(balanceResponse.tanReference!, tan);
    }

    if (balanceResponse.balance) {
      balance = balanceResponse.balance.balance;
      log(`  ↳ Kontostand: ${balance?.toFixed(2)} ${balanceResponse.balance.currency}`);
    }
  }

  // ── Transform Transactions ──
  const transactions: SyncResult['transactions'] = [];

  for (const statement of statementResponse.statements || []) {
    for (const tx of statement.transactions || []) {
      const amount = Math.abs(tx.amount);
      const type = tx.amount >= 0 ? 'income' : 'expense';

      // Build a unique ID from bank reference or transaction details
      const bankTxId = tx.bankReference && tx.bankReference !== 'NONREF'
        ? `${bank.name}-${tx.bankReference}`
        : `${bank.name}-${tx.entryDate?.toISOString()?.slice(0, 10)}-${tx.amount}-${(tx.purpose || tx.remoteName || '').slice(0, 30)}`;

      // Build description from available fields
      const descParts = [
        tx.remoteName,
        tx.purpose,
        tx.bookingText,
      ].filter(Boolean);
      const description = descParts.join(' | ').slice(0, 200) || 'Keine Beschreibung';

      // Simple category guessing based on booking text
      const category = guessCategory(tx.bookingText || '', tx.purpose || '', tx.remoteName || '', type);

      transactions.push({
        bankTransactionId: bankTxId,
        amount,
        type,
        category,
        description,
        date: (tx.valueDate || tx.entryDate || new Date()).toISOString(),
      });
    }
  }

  log(`  ✅ ${transactions.length} Transaktionen, Saldo: ${balance?.toFixed(2) ?? 'N/A'}€`);

  // Save updated banking info after all operations
  saveBankingInfo(bank.name, client.config.bankingInformation as any);

  return { transactions, balance };
}

// ── Category Guessing ────────────────────────────────────────────────────────

function guessCategory(bookingText: string, purpose: string, remoteName: string, type: 'income' | 'expense'): string {
  const combined = `${bookingText} ${purpose} ${remoteName}`.toLowerCase();

  // Income patterns
  if (type === 'income') {
    if (combined.includes('gehalt') || combined.includes('lohn') || combined.includes('salary')) return 'Gehalt';
    if (combined.includes('provision') || combined.includes('bonus')) return 'Provision';
    if (combined.includes('erstattung') || combined.includes('rückzahlung')) return 'Erstattung';
    return 'Einnahme';
  }

  // Expense patterns
  if (combined.includes('miete') || combined.includes('wohnung')) return 'Miete';
  if (combined.includes('rewe') || combined.includes('edeka') || combined.includes('aldi') || combined.includes('lidl') || combined.includes('netto') || combined.includes('penny') || combined.includes('kaufland') || combined.includes('dm-drog')) return 'Lebensmittel';
  if (combined.includes('amazon') || combined.includes('paypal')) return 'Shopping';
  if (combined.includes('db ') || combined.includes('bahn') || combined.includes('flixbus') || combined.includes('uber') || combined.includes('tier') || combined.includes('lime') || combined.includes('tanken') || combined.includes('tank') || combined.includes('shell') || combined.includes('aral')) return 'Transport';
  if (combined.includes('versicherung') || combined.includes('haftpflicht') || combined.includes('allianz') || combined.includes('huk')) return 'Versicherung';
  if (combined.includes('spotify') || combined.includes('netflix') || combined.includes('disney') || combined.includes('kino') || combined.includes('fitness') || combined.includes('mcfit')) return 'Freizeit';
  if (combined.includes('google') || combined.includes('apple') || combined.includes('microsoft') || combined.includes('openai') || combined.includes('vercel') || combined.includes('github') || combined.includes('notion') || combined.includes('figma') || combined.includes('adobe')) return 'Software';
  if (combined.includes('arzt') || combined.includes('apotheke') || combined.includes('kranken') || combined.includes('zahnarzt')) return 'Gesundheit';
  if (combined.includes('sparplan') || combined.includes('depot') || combined.includes('trade republic')) return 'Sparen';
  if (combined.includes('strom') || combined.includes('gas') || combined.includes('stadtwerke') || combined.includes('telekom') || combined.includes('vodafone') || combined.includes('o2')) return 'Nebenkosten';

  return 'Sonstiges';
}

// ── Push to Jarvis ───────────────────────────────────────────────────────────

async function pushToJarvis(transactions: SyncResult['transactions'], totalBalance: number | undefined) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('N8N_WEBHOOK_SECRET fehlt in .env');
  }

  if (transactions.length === 0 && totalBalance === undefined) {
    log('ℹ️  Keine neuen Transaktionen und kein Saldo – überspringe Push.');
    return;
  }

  const payload = {
    transactions,
    ...(totalBalance !== undefined && { current_balance: totalBalance }),
  };

  log(`📤 Sende ${transactions.length} Transaktionen an Jarvis...`);

  const response = await fetch(JARVIS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Jarvis Webhook fehlgeschlagen: ${response.status} – ${JSON.stringify(result)}`);
  }

  log(`✅ Jarvis Response: ${result.created} erstellt, ${result.skipped} übersprungen, Balance aktualisiert: ${result.balance_updated}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🤖 Jarvis Bank Sync');
  console.log('═══════════════════\n');

  // Validate env
  const banks: BankConfig[] = [];

  if (process.env.FINTS_BW_USER && process.env.FINTS_BW_PIN) {
    banks.push({
      name: 'bw-bank',
      url: process.env.FINTS_BW_URL || 'https://banking-li4.s-fints-pt-li.de/fints30',
      blz: process.env.FINTS_BW_BLZ || '60050101',
      user: process.env.FINTS_BW_USER,
      pin: process.env.FINTS_BW_PIN,
    });
  }

  if (process.env.FINTS_DKB_USER && process.env.FINTS_DKB_PIN) {
    banks.push({
      name: 'dkb',
      url: process.env.FINTS_DKB_URL || 'https://fints.dkb.de/fints',
      blz: process.env.FINTS_DKB_BLZ || '12030000',
      user: process.env.FINTS_DKB_USER,
      pin: process.env.FINTS_DKB_PIN,
    });
  }

  if (banks.length === 0) {
    console.error('❌ Keine Banking-Credentials in .env gefunden!');
    console.error('   Benötigt: FINTS_BW_USER/PIN und/oder FINTS_DKB_USER/PIN');
    process.exit(1);
  }

  log(`${banks.length} Bank(en) konfiguriert: ${banks.map(b => b.name).join(', ')}`);

  // Sync each bank
  const allTransactions: SyncResult['transactions'] = [];
  let totalBalance = 0;
  let hasBalance = false;

  for (const bank of banks) {
    try {
      const result = await syncBank(bank);
      allTransactions.push(...result.transactions);
      if (result.balance !== undefined) {
        totalBalance += result.balance;
        hasBalance = true;
      }
    } catch (error: any) {
      log(`❌ Fehler bei ${bank.name}: ${error.message}`);
      // Continue with next bank
    }
  }

  log(`\n📊 Gesamt: ${allTransactions.length} Transaktionen, Saldo: ${hasBalance ? totalBalance.toFixed(2) + '€' : 'N/A'}`);

  // Push to Jarvis
  await pushToJarvis(allTransactions, hasBalance ? totalBalance : undefined);

  console.log('\n✨ Sync abgeschlossen!\n');
}

main().catch((err) => {
  console.error('\n💥 Fataler Fehler:', err.message);
  process.exit(1);
});
