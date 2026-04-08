import { Request, Response } from 'express';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export async function synthesizeSpeech(req: Request, res: Response): Promise<void> {
  const apiKey   = process.env.ELEVENLABS_API_KEY;
  const voiceId  = process.env.ELEVENLABS_VOICE_ID ?? 'cgSgspJ2msm6clMCkdW9';
  const { text } = req.body as { text?: string };

  if (!apiKey) {
    res.status(503).json({ error: 'ElevenLabs not configured' });
    return;
  }

  if (!text?.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability:        0.45,
          similarity_boost: 0.80,
          style:            0.30,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.warn('[ElevenLabs] error', response.status, body);
    res.status(response.status).json({ error: 'ElevenLabs request failed' });
    return;
  }

  const audioBuffer = await response.arrayBuffer();
  res.set('Content-Type', 'audio/mpeg');
  res.set('Content-Length', String(audioBuffer.byteLength));
  res.send(Buffer.from(audioBuffer));
}
