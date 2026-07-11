#!/usr/bin/env node

// ============================================================================
// 🤖 JARVIS CLI — Local Terminal Assistant
// ============================================================================
// Runs directly on your Mac. No Vercel, no timeouts, no bullshit.
//
// Usage:  node jarvis-cli.mjs
//         node jarvis-cli.mjs "Wie sieht mein CRM aus?"
//
// Features:
//   - Groq API
//   - Function Calling with direct DB access
//   - ElevenLabs Voice (Thomas Schendel)
//   - Rate-limit retry (patient, no timeout)
//   - Conversation memory within session
// ============================================================================

import Groq from 'groq-sdk';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import dotenv from 'dotenv';

// Load .env from project root
dotenv.config();

// ── Colors for terminal output ──
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

// ── Init ──
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const prisma = new PrismaClient();

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.
Du hast nun vollen Zugriff auf Ricos System über "Function Calling Tools". Nutze sie proaktiv!

DEINE FÄHIGKEITEN & TOOLS:
1. CRM & Tasks: Nutze getCrmOverview und getTasks, wenn Rico nach seiner Arbeit fragt.
2. Accountability: Nutze getGProjectScore, um Ricos Accountability-Punkte abzufragen.
3. Memory (WICHTIG!): Nutze updateMemory IMMER DANN, wenn Rico neue Interessen, Vorlieben oder private Fakten erwähnt. Speichere diese proaktiv ab. Nutze readMemory, um sein Profil abzurufen.

PERSÖNLICHKEIT:
- Du sprichst Rico mit "Sir" an.
- Höflich, präzise, effizient — nie unnötig ausschweifend.
- Trockener, subtiler Humor (britischer Stil).
- Antworte auf Deutsch, außer Rico spricht dich auf Englisch an.
- Vermeide Floskeln, Entschuldigungen oder Erklärungen. Max 2-3 Sätze pro Antwort.
`;

// ── Tool Definitions ──
const toolDeclarations = [
  {
    type: 'function',
    function: {
      name: 'getCrmOverview',
      description: 'Fetches the current CRM overview including today calls, pipeline numbers, and priority leads.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getGProjectScore',
      description: 'Fetches Ricos current accountability score, points, and debt from the G Project.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTasks',
      description: 'Fetches open tasks from the system.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateMemory',
      description: 'Updates Ricos interests profile and memory.',
      parameters: {
        type: 'object',
        properties: {
          facts: {
            type: 'array',
            items: { type: 'string' },
            description: 'A list of facts or interests to ADD to the memory.'
          }
        },
        required: ['facts']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readMemory',
      description: 'Reads Ricos current interests profile and memory facts.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

// ── Tool Executor (direct DB access) ──

async function executeTool(name, args) {
  switch (name) {
    case 'getCrmOverview': {
      try {
        const nowMs = Date.now();
        const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
        const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

        const totalLeadsRow = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_leads`;
        const calledTodayRow = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='call' AND created_at_ms >= ${dayAgoMs}`;
        const calledWeekRow = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM crm_events WHERE type='call' AND created_at_ms >= ${weekAgoMs}`;
        const pipelineRow = await prisma.$queryRaw`
          SELECT 
            COUNT(CASE WHEN entscheider = 1 THEN 1 END)::int as entscheider,
            COUNT(CASE WHEN termin = 1 THEN 1 END)::int as kontakt,
            COUNT(CASE WHEN rechnung = 1 THEN 1 END)::int as rechnung,
            COUNT(CASE WHEN status = 'Kunde' THEN 1 END)::int as kunden
          FROM crm_leads WHERE status != 'Uninteressant'
        `;
        const prioRow = await prisma.$queryRaw`SELECT COUNT(CASE WHEN starred = 1 THEN 1 END)::int as count FROM crm_leads WHERE status != 'Uninteressant'`;

        return {
          totalLeads: Number(totalLeadsRow[0]?.count || 0),
          todayCalls: Number(calledTodayRow[0]?.count || 0),
          weeklyCalls: Number(calledWeekRow[0]?.count || 0),
          pipeline: {
            entscheider: Number(pipelineRow[0]?.entscheider || 0),
            kontakt: Number(pipelineRow[0]?.kontakt || 0),
            rechnung: Number(pipelineRow[0]?.rechnung || 0),
            kunden: Number(pipelineRow[0]?.kunden || 0),
          },
          prioLeads: Number(prioRow[0]?.count || 0),
        };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'getGProjectScore': {
      const stats = await prisma.tracker_user_stats.findMany();
      return {
        stats: stats.map(s => ({
          name: s.name || s.user_id,
          points: s.my_points,
          debt: s.my_debt,
          unpaid_weekly_debt: s.unpaid_weekly_debt,
        }))
      };
    }

    case 'getTasks': {
      const tasks = await prisma.task.findMany({
        where: { status: 'todo' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { project: true }
      });
      return { tasks: tasks.map(t => ({ title: t.title, priority: t.priority, project: t.project?.name || '', dueDate: t.dueDate })) };
    }

    case 'readMemory': {
      const profile = await prisma.knowledgeItem.findFirst({
        where: { type: 'profile', title: 'Jarvis Memory' }
      });
      if (!profile) return { facts: [] };
      try { return { facts: JSON.parse(profile.content) }; }
      catch { return { facts: [profile.content] }; }
    }

    case 'updateMemory': {
      const { facts } = args || {};
      if (!facts || facts.length === 0) return { success: true, message: 'No new facts.' };

      let profile = await prisma.knowledgeItem.findFirst({
        where: { type: 'profile', title: 'Jarvis Memory' }
      });

      let currentFacts = [];
      if (profile) {
        try { currentFacts = JSON.parse(profile.content); } catch { currentFacts = [profile.content]; }
      }

      const newFacts = [...new Set([...currentFacts, ...facts])];

      if (profile) {
        await prisma.knowledgeItem.update({ where: { id: profile.id }, data: { content: JSON.stringify(newFacts) } });
      } else {
        await prisma.knowledgeItem.create({ data: { title: 'Jarvis Memory', type: 'profile', content: JSON.stringify(newFacts) } });
      }

      return { success: true, currentFacts: newFacts };
    }

    default:
      return { error: `Tool "${name}" not implemented.` };
  }
}

// ── ElevenLabs Voice ──

async function speak(text) {
  if (!text?.trim()) return;
  
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || 'pNInz6obpgDQGcFmaJgB';
  
  if (!apiKey) { return; }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.4, similarity_boost: 0.82, style: 0.15, use_speaker_boost: false }
      }),
    });

    if (!res.ok) { return; }

    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpFile = join(tmpdir(), `jarvis_tts_${Date.now()}.mp3`);
    writeFileSync(tmpFile, buffer);

    try { execSync(`afplay "${tmpFile}"`, { stdio: 'ignore' }); } catch {}
    try { unlinkSync(tmpFile); } catch {}
  } catch (err) {}
}

// ── Agent Loop ──

async function chat(userText, conversationHistory) {
  conversationHistory.push({ role: 'user', content: userText });
  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    process.stdout.write(`${c.dim}  🧠 Denke nach...${c.reset}\r`);

    const finalMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...conversationHistory];

    let response;
    try {
      response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: finalMessages,
        tools: toolDeclarations,
        tool_choice: 'auto'
      });
    } catch (err) {
      throw err;
    }

    const message = response.choices?.[0]?.message;
    if (!message) return 'Keine Antwort erhalten.';

    if (message.tool_calls && message.tool_calls.length > 0) {
      conversationHistory.push(message);

      for (const tc of message.tool_calls) {
        const name = tc.function.name;
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch (e) {}

        process.stdout.write(`  ${c.yellow}🔧 ${name}${c.reset}                    \n`);
        const result = await executeTool(name, args);
        
        conversationHistory.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: name,
          content: JSON.stringify(result)
        });
      }
      continue;
    }

    const fullText = message.content || '';
    conversationHistory.push({ role: 'assistant', content: fullText });
    process.stdout.write('                                       \r');
    return fullText;
  }
  return 'Maximale Iterationen erreicht.';
}

// ── Main ──

async function main() {
  console.log(`\n${c.cyan}${c.bold}  ╔══════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║          J.A.R.V.I.S  CLI           ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║     Just A Rather Very Intelligent   ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║              System                  ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ╚══════════════════════════════════════╝${c.reset}`);
  console.log(`  ${c.dim}  Groq ${GROQ_MODEL} • ElevenLabs Voice • Supabase DB${c.reset}`);
  console.log(`  ${c.dim}  Tippe "exit" zum Beenden${c.reset}\n`);

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`  ${c.green}✓${c.reset} Datenbank verbunden`);
  } catch (err) {
    console.log(`  ${c.red}✗${c.reset} Datenbank-Fehler`);
  }

  try {
    await groq.chat.completions.create({ model: GROQ_MODEL, messages: [{role: 'user', content: 'ping'}] });
    console.log(`  ${c.green}✓${c.reset} Groq verbunden`);
  } catch (err) {
    console.log(`  ${c.red}✗${c.reset} Groq-Fehler: ${err.message}`);
  }

  console.log(`  ${c.green}✓${c.reset} ElevenLabs ${process.env.ELEVENLABS_API_KEY ? 'konfiguriert' : 'nicht konfiguriert'}\n`);

  const conversationHistory = [];
  const oneShot = process.argv.slice(2).join(' ').trim();
  
  if (oneShot) {
    try {
      const reply = await chat(oneShot, conversationHistory);
      console.log(`  ${c.cyan}${c.bold}JARVIS:${c.reset} ${reply}\n`);
      await speak(reply);
    } catch (err) {
      console.error(`  ${c.red}Error:${c.reset} ${err.message}`);
    }
    await prisma.$disconnect();
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  ${c.green}${c.bold}Rico ›${c.reset} `,
  });

  rl.prompt();
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(`\n  ${c.cyan}Auf Wiedersehen, Sir.${c.reset}\n`);
      await prisma.$disconnect();
      process.exit(0);
    }

    try {
      const reply = await chat(input, conversationHistory);
      console.log(`\n  ${c.cyan}${c.bold}JARVIS:${c.reset} ${reply}\n`);
      await speak(reply);
    } catch (err) {
      console.error(`\n  ${c.red}Error:${c.reset} ${err.message}\n`);
    }
    rl.prompt();
  });

  rl.on('close', async () => {
    console.log(`\n  ${c.cyan}Auf Wiedersehen, Sir.${c.reset}\n`);
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(err => {
  console.error(`${c.red}Fatal:${c.reset}`, err);
  process.exit(1);
});
