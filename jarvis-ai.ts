#!/usr/bin/env node

// ============================================================================
// 🤖 JARVIS AI — Seamless Voice Mode
// ============================================================================

import Groq from 'groq-sdk';
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
import { prisma } from './src/core/db';

dotenv.config();

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

// Fallback auf 8b Modell, da 70b harte Daily Limits (100k Tokens) hat
const GROQ_MODEL = 'llama-3.1-8b-instant';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.
Du hast vollen Zugriff auf Ricos System über "Function Calling Tools". Nutze sie proaktiv!

DEINE FÄHIGKEITEN & TOOLS:
1. CRM & Tasks: Nutze getCrmOverview und getTasks.
2. Accountability & Routinen: Nutze getGProjectScore und getTodayRoutines.
3. Memory: Nutze updateMemory für neue Fakten, readMemory für Ricos Profil.

WICHTIG ZUR KOMMUNIKATION (OUTPUT SANITIZATION):
- Antworte IMMER wie in einem natürlichen Gespräch.
- ERWÄHNE NIEMALS Funktionsnamen, JSON-Strukturen, API-Responses oder interne Commands.

DEINE REGELN FÜR DIE ANTWORTEN (SEHR WICHTIG):
- LIES DATEN UND ZAHLEN NATÜRLICH VOR! (Sag niemals "2026-07-12", sondern "Heute", "Morgen". Sag "Halb sieben" statt "18:30:00").
- REGEL FÜR NORMALE ANTWORTEN: Antworte in MAXIMAL EINEM KURZEN SATZ! Komm sofort zur Sache. Keine Füllwörter.
- REGEL FÜR DAS MORNING BRIEFING: Wenn du das Briefing vorliest, darfst du 2 BIS 3 SÄTZE verwenden. Fasse die Dinge logisch zusammen, anstatt sie krampfhaft in einen Satz zu quetschen.
- Trockener, sarkastischer Humor (britischer Stil á la Jarvis aus Iron Man).
- Sprich Rico mit "Sir" an.
- Antworte auf Deutsch.
`;

function getDynamicSystemPrompt() {
  const now = new Date();
  return SYSTEM_PROMPT + `\n\nAKTUELLE DATEN:\n- Datum: ${now.toLocaleDateString('de-DE', { weekday: 'long' })}, ${now.toLocaleDateString('de-DE')}\n- Uhrzeit: ${now.toLocaleTimeString('de-DE')}`;
}

const toolDeclarations = [
  { type: 'function', function: { name: 'getCrmOverview', description: 'Holt die CRM Metriken', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getGProjectScore', description: 'Holt Accountability Score', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getTasks', description: 'Holt offene Todos', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getContentPipeline', description: 'Holt die Content Pipeline (Videos, Newsletter etc.)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getMorningBriefing', description: 'Holt das komplette Morning Briefing (Wetter, Schlaf, Tasks, Routinen, CRM)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'getTodayRoutines', description: 'Holt heutige Routinen', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'markRoutineCompleted', description: 'Hakt eine Routine ab', parameters: { type: 'object', properties: { itemId: { type: 'string', description: 'Die ID der Routine' } }, required: ['itemId'] } } },
  { type: 'function', function: { name: 'getHealthAndSleepData', description: 'Holt Schlaf- und 5AM-Streak Daten', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'createTask', description: 'Erstellt eine neue Aufgabe', parameters: { type: 'object', properties: { title: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['title'] } } },
  { type: 'function', function: { name: 'completeTask', description: 'Markiert eine Aufgabe als erledigt', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } },
  { type: 'function', function: { name: 'readMemory', description: 'Liest Ricos Profil', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { 
      name: 'updateMemory', 
      description: 'Speichert neue Vorlieben/Fakten', 
      parameters: { type: 'object', properties: { facts: { type: 'array', items: { type: 'string' } } }, required: ['facts'] } 
  }}
];

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
    default: return { error: `Tool "${name}" nicht implementiert.` };
  }
}

class JarvisAgent extends EventEmitter {
  private history: any[] = [];
  private state: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
  private spinner = ora({ color: 'cyan' });

  setState(newState: 'idle' | 'listening' | 'thinking' | 'speaking') {
    this.state = newState;
    this.spinner.stop();

    if (newState === 'idle') {
      console.log(`\n  ${c.dim}[Seamless Mode aktiv | tippen für Text | Space zum Unterbrechen | 'exit']${c.reset}`);
    } else if (newState === 'listening') {
      this.spinner.start(`🎙️  Zuhören... (Sprich jetzt)`);
    } else if (newState === 'thinking') {
      this.spinner.start('Denke nach...');
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
    
    this.setState('thinking');

    const maxIterations = 3;
    for (let i = 0; i < maxIterations; i++) {
      if (this.state !== 'thinking') return; // Aborted by user interrupt

      const finalMessages = [{ role: 'system', content: getDynamicSystemPrompt() }, ...this.history];
      let response;
      try {
        response = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: finalMessages,
          tools: toolDeclarations as any,
          tool_choice: 'auto'
        });
      } catch (err: any) {
        if (err.status === 429) {
          console.log(`\n  ${c.red}JARVIS:${c.reset} Entschuldigung Sir, mein Groq-Token-Limit für heute ist aufgebraucht. Ich brauche eine Pause.`);
          VoiceService.speak("Entschuldigung Sir, mein Token Limit ist aufgebraucht.");
        } else {
          console.error(`\n  ${c.red}API Error:${c.reset}`, err.message || err);
        }
        this.setState('idle');
        return;
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
          let args = {};
          try { args = JSON.parse(tc.function.arguments); } catch (e) {}
          this.spinner.text = `Führe Tool aus: ${name}`;
          const result = await executeTool(name, args);
          this.history.push({ role: 'tool', tool_call_id: tc.id, name, content: JSON.stringify(result) });
        }
        this.spinner.text = 'Denke weiter nach...';
        continue;
      }

      const fullText = message.content || '';
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

async function main() {
  console.log(boxen(`\n${c.bold}J.A.R.V.I.S  CLI${c.reset}\nSeamless Voice Mode\n\n${c.dim}Groq ${GROQ_MODEL} • ElevenLabs TTS • Whisper STT${c.reset}`, { padding: 1, borderColor: 'cyan', title: 'v2.2' }));

  try { await prisma.$queryRaw`SELECT 1`; console.log(`  ${c.green}✓${c.reset} DB`); } catch { console.log(`  ${c.red}✗${c.reset} DB Error`); }
  
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

  // Seamless Loop
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
