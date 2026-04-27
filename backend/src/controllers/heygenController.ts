/**
 * heygenController.ts
 *
 * The HeyGen Streaming API (/v1/streaming.*) is fully sunsetted for sk_V2_* keys.
 * The SDK (@heygen/streaming-avatar) handles all WebRTC + LiveKit internally.
 * The backend only needs to vend a one-time session token so the API key
 * never has to be exposed to the client.
 */
import { Request, Response } from 'express';

// ── Get one-time session token ────────────────────────────────────────────────
export async function getToken(_req: Request, res: Response): Promise<void> {
  try {
    const key = process.env.HEYGEN_API_KEY;
    if (!key) {
      res.status(503).json({ error: 'HeyGen not configured' });
      return;
    }

    const r = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method:  'POST',
      headers: { 'x-api-key': key },
    });

    const text = await r.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { data = { _raw: text }; }

    console.log('[HeyGen] getToken:', r.status, data?.data ? 'token OK' : JSON.stringify(data));
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[HeyGen] getToken error:', err);
    res.status(500).json({ error: 'Failed to get HeyGen token' });
  }
}
