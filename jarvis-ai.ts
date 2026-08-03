#!/usr/bin/env node

// ============================================================================
// 🤖 JARVIS AI v3.0 — Local Intelligence Mode
// ============================================================================
// Ollama (lokal) als Primär-Provider, Groq Cloud als Fallback.
// OpenAI-kompatibler Client für beide Provider.
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

// ============================================================================
// 🎨 Terminal Colors & Styling
// ============================================================================

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgBlue: '\x1b[44m',
};

// ============================================================================
// 🧠 LLM Provider System (Local + Cloud Fallback)
// ============================================================================

const LLM_PROVIDER = process.env.JARVIS_LLM_PROVIDER || 'local';

interface LLMProvider {
  client: OpenAI;
  model: string;
  label: string;
  icon: string;
}

const PROVIDERS: Record<string, LLMProvider> = {
  local: {
    client: new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' }),
    model: process.env.JARVIS_LOCAL_MODEL || 'qwen3:4b',
    label: 'Ollama (lokal)',
    icon: '🏠',
  },
  groq: {
    client: new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY || 'missing' }),
    model: process.env.JARVIS_GROQ_MODEL || 'llama-3.1-8b-instant',
    label: 'Groq (Cloud)',
    icon: '☁️',
  }
};

function getProvider(): LLMProvider {
  return PROVIDERS[LLM_PROVIDER] || PROVIDERS.local;
}

function getFallbackProvider(): LLMProvider | null {
  if (LLM_PROVIDER === 'local' && process.env.GROQ_API_KEY) return PROVIDERS.groq;
  if (LLM_PROVIDER === 'groq') return PROVIDERS.local;
  return null;
}

// ============================================================================
// 🤖 System Prompt
// ============================================================================

const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.
Du hast vollen Zugriff auf Ricos System über "Function Calling Tools". Nutze sie proaktiv!

DEINE FÄHIGKEITEN & TOOLS:
1. CRM & Sales: Nutze getCrmOverview für Vertriebsmetriken.
2. Accountability & Routinen: Nutze getGProjectScore und getTodayRoutines.
3. Produktivität: getTasks, createTask, completeTask für Aufgaben.
4. Gesundheit: getHealthAndSleepData für Schlaf/Streak, logWeight für Gewicht.
5. Finanzen: getFinancialOverview für Kontostände und Net Worth.
6. Kalender: getCalendarEvents für heutige Termine.
7. Content: getContentPipeline für Video/Newsletter Pipeline.
8. Briefing: getMorningBriefing für die Tagesübersicht.
9. Memory: readMemory und updateMemory für Ricos Profil.
10. Web: searchWeb für aktuelle Informationen aus dem Internet.

WICHTIG ZUR KOMMUNIKATION (OUTPUT SANITIZATION):
- Antworte IMMER wie in einem natürlichen Gespräch.
- ERWÄHNE NIEMALS Funktionsnamen, JSON-Strukturen, API-Responses oder interne Commands.
- Wenn ein Tool einen Fehler zurückgibt, sag es natürlich (z.B. "Der Kalender ist gerade nicht verbunden, Sir.").

DEINE REGELN FÜR DIE ANTWORTEN (SEHR WICHTIG):
- LIES DATEN UND ZAHLEN NATÜRLICH VOR! (Sag niemals "2026-07-12", sondern "Heute", "Morgen". Sag "Halb sieben" statt "18:30:00").
- REGEL FÜR NORMALE ANTWORTEN: Antworte in MAXIMAL EINEM KURZEN SATZ! Komm sofort zur Sache. Keine Füllwörter.
- REGEL FÜR DAS MORNING BRIEFING: Wenn du das Briefing vorliest, darfst du 2 BIS 3 SÄTZE verwenden. Fasse die Dinge logisch zusammen, anstatt sie krampfhaft in einen Satz zu quetschen.
- Trockener, sarkastischer Humor (britischer Stil á la Jarvis aus Iron Man).
- Sprich Rico mit "Sir" an.
- Antworte auf Deutsch.
- Gib KEINE Chain-of-Thought, <think>-Tags oder interne Reasoning-Blöcke aus. Nur die finale Antwort.
`;

function getDynamicSystemPrompt() {
  const now = new Date();
  return SYSTEM_PROMPT + `\n\nAKTUELLE DATEN:\n- Datum: ${now.toLocaleDateString('de-DE', { weekday: 'long' })}, ${now.toLocaleDateString('de-DE')}\n- Uhrzeit: ${now.toLocaleTimeString('de-DE')}`;
}

// ============================================================================
// 🛠️ Tool Declarations (OpenAI Function Calling Format)
// ============================================================================

const toolDeclarations: any[] = [
  // --- CRM & Sales ---
  { type: 'function', function: { name: 'getCrmOverview', description: 'Holt die CRM Metriken (Leads, Calls, Pipeline)', parameters: { type: 'object', properties: {} } } },
  // --- Accountability ---
  { type: 'function', function: { name: 'getGProjectScore', description: 'Holt den Accountability Score (G Project)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getTodayRoutines', description: 'Holt heutige Routinen mit Fortschritt', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'markRoutineCompleted', description: 'Hakt eine Routine als erledigt ab', parameters: { type: 'object', properties: { itemId: { type: 'string', description: 'Die ID der Routine' } }, required: ['itemId'] } } },
  // --- Produktivität ---
  { type: 'function', function: { name: 'getTasks', description: 'Holt offene Aufgaben/Todos', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'createTask', description: 'Erstellt eine neue Aufgabe', parameters: { type: 'object', properties: { title: { type: 'string', description: 'Titel der Aufgabe' }, priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priorität' } }, required: ['title'] } } },
  { type: 'function', function: { name: 'completeTask', description: 'Markiert eine Aufgabe als erledigt', parameters: { type: 'object', properties: { id: { type: 'string', description: 'ID der Aufgabe' } }, required: ['id'] } } },
  // --- Gesundheit ---
  { type: 'function', function: { name: 'getHealthAndSleepData', description: 'Holt Schlaf- und 5AM-Streak Daten', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'logWeight', description: 'Protokolliert das aktuelle Körpergewicht in kg', parameters: { type: 'object', properties: { weight: { type: 'number', description: 'Gewicht in Kilogramm (z.B. 82.5)' } }, required: ['weight'] } } },
  // --- Finanzen ---
  { type: 'function', function: { name: 'getFinancialOverview', description: 'Holt Finanzdaten: Net Worth, Kontostände, ausstehende Transaktionen', parameters: { type: 'object', properties: {} } } },
  // --- Kalender ---
  { type: 'function', function: { name: 'getCalendarEvents', description: 'Holt die heutigen Termine aus dem Google Kalender', parameters: { type: 'object', properties: {} } } },
  // --- Content ---
  { type: 'function', function: { name: 'getContentPipeline', description: 'Holt die Content Pipeline (Videos, Newsletter etc.)', parameters: { type: 'object', properties: {} } } },
  // --- Briefing ---
  { type: 'function', function: { name: 'getMorningBriefing', description: 'Holt das komplette Morning Briefing (Wetter, Schlaf, Tasks, Routinen, CRM)', parameters: { type: 'object', properties: {} } } },
  // --- Memory ---
  { type: 'function', function: { name: 'readMemory', description: 'Liest Ricos persönliches Profil und gespeicherte Fakten', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: {
      name: 'updateMemory',
      description: 'Speichert neue Vorlieben, Fakten oder Infos über Rico',
      parameters: { type: 'object', properties: { facts: { type: 'array', items: { type: 'string' }, description: 'Liste neuer Fakten' } }, required: ['facts'] }
  }},
  // --- Web Search ---
  { type: 'function', function: {
      name: 'searchWeb',
      description: 'Sucht aktuelle Informationen im Internet (z.B. Nachrichten, Wetter, Fakten)',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Der Suchbegriff' } }, required: ['query'] }
  }},
];

// ============================================================================
// ⚡ Tool Execution
// ============================================================================

async function fetchCalendarEventsLocal(): Promise<any> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'google_calendar_token' } });
    if (!setting?.value) return { success: false, error: 'Kalender nicht verbunden' };

    let token = JSON.parse(setting.value);

    // Token Refresh
    const isExpired = Date.now() >= (token.created_at + (token.expires_in * 1000) - 60000);
    if (isExpired) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return { success: false, error: 'Google Credentials fehlen' };

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refresh_token, grant_type: 'refresh_token' })
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
    const events = (data.items || []).map((e: any) => ({
      title: e.summary || 'Kein Titel',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      location: e.location || null,
    }));
    return { success: true, events };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function searchWebLocal(query: string): Promise<any> {
  try {
    // DuckDuckGo Instant Answer API (kostenlos, kein Key)
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'JarvisAI/3.0' } });
    const data = await res.json();

    const results: any[] = [];

    if (data.AbstractText) {
      results.push({ title: data.Heading || query, snippet: data.AbstractText, source: data.AbstractURL || '' });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) {
          results.push({ title: topic.Text.slice(0, 80), snippet: topic.Text, source: topic.FirstURL || '' });
        }
      }
    }

    if (results.length === 0) {
      return { query, results: [], hint: 'Keine direkten Ergebnisse. Antworte basierend auf deinem Wissen und erwähne, dass du keine aktuellen Quellen gefunden hast.' };
    }
    return { query, results };
  } catch (err: any) {
    return { query, results: [], error: err.message };
  }
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
// 🧹 Response Sanitization (strip <think> tags from reasoning models)
// ============================================================================

function sanitizeResponse(text: string): string {
  // Strip Qwen3/DeepSeek <think>...</think> reasoning blocks
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// ============================================================================
// 🤖 Jarvis Agent Core
// ============================================================================

class JarvisAgent extends EventEmitter {
  private history: any[] = [];
  private state: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
  private spinner = ora({ color: 'cyan' });
  private activeProvider: LLMProvider = getProvider();

  setState(newState: 'idle' | 'listening' | 'thinking' | 'speaking') {
    this.state = newState;
    this.spinner.stop();

    if (newState === 'idle') {
      console.log(`\n  ${c.dim}[Seamless Mode aktiv | tippen für Text | Space zum Unterbrechen | 'exit']${c.reset}`);
    } else if (newState === 'listening') {
      this.spinner.start(`🎙️  Zuhören... (Sprich jetzt)`);
    } else if (newState === 'thinking') {
      this.spinner.start(`${this.activeProvider.icon} Denke nach... (${this.activeProvider.label})`);
    }
  }

  getState() { return this.state; }

  async processInput(text: string) {
    if (!text.trim()) { this.setState('idle'); return; }

    this.history.push({ role: 'user', content: text });

    // History Truncation: Behalte nur die letzten 6 Nachrichten (3 Interaktionen), um massiv Tokens zu sparen!
    if (this.history.length > 6) {
      this.history = this.history.slice(this.history.length - 6);
    }

    this.activeProvider = getProvider();
    this.setState('thinking');

    const maxIterations = 5; // Mehr Iterationen für Tool-Chains
    for (let i = 0; i < maxIterations; i++) {
      if (this.state !== 'thinking') return; // Aborted by user interrupt

      const finalMessages = [{ role: 'system', content: getDynamicSystemPrompt() }, ...this.history];
      let response;
      try {
        response = await this.activeProvider.client.chat.completions.create({
          model: this.activeProvider.model,
          messages: finalMessages,
          tools: toolDeclarations,
          tool_choice: 'auto'
        });
      } catch (err: any) {
        // Auto-Failover: Wenn der primäre Provider nicht erreichbar ist, Fallback versuchen
        const fallback = getFallbackProvider();
        if (fallback && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'FETCH_ERROR' || err.status === 429)) {
          console.log(`\n  ${c.yellow}⚡ ${this.activeProvider.label} nicht verfügbar, wechsle zu ${fallback.label}...${c.reset}`);
          this.activeProvider = fallback;
          this.spinner.text = `${fallback.icon} Denke nach... (${fallback.label})`;
          try {
            response = await fallback.client.chat.completions.create({
              model: fallback.model,
              messages: finalMessages,
              tools: toolDeclarations,
              tool_choice: 'auto'
            });
          } catch (fallbackErr: any) {
            console.error(`\n  ${c.red}Beide Provider fehlgeschlagen.${c.reset}`, fallbackErr.message || fallbackErr);
            this.setState('idle');
            return;
          }
        } else if (err.status === 429) {
          console.log(`\n  ${c.red}JARVIS:${c.reset} Entschuldigung Sir, mein Token-Limit ist aufgebraucht.`);
          VoiceService.speak("Entschuldigung Sir, mein Token Limit ist aufgebraucht.");
          this.setState('idle');
          return;
        } else {
          console.error(`\n  ${c.red}API Error:${c.reset}`, err.message || err);
          this.setState('idle');
          return;
        }
      }

      if (this.state !== 'thinking') return; // Interrupted

      const message = response.choices?.[0]?.message;
      if (!message) {
        this.setState('idle');
        return;
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        this.history.push(message);
        for (const tc of message.tool_calls) {
          const name = tc.function.name;
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments); } catch (e) {}
          this.spinner.text = `⚙️  ${name}`;
          const result = await executeTool(name, args);
          this.history.push({ role: 'tool', tool_call_id: tc.id, name, content: JSON.stringify(result) });
        }
        this.spinner.text = `${this.activeProvider.icon} Denke weiter nach...`;
        continue;
      }

      let fullText = message.content || '';
      // Sanitize: Strip <think> tags from reasoning models (Qwen3, DeepSeek)
      fullText = sanitizeResponse(fullText);

      if (!fullText.trim()) {
        // Leere Antwort nach Tool-Call → nochmal versuchen
        if (i < maxIterations - 1) continue;
        this.setState('idle');
        return;
      }

      this.history.push({ role: 'assistant', content: fullText });

      this.setState('speaking');
      console.log(`\n  ${c.cyan}${c.bold}JARVIS:${c.reset} ${fullText}`);

      await VoiceService.speak(fullText, () => {
        if (this.state === 'speaking') {
          this.setState('idle');
        }
      });
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
// 🖥️ Startup: Iron Man Terminal UI
// ============================================================================

function printStartupBanner(provider: LLMProvider) {
  const arc = c.cyan;
  const dim = c.dim;
  const reset = c.reset;
  const bold = c.bold;

  const banner = `
${arc}     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗${reset}
${arc}     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝${reset}
${arc}     ██║███████║██████╔╝██║   ██║██║███████╗${reset}
${arc}██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║${reset}
${arc}╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║${reset}
${arc} ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝${reset}
${dim}  Just A Rather Very Intelligent System  v3.0${reset}
`;

  console.log(banner);

  const statusBox = boxen(
    [
      `${bold}LLM${reset}    ${provider.icon} ${provider.label} ${dim}(${provider.model})${reset}`,
      `${bold}Voice${reset}  🎙️  Whisper STT • Edge TTS`,
      `${bold}Tools${reset}  ⚡ ${toolDeclarations.length} Functions aktiv`,
      `${bold}Mode${reset}   🔄 Auto-Failover ${getFallbackProvider() ? '→ ' + getFallbackProvider()!.label : 'deaktiviert'}`,
    ].join('\n'),
    {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      borderColor: 'cyan',
      borderStyle: 'round',
      title: '⚡ SYSTEMS',
      titleAlignment: 'left',
    }
  );

  console.log(statusBox);
}

// ============================================================================
// 🚀 Main Entry Point
// ============================================================================

async function main() {
  const provider = getProvider();
  printStartupBanner(provider);

  // System Checks
  process.stdout.write(`\n  ${c.dim}System Check...${c.reset}`);

  // DB Check
  try {
    await prisma.$queryRaw`SELECT 1`;
    process.stdout.write(` ${c.green}✓${c.reset} DB`);
  } catch {
    process.stdout.write(` ${c.red}✗${c.reset} DB`);
  }

  // LLM Check
  if (LLM_PROVIDER === 'local') {
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        const models = data.models?.map((m: any) => m.name) || [];
        const hasModel = models.some((m: string) => m.startsWith(provider.model.split(':')[0]));
        process.stdout.write(` ${hasModel ? c.green + '✓' : c.yellow + '⚠'} ${c.reset}Ollama${hasModel ? '' : ` (${provider.model} nicht gefunden — 'ollama pull ${provider.model}')`}`);
      } else {
        process.stdout.write(` ${c.red}✗${c.reset} Ollama`);
      }
    } catch {
      process.stdout.write(` ${c.red}✗${c.reset} Ollama (nicht gestartet)`);
      if (getFallbackProvider()) {
        process.stdout.write(` ${c.yellow}→ Fallback auf ${getFallbackProvider()!.label}${c.reset}`);
      }
    }
  } else {
    process.stdout.write(` ${c.green}✓${c.reset} ${provider.label}`);
  }

  console.log('\n');

  const agent = new JarvisAgent();
  agent.setState('idle');

  // Input Handling
  let textBuffer = '';
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('keypress', async (str: string, key: any) => {
    if (!key) return;

    // CTRL-C or exit
    if ((key.ctrl && key.name === 'c') || textBuffer === 'exit') {
      console.log(`\n  ${c.cyan}Auf Wiedersehen, Sir.${c.reset}\n`);
      await prisma.$disconnect();
      process.exit();
    }

    const state = agent.getState();

    // INTERRUPT JARVIS
    if (key.name === 'space') {
      agent.interrupt();
      textBuffer = '';
      return;
    }

    // TEXT INPUT
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
        if (textBuffer.length > 0) {
          textBuffer = textBuffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (str && key.name !== 'space') { // Ignore spacebar for text buffer to avoid accidental spaces
        textBuffer += str;
        process.stdout.write(str);
      }
    }
  });

  // Seamless Voice Loop
  const loop = async () => {
    while (true) {
      if (agent.getState() === 'idle') {
        agent.setState('listening');
        const text = await VoiceService.recordAndTranscribe();

        // Ensure we haven't been interrupted while transcribing
        if (agent.getState() === 'listening') {
          if (text) {
            process.stdout.write(`\n  ${c.green}Du ›${c.reset} ${text}\n`);
            await agent.processInput(text);
          } else {
            agent.setState('idle'); // Back to idle to trigger next listening cycle
          }
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 200)); // Sleep while thinking/speaking
      }
    }
  };

  loop();
}

main().catch(err => {
  console.error(`${c.red}Fatal:${c.reset}`, err);
  process.exit(1);
});
