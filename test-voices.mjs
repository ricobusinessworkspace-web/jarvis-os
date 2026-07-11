import dotenv from 'dotenv';
dotenv.config();

async function getVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const res = await fetch(`https://api.elevenlabs.io/v1/voices`, {
    headers: { 'xi-api-key': apiKey }
  });
  const json = await res.json();
  console.log("Available voices:");
  json.voices.forEach(v => console.log(`${v.name}: ${v.voice_id}`));
}

getVoices();
