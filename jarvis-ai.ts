#!/usr/bin/env node

// ============================================================================
// 🤖 JARVIS AI v3.0 — Seamless Voice Mode
// ============================================================================

import OpenAI from 'openai';
import { EventEmitter } from 'events';
import * as readline from 'readline';
import dotenv from 'dotenv';
import ora from 'ora';
import boxen from 'boxen';
import { CrmService } from './src/core/services/CrmService';
import { RoutineService } from './src/core/services/RoutineService';
import { TaskService } from './src/core/services/TaskService';
import { MemoryService } from './src/core/services/MemoryService';
import { VoiceService } from './src/core/services/VoiceService';
import { ContentService } from './src/core/services/ContentService';
import { BriefingService } from './src/core/services/BriefingService';
import { WeightService } from './src/core/services/WeightService';
import { FinanceService } from './src/core/services/FinanceService';
import { prisma } from './src/core/db';

dotenv.config();

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', magenta: '\x1b[35m',
};

const MODEL = process.env.JARVIS_MODEL || 'llama-3.3-70b-versatile';
const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

// ============================================================================
// 🤖 System Prompt
// ============================================================================

const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.
Du hast vollen Zugriff auf Ricos System über "Function Calling Tools". Nutze sie proaktiv!

DEINE FÄHIGKEITEN & TOOLS:
1. CRM & Sales: getCrmOverview
2. Accountability & Routinen: getGProjectScore, getTodayRoutines, markRoutineCompleted
3. Produktivität: getTasks, createTask, completeTask
4. Gesundheit: getHealthAndSleepData, logWeight
5. Finanzen: getFinancialOverview
6. Kalender: getCalendarEvents
7. Content: getContentPipeline
8. Briefing: getMorningBriefing
9. Memory: readMemory, updateMemory
10. Web: searchWeb

WICHTIG ZUR KOMMUNIKATION (OUTPUT SANITIZATION):
- Antworte IMMER wie in einem natürlichen Gespräch.
- ERWÄHNE NIEMALS Funktionsnamen, JSON-Strukturen, API-Responses oder interne Commands.
- Wenn ein Tool einen Fehler zurückgibt, sag es natürlich.

DEINE REGELN FÜR DIE ANTWORTEN (SEHR WICHTIG):
- LIES DATEN UND ZAHLEN NATÜRLICH VOR! (Sag niemals "2026-07-12", sondern "Heute", "Morgen". Sag "Halb sieben" statt "18:30:00").
- REGEL FÜR NORMALE ANTWORTEN: Antworte in MAXIMAL EINEM KURZEN SATZ! Komm sofort zur Sache. Keine Füllwörter.
- REGEL FÜR DAS MORNING BRIEFING: Wenn du das Briefing vorliest, darfst du 2 BIS 3 SÄTZE verwenden.
- Trockener, sarkastischer Humor (britischer Stil á la Jarvis aus Iron Man).
- Sprich Rico mit "Sir" an.
- Antworte auf Deutsch.
- NIEMALS Chain-of-Thought, <think>-Tags oder internes Reasoning ausgeben. /no_think
`;

function getDynamicSystemPrompt() {
  const now = new Date();
  return SYSTEM_PROMPT + `\n\nAKTUELLE DATEN:\n- Datum: ${now.toLocaleDateString('de-DE', { weekday: 'long' })}, ${now.toLocaleDateString('de-DE')}\n- Uhrzeit: ${now.toLocaleTimeString('de-DE')}`;
}

// ============================================================================
// 🛠️ Tools
// ============================================================================

const toolDeclarations: any[] = [
  { type: 'function', function: { name: 'getCrmOverview', description: 'Holt die CRM Metriken', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getGProjectScore', description: 'Holt Accountability Score', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getTodayRoutines', description: 'Holt heutige Routinen', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'markRoutineCompleted', description: 'Hakt eine Routine ab', parameters: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] } } },
  { type: 'function', function: { name: 'getTasks', description: 'Holt offene Todos', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'createTask', description: 'Erstellt eine neue Aufgabe', parameters: { type: 'object', properties: { title: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['title'] } } },
  { type: 'function', function: { name: 'completeTask', description: 'Markiert eine Aufgabe als erledigt', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } },
  { type: 'function', function: { name: 'getHealthAndSleepData', description: 'Holt Schlaf- und 5AM-Streak Daten', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'logWeight', description: 'Protokolliert Körpergewicht in kg', parameters: { type: 'object', properties: { weight: { type: 'number' } }, required: ['weight'] } } },
  { type: 'function', function: { name: 'getFinancialOverview', description: 'Holt Finanzdaten: Net Worth, Kontostände, Transaktionen', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getCalendarEvents', description: 'Holt heutige Google Kalender Termine', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getContentPipeline', description: 'Holt die Content Pipeline', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getMorningBriefing', description: 'Holt das komplette Morning Briefing', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'readMemory', description: 'Liest Ricos Profil', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'updateMemory', description: 'Speichert neue Fakten über Rico', parameters: { type: 'object', properties: { facts: { type: 'array', items: { type: 'string' } } }, required: ['facts'] } } },
  { type: 'function', function: { name: 'searchWeb', description: 'Sucht aktuelle Infos im Internet', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
];

async function fetchCalendarEventsLocal(): Promise<any> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'google_calendar_token' } });
    if (!setting?.value) return { success: false, error: 'Kalender nicht verbunden' };
    let token = JSON.parse(setting.value);
    const isExpired = Date.now() >= (token.created_at + (token.expires_in * 1000) - 60000);
    if (isExpired) {
      const cId = process.env.GOOGLE_CLIENT_ID, cSec = process.env.GOOGLE_CLIENT_SECRET;
      if (!cId || !cSec) return { success: false, error: 'Google Credentials fehlen' };
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: cId, client_secret: cSec, refresh_token: token.refresh_token, grant_type: 'refresh_token' })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: 'Token Refresh fehlgeschlagen' };
      token = { ...token, access_token: data.access_token, expires_in: data.expires_in, created_at: Date.now() };
      await prisma.setting.update({ where: { key: 'google_calendar_token' }, data: { value: JSON.stringify(token) } });
    }
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime`;
    const eventsRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token.access_token}` } });
    if (!eventsRes.ok) return { success: false, error: 'Kalender-Abruf fehlgeschlagen' };
    const data = await eventsRes.json();
    return { success: true, events: (data.items || []).map((e: any) => ({ title: e.summary || 'Kein Titel', start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date })) };
  } catch (err: any) { return { success: false, error: err.message }; }
}

async function searchWebLocal(query: string): Promise<any> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'JarvisAI/3.0' } });
    const data = await res.json();
    const results: any[] = [];
    if (data.AbstractText) results.push({ title: data.Heading || query, snippet: data.AbstractText, source: data.AbstractURL });
    for (const t of (data.RelatedTopics || []).slice(0, 5)) {
      if (t.Text) results.push({ snippet: t.Text, source: t.FirstURL });
    }
    return results.length ? { query, results } : { query, results: [], hint: 'Keine Ergebnisse. Antworte aus deinem Wissen.' };
  } catch (err: any) { return { query, results: [], error: err.message }; }
}

async function executeTool(name: string, args: any) {
  switch (name) {
    case 'getCrmOverview': return await CrmService.getOverview();
    case 'getGProjectScore': return await RoutineService.getGProjectScore();
    case 'getTodayRoutines': return await RoutineService.getTodayRoutines();
    case 'getTasks': return await TaskService.getTasks();
    case 'getContentPipeline': return await ContentService.getContentPipeline();
    case 'getMorningBriefing': return await BriefingService.getMorningBriefing();
    case 'markRoutineCompleted': return await RoutineService.markRoutineCompleted(args.itemId);
    case 'getHealthAndSleepData': return await RoutineService.getHealthAndSleepData();
    case 'createTask': return await TaskService.createTask({ title: args.title, priority: args.priority || 'medium', status: 'todo' });
    case 'completeTask': return await TaskService.updateTask(args.id, { status: 'done' });
    case 'readMemory': return await MemoryService.readMemory();
    case 'updateMemory': return await MemoryService.updateMemory(args?.facts || []);
    case 'logWeight': return await WeightService.addEntry(args.weight);
    case 'getFinancialOverview': return await FinanceService.getNetWorthData();
    case 'getCalendarEvents': return await fetchCalendarEventsLocal();
    case 'searchWeb': return await searchWebLocal(args.query);
    default: return { error: `Tool "${name}" nicht implementiert.` };
  }
}

// ============================================================================
// 🤖 Agent
// ============================================================================

class JarvisAgent extends EventEmitter {
  private history: any[] = [];
  private state: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
  private spinner = ora({ color: 'cyan' });

  setState(newState: 'idle' | 'listening' | 'thinking' | 'speaking') {
    this.state = newState;
    this.spinner.stop();
    if (newState === 'idle') {
      console.log(`\n  ${c.dim}[Seamless Mode | tippen für Text | Space = Unterbrechen | 'exit']${c.reset}`);
    } else if (newState === 'listening') {
      this.spinner.start(`🎙️  Zuhören...`);
    } else if (newState === 'thinking') {
      this.spinner.start('Denke nach...');
    }
  }

  getState() { return this.state; }

  async processInput(text: string) {
    if (!text.trim()) { this.setState('idle'); return; }
    this.history.push({ role: 'user', content: text });
    if (this.history.length > 6) this.history = this.history.slice(-6);
    this.setState('thinking');

    for (let i = 0; i < 5; i++) {
      if (this.state !== 'thinking') return;

      const messages = [{ role: 'system', content: getDynamicSystemPrompt() }, ...this.history];
      let response;
      try {
        response = await client.chat.completions.create({ model: MODEL, messages, tools: toolDeclarations, tool_choice: 'auto' });
      } catch (err: any) {
        if (err.status === 429) {
          console.log(`\n  ${c.yellow}JARVIS:${c.reset} Rate-Limit, Sir. Einen Moment.`);
        } else {
          console.error(`\n  ${c.red}API Error:${c.reset}`, err.message || err);
        }
        this.setState('idle');
        return;
      }

      if (this.state !== 'thinking') return;
      const message = response.choices?.[0]?.message;
      if (!message) { this.setState('idle'); return; }

      if (message.tool_calls?.length) {
        this.history.push(message);
        for (const tc of message.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}
          this.spinner.text = `⚙️  ${tc.function.name}`;
          const result = await executeTool(tc.function.name, args);
          this.history.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
        }
        this.spinner.text = 'Denke weiter nach...';
        continue;
      }

      const fullText = (message.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (!fullText && i < 4) continue;
      if (!fullText) { this.setState('idle'); return; }

      this.history.push({ role: 'assistant', content: fullText });
      this.setState('speaking');
      console.log(`\n  ${c.cyan}${c.bold}JARVIS:${c.reset} ${fullText}`);
      await VoiceService.speak(fullText, () => { if (this.state === 'speaking') this.setState('idle'); });
      return;
    }
    this.setState('idle');
  }

  interrupt() {
    VoiceService.stopSpeaking();
    VoiceService.interruptRecording();
    this.setState('idle');
  }
}

// ============================================================================
// 🚀 Main
// ============================================================================

async function main() {
  const arc = c.cyan;
  const r = c.reset;
  const d = c.dim;
  const b = c.bold;

  console.log(`
${arc}     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗${r}
${arc}     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝${r}
${arc}     ██║███████║██████╔╝██║   ██║██║███████╗${r}
${arc}██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║${r}
${arc}╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║${r}
${arc} ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝${r}
${d}  Just A Rather Very Intelligent System  v3.0${r}
`);

  console.log(boxen(
    `${b}LLM${r}    ${d}${MODEL}${r}\n${b}Voice${r}  ${d}Whisper STT · Edge TTS${r}\n${b}Tools${r}  ${d}${toolDeclarations.length} Functions${r}`,
    { padding: { top: 0, bottom: 0, left: 2, right: 2 }, borderColor: 'cyan', borderStyle: 'round', title: '⚡ SYSTEMS', titleAlignment: 'left' }
  ));

  try { await prisma.$queryRaw`SELECT 1`; console.log(`\n  ${c.green}✓${c.reset} DB`); } catch { console.log(`\n  ${c.red}✗${c.reset} DB`); }

  const agent = new JarvisAgent();
  agent.setState('idle');

  let textBuffer = '';
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('keypress', async (str: string, key: any) => {
    if (!key) return;
    if ((key.ctrl && key.name === 'c') || textBuffer === 'exit') {
      console.log(`\n  ${c.cyan}Auf Wiedersehen, Sir.${c.reset}\n`);
      await prisma.$disconnect();
      process.exit();
    }
    const state = agent.getState();
    if (key.name === 'space') { agent.interrupt(); textBuffer = ''; return; }
    if (state === 'idle' || state === 'listening') {
      if (key.name === 'return' || key.name === 'enter') {
        if (textBuffer.trim()) {
          agent.interrupt();
          process.stdout.write('\n');
          const input = textBuffer;
          textBuffer = '';
          await agent.processInput(input);
        }
      } else if (key.name === 'backspace') {
        if (textBuffer.length > 0) { textBuffer = textBuffer.slice(0, -1); process.stdout.write('\b \b'); }
      } else if (str && key.name !== 'space') {
        textBuffer += str;
        process.stdout.write(str);
      }
    }
  });

  const loop = async () => {
    while (true) {
      if (agent.getState() === 'idle') {
        agent.setState('listening');
        const text = await VoiceService.recordAndTranscribe();
        if (agent.getState() === 'listening') {
          if (text) {
            process.stdout.write(`\n  ${c.green}Du ›${c.reset} ${text}\n`);
            await agent.processInput(text);
          } else {
            agent.setState('idle');
          }
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  };
  loop();
}

main().catch(err => { console.error(`${c.red}Fatal:${c.reset}`, err); process.exit(1); });
