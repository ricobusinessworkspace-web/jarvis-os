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

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || 'nPczCjzI2devNBz1zQrb';

    if (!apiKey) {
      if (onFinish) onFinish();
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
        if (onFinish) onFinish();
        return;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const tmpFile = join(tmpdir(), `jarvis_tts_${Date.now()}.mp3`);
      writeFileSync(tmpFile, buffer);

      this.playProcess = spawn('afplay', [tmpFile]);
      
      this.playProcess.on('close', () => {
        this.playProcess = null;
        try { unlinkSync(tmpFile); } catch {}
        if (onFinish) onFinish();
      });

    } catch (err) {
      if (onFinish) onFinish();
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
