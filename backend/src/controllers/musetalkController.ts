/**
 * musetalkController.ts
 * Proxy between the Voice Assistant frontend and the local MuseTalk
 * lip-sync server (musetalk_server.py, default :5003).
 *
 * Flow: frontend POSTs raw WAV audio bytes -> this proxy wraps them as
 * multipart form-data -> MuseTalk /lipsync -> returns an MP4 blob.
 *
 * Config (backend/.env):
 *   MUSETALK_ENABLED   'true' to enable the route
 *   MUSETALK_API_URL   base URL of the python server (default http://localhost:5003)
 */

import { Request, Response } from 'express';

const MUSETALK_URL = process.env.MUSETALK_API_URL ?? 'http://localhost:5003';
const ENABLED = process.env.MUSETALK_ENABLED === 'true';

/** GET /api/musetalk/health — passthrough to the python server health check. */
export async function health(_req: Request, res: Response): Promise<void> {
  if (!ENABLED) {
    res.status(503).json({ error: 'MuseTalk disabled', enabled: false });
    return;
  }
  try {
    const r = await fetch(`${MUSETALK_URL}/health`);
    const data = (await r.json()) as Record<string, unknown>;
    res.status(r.status).json({ enabled: true, ...data });
  } catch (err) {
    console.warn('[MuseTalk] health check failed:', err);
    res.status(502).json({ error: 'MuseTalk server unreachable', enabled: true });
  }
}

/**
 * POST /api/musetalk/lipsync
 * Body: raw audio bytes (audio/wav). Returns: video/mp4.
 */
export async function lipsync(req: Request, res: Response): Promise<void> {
  if (!ENABLED) {
    res.status(503).json({ error: 'MuseTalk disabled' });
    return;
  }

  const audio = req.body as Buffer;
  if (!audio || !Buffer.isBuffer(audio) || audio.length === 0) {
    res.status(400).json({ error: 'audio body is required (Content-Type: audio/wav)' });
    return;
  }

  try {
    const form = new FormData();
    form.append('audio', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');

    const r = await fetch(`${MUSETALK_URL}/lipsync`, {
      method: 'POST',
      body: form,
    });

    if (!r.ok) {
      const text = await r.text();
      console.warn('[MuseTalk] lipsync error', r.status, text);
      res.status(r.status).json({ error: 'MuseTalk lipsync failed', detail: text.slice(0, 500) });
      return;
    }

    const video = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Length', String(video.length));
    res.send(video);
  } catch (err) {
    console.error('[MuseTalk] lipsync proxy error:', err);
    res.status(502).json({ error: 'MuseTalk server unreachable' });
  }
}
