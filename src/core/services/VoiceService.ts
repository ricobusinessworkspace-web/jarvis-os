import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, unlinkSync, createReadStream, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const HALLUCINATIONS = [
  "vielen dank.",
  "vielen dank für's zuschauen.",
  "vielen dank fürs zuschauen.",
  "vielen dank",
  "danke fürs zuschauen",
  "tschüss.",
  "tschüss"
];

export class VoiceService {
  private static playProcess: ChildProcess | null = null;
  private static recordProcess: ChildProcess | null = null;
  private static isInterrupting = false;

  // --- TTS (Text To Speech) ---
  static async speak(text: string, onFinish?: () => void): Promise<void> {
    if (!text?.trim()) {
      if (onFinish) onFinish();
      return;
    }

    const sanitizeForTTS = (str: string) => {
      return str
        .replace(/(\d{1,2}):(\d{2}):\d{2}/g, '$1 Uhr $2') 
        .replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => m === '00' ? `${h} Uhr` : `${h} Uhr ${m}`)
        .replace(/\d{4}-\d{2}-\d{2}/g, 'heute')
        .replace(/%/g, ' Prozent')
        .replace(/&/g, ' und ')
        .replace(/°C/g, ' Grad Celsius')
        .replace(/°/g, ' Grad');
    };

    const sanitizedText = sanitizeForTTS(text.trim());

    try {
      const { EdgeTTS } = await import('node-edge-tts');
      const tts = new EdgeTTS({
        voice: 'de-DE-ConradNeural', // Jarvis Stimme
        lang: 'de-DE',
        outputFormat: 'audio-24khz-96kbitrate-mono-mp3'
      });

      const tmpFile = join(tmpdir(), `jarvis_tts_${Date.now()}.mp3`);
      await tts.ttsPromise(sanitizedText, tmpFile);

      this.playProcess = spawn('afplay', [tmpFile]);
      
      this.playProcess.on('close', () => {
        this.playProcess = null;
        try { unlinkSync(tmpFile); } catch {}
        if (onFinish) onFinish();
      });

    } catch (err: any) {
      console.error(`\nEdge TTS Fehler:`, err.message);
      // Fallback zu lokalem macOS TTS
      this.playProcess = spawn('say', ['-v', 'Anna', sanitizedText]);
      this.playProcess.on('close', () => {
        this.playProcess = null;
        if (onFinish) onFinish();
      });
    }
  }

  static stopSpeaking() {
    if (this.playProcess) {
      this.playProcess.kill('SIGKILL');
      this.playProcess = null;
    }
  }

  static interruptRecording() {
    if (this.recordProcess) {
      this.isInterrupting = true;
      this.recordProcess.kill('SIGKILL');
      this.recordProcess = null;
    }
  }

  // --- STT (Speech To Text) with SoX VAD ---
  static async recordAndTranscribe(): Promise<string> {
    this.isInterrupting = false;
    return new Promise((resolve) => {
      const recordPath = join(tmpdir(), `jarvis_rec_${Date.now()}.wav`);
      
      // rec -q -c 1 -r 16000 output.wav silence 1 0.1 1% 1 1.5 1%
      this.recordProcess = spawn('rec', [
        '-q', '-c', '1', '-r', '16000', recordPath,
        'silence', '1', '0.1', '1%', '1', '1.5', '1%'
      ]);

      this.recordProcess.on('close', async () => {
        this.recordProcess = null;
        
        if (this.isInterrupting) {
          try { if (existsSync(recordPath)) unlinkSync(recordPath); } catch {}
          return resolve('');
        }
        
        if (!existsSync(recordPath)) return resolve('');

        try {
          const transcription = await groq.audio.transcriptions.create({
            file: createReadStream(recordPath),
            model: 'whisper-large-v3-turbo',
            language: 'de',
          });
          
          try { unlinkSync(recordPath); } catch {}
          
          let text = transcription.text?.trim() || '';
          const lower = text.toLowerCase().trim();
          
          // Filter Hallucinations
          if (text.length < 3 || HALLUCINATIONS.some(h => lower.includes(h))) {
            text = ''; 
          }
          
          resolve(text);
        } catch (err: any) {
          try { unlinkSync(recordPath); } catch {}
          resolve('');
        }
      });
    });
  }
}
