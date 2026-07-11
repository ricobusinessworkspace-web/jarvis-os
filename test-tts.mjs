import dotenv from 'dotenv';
dotenv.config();

async function testTTS() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }
  
  const voiceId = 'pNInz6obpgDQGcFmaJgB';
  console.log("Using API Key:", apiKey);
  
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: "Hallo Rico, dies ist ein Test.",
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });
  
  if (!res.ok) {
    console.error("Failed:", res.status, await res.text());
  } else {
    console.log("Success! Audio length:", (await res.arrayBuffer()).byteLength);
  }
}

testTTS();
