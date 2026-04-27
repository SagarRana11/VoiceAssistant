/**
 * didController.ts
 * Fixed version:
 * - Prevents double json() reads
 * - Better error handling
 * - Consistent response parsing
 * - Safer session forwarding
 */

import { Request, Response } from 'express';

const DID_BASE = 'https://api.d-id.com';

const getAuth = () => {
  const key = process.env.DID_API_KEY ?? '';
  return `Basic ${key}`;
};

const didHeaders = (sessionId?: string) => ({
  Authorization: getAuth(),
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(sessionId ? { Cookie: sessionId } : {}),
});

async function parseJsonSafe(r: Response | any) {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Delete every open D-ID streaming session for this account. */
async function nukeAllSessions(): Promise<void> {
  try {
    const r = await fetch(`${DID_BASE}/talks/streams`, {
      method: 'GET',
      headers: didHeaders(),
    });
    const body = await parseJsonSafe(r);
    // D-ID returns { streams: [...] } or an array at the top level
    const list: { id: string; session_id?: string }[] = Array.isArray(body)
      ? body
      : (body?.streams ?? []);

    console.log(`[DID] nukeAllSessions — deleting ${list.length} session(s)`);

    await Promise.allSettled(
      list.map(s =>
        fetch(`${DID_BASE}/talks/streams/${s.id}`, {
          method: 'DELETE',
          headers: didHeaders(s.session_id),
        }).catch(() => {}),
      ),
    );
  } catch (err) {
    console.warn('[DID] nukeAllSessions failed:', err);
  }
}

// ─────────────────────────────────────────────
// CREATE STREAM
// ─────────────────────────────────────────────
export async function createStream(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = process.env.DID_API_KEY;

    if (!apiKey) {
      res.status(503).json({ error: 'D-ID not configured' });
      return;
    }

    const presenterUrl =
      process.env.DID_PRESENTER_URL ?? 'https://d-id-public-bucket.s3.amazonaws.com/alice.jpg';

    const body = JSON.stringify({
      source_url: presenterUrl,
      driver_url: 'bank://lively',
      config: { stitch: true },
    });

    let r = await fetch(`${DID_BASE}/talks/streams`, {
      method: 'POST',
      headers: didHeaders(),
      body,
    });

    // If D-ID says "Max sessions reached", nuke all stale sessions and retry once.
    if (r.status === 403) {
      const errBody = await parseJsonSafe(r);
      console.warn('[DID] Max sessions reached — clearing stale sessions and retrying...', errBody);
      await nukeAllSessions();

      r = await fetch(`${DID_BASE}/talks/streams`, {
        method: 'POST',
        headers: didHeaders(),
        body,
      });
    }

    const data = await parseJsonSafe(r);
    console.log('createStream >>>', data);
    res.status(r.status).json(data);
  } catch (error) {
    console.error('createStream error:', error);
    res.status(500).json({ error: 'Failed to create stream' });
  }
}

// ─────────────────────────────────────────────
// SEND SDP
// ─────────────────────────────────────────────
export async function sendSdp(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { session_id, ...body } = req.body;

    const r = await fetch(`${DID_BASE}/talks/streams/${id}/sdp`, {
      method: 'POST',
      headers: didHeaders(session_id),
      body: JSON.stringify(body),
    });

    const data = await parseJsonSafe(r);

    console.log('sendSdp >>>', data);

    res.status(r.status).json(data);
  } catch (error) {
    console.error('sendSdp error:', error);
    res.status(500).json({ error: 'Failed to send SDP' });
  }
}

// ─────────────────────────────────────────────
// SEND ICE
// ─────────────────────────────────────────────
export async function sendIce(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { session_id, ...body } = req.body;

    const r = await fetch(`${DID_BASE}/talks/streams/${id}/ice`, {
      method: 'POST',
      headers: didHeaders(session_id),
      body: JSON.stringify(body),
    });

    const data = await parseJsonSafe(r);

    res.status(r.status).json(data);
  } catch (error) {
    console.error('sendIce error:', error);
    res.status(500).json({ error: 'Failed to send ICE candidate' });
  }
}

// ─────────────────────────────────────────────
// SEND TALK
// ─────────────────────────────────────────────
export async function sendTalk(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { session_id, ...body } = req.body;

    const r = await fetch(`${DID_BASE}/talks/streams/${id}`, {
      method: 'POST',
      headers: didHeaders(session_id),
      body: JSON.stringify(body),
    });

    const data = await parseJsonSafe(r);

    console.log('sendTalk >>>', data);

    res.status(r.status).json(data);
  } catch (error) {
    console.error('sendTalk error:', error);
    res.status(500).json({ error: 'Failed to send talk request' });
  }
}

// ─────────────────────────────────────────────
// DELETE STREAM
// ─────────────────────────────────────────────
export async function deleteStream(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { session_id } = req.query as { session_id?: string };

    const r = await fetch(`${DID_BASE}/talks/streams/${id}`, {
      method: 'DELETE',
      headers: didHeaders(session_id),
    });

    res.status(r.status).json({ success: true });
  } catch (error) {
    console.error('deleteStream error:', error);
    res.status(500).json({ error: 'Failed to delete stream' });
  }
}
