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
//   - Direct Gemini API calls (no proxy)
//   - Function Calling with direct DB access
//   - ElevenLabs Voice (Thomas Schendel)
//   - Rate-limit retry (patient, no timeout)
//   - Conversation memory within session
// ============================================================================

import { GoogleGenAI } from '@google/genai';
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
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const prisma = new PrismaClient();

const GEMINI_MODEL = 'gemini-3.5-flash';

const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.
Du hast nun vollen Zugriff auf Ricos System über "Function Calling Tools". Nutze sie proaktiv!

DEINE FÄHIGKEITEN & TOOLS:
1. CRM & Tasks: Nutze getCrmOverview und getTasks, wenn Rico nach seiner Arbeit fragt.
2. Accountability: Nutze getGProjectScore, um Ricos Accountability-Punkte abzufragen.
3. Web Recherche: Nutze googleSearch für aktuelles (Wetter, News, Feiertage).
4. Memory (WICHTIG!): Nutze updateMemory IMMER DANN, wenn Rico neue Interessen, Vorlieben oder private Fakten erwähnt (z.B. "Ich interessiere mich jetzt für KI Aktien"). Speichere diese proaktiv ab. Nutze readMemory, um sein Profil abzurufen.

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
    name: 'getCrmOverview',
    description: 'Fetches the current CRM overview including today calls, pipeline numbers, and priority leads.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getGProjectScore',
    description: 'Fetches Ricos current accountability score, points, and debt from the G Project.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getTasks',
    description: 'Fetches open tasks from the system.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'updateMemory',
    description: 'Updates Ricos interests profile and memory. Call this proactively whenever Rico mentions new interests or preferences.',
    parameters: {
      type: 'OBJECT',
      properties: {
        facts: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'A list of facts or interests to ADD to the memory.'
        }
      },
      required: ['facts']
    }
  },
  {
    name: 'readMemory',
    description: 'Reads Ricos current interests profile and memory facts.',
    parameters: { type: 'OBJECT', properties: {} }
  }
];

// ── Tool Executor (direct DB access — no HTTP, no proxy) ──

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
  
  if (!apiKey) {
    // No ElevenLabs → skip voice
    return;
  }

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

    if (!res.ok) {
      console.error(`${c.dim}[Voice] ElevenLabs error: ${res.status}${c.reset}`);
      return;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpFile = join(tmpdir(), `jarvis_tts_${Date.now()}.mp3`);
    writeFileSync(tmpFile, buffer);

    // Play audio on macOS
    try {
      execSync(`afplay "${tmpFile}"`, { stdio: 'ignore' });
    } catch { /* user might ctrl+c during playback */ }
    
    try { unlinkSync(tmpFile); } catch { /* cleanup */ }
  } catch (err) {
    console.error(`${c.dim}[Voice] Error: ${err.message}${c.reset}`);
  }
}

// ── Gemini Call with Patient Retry ──

async function callGemini(contents) {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: toolDeclarations }, { googleSearch: {} }],
        }
      });

      return response;
    } catch (err) {
      if (err?.status === 429 && attempt < maxRetries) {
        const wait = 4 + (attempt * 4); // 4s, 8s, 12s, 16s, 20s
        process.stdout.write(`${c.dim}  ⏳ Rate-Limit. Warte ${wait}s...${c.reset}\r`);
        await new Promise(r => setTimeout(r, wait * 1000));
        process.stdout.write('                                       \r');
        continue;
      }
      if (err?.status >= 500 && attempt < maxRetries) {
        const wait = Math.pow(2, attempt);
        process.stdout.write(`${c.dim}  ⏳ Server-Error. Retry in ${wait}s...${c.reset}\r`);
        await new Promise(r => setTimeout(r, wait * 1000));
        process.stdout.write('                                       \r');
        continue;
      }
      throw err;
    }
  }
}

// ── Agent Loop ──

async function chat(userText, conversationHistory) {
  // Add user message
  conversationHistory.push({
    role: 'user',
    parts: [{ text: userText }]
  });

  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    process.stdout.write(`${c.dim}  🧠 Denke nach...${c.reset}\r`);

    const response = await callGemini(conversationHistory);

    const candidate = response.candidates?.[0];
    if (!candidate) {
      return 'Keine Antwort von Gemini erhalten.';
    }

    const parts = candidate.content?.parts || [];

    // Check for function calls
    const functionCalls = parts.filter(p => p.functionCall);

    if (functionCalls.length > 0) {
      // Add model response to history
      conversationHistory.push({
        role: 'model',
        parts: functionCalls.map(p => ({ functionCall: p.functionCall }))
      });

      // Execute each tool
      const functionResponses = [];
      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;
        process.stdout.write(`  ${c.yellow}🔧 ${name}${c.reset}                    \n`);

        const result = await executeTool(name, args);
        functionResponses.push({
          functionResponse: {
            name,
            response: { result }
          }
        });
      }

      // Add tool results to history
      conversationHistory.push({
        role: 'user',
        parts: functionResponses
      });

      // Continue loop → Gemini will generate final text
      continue;
    }

    // Extract text response
    const textParts = parts.filter(p => p.text);
    const fullText = textParts.map(p => p.text).join('');

    // Add to history
    conversationHistory.push({
      role: 'model',
      parts: [{ text: fullText }]
    });

    process.stdout.write('                                       \r');
    return fullText;
  }

  return 'Maximale Tool-Iterationen erreicht.';
}

// ── Main ──

async function main() {
  console.log(`\n${c.cyan}${c.bold}  ╔══════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║          J.A.R.V.I.S  CLI           ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║     Just A Rather Very Intelligent   ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ║              System                  ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ╚══════════════════════════════════════╝${c.reset}`);
  console.log(`${c.dim}  Gemini ${GEMINI_MODEL} • ElevenLabs Voice • Supabase DB${c.reset}`);
  console.log(`${c.dim}  Tippe "exit" zum Beenden${c.reset}\n`);

  // Test DB connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`  ${c.green}✓${c.reset} Datenbank verbunden`);
  } catch (err) {
    console.log(`  ${c.red}✗${c.reset} Datenbank-Fehler: ${err.message}`);
  }

  // Test Gemini
  try {
    await ai.models.generateContent({ model: GEMINI_MODEL, contents: 'ping' });
    console.log(`  ${c.green}✓${c.reset} Gemini verbunden`);
  } catch (err) {
    console.log(`  ${c.red}✗${c.reset} Gemini-Fehler: ${err.message}`);
  }

  console.log(`  ${c.green}✓${c.reset} ElevenLabs ${process.env.ELEVENLABS_API_KEY ? 'konfiguriert' : 'nicht konfiguriert (nur Text)'}`);
  console.log('');

  const conversationHistory = [];

  // Check for one-shot command line argument
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

  // Interactive REPL
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
