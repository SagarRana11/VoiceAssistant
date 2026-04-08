/**
 * didController.ts
 * Proxies all D-ID Streaming API calls server-side so the API key is never
 * exposed to the browser. The frontend does the WebRTC negotiation; this
 * controller just relays signaling messages.
 */
import { Request, Response } from 'express';

const DID_BASE    = 'https://api.d-id.com';
const getAuth = () => {
  const key = process.env.DID_API_KEY ?? '';
  // D-ID keys are in 'base64(email):api_key' format — don't add another ':'
  const credential = key.includes(':') ? key : key + ':';
  return 'Basic ' + Buffer.from(credential).toString('base64');
};
const didHeaders  = () => ({
  'Authorization': getAuth(),
  'Content-Type':  'application/json',
  'Accept':        'application/json',
});

// ── POST /api/did/streams — create a new streaming session ───────────────────
export async function createStream(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) { res.status(503).json({ error: 'D-ID not configured' }); return; }

  const presenterUrl = process.env.DID_PRESENTER_URL ??
    'https://d-id-public-bucket.s3.amazonaws.com/alice.jpg';

  const r = await fetch(`${DID_BASE}/talks/streams`, {
    method:  'POST',
    headers: didHeaders(),
    body: JSON.stringify({
      source_url: presenterUrl,
      driver_url: 'bank://lively',
      config:     { stitch: true },
    }),
  });

  const data = await r.json();
  if (!r.ok) { res.status(r.status).json(data); return; }
  res.json(data);
}

// ── POST /api/did/streams/:id/sdp — send WebRTC SDP answer ──────────────────
export async function sendSdp(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const r = await fetch(`${DID_BASE}/talks/streams/${id}/sdp`, {
    method:  'POST',
    headers: didHeaders(),
    body:    JSON.stringify(req.body),
  });
  const data = await r.json();
  res.status(r.status).json(data);
}

// ── POST /api/did/streams/:id/ice — send ICE candidate ──────────────────────
export async function sendIce(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const r = await fetch(`${DID_BASE}/talks/streams/${id}/ice`, {
    method:  'POST',
    headers: didHeaders(),
    body:    JSON.stringify(req.body),
  });
  // D-ID returns 200 with no body for ICE
  res.status(r.status).end();
}

// ── POST /api/did/streams/:id/talk — make the avatar speak ───────────────────
export async function sendTalk(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const r = await fetch(`${DID_BASE}/talks/streams/${id}`, {
    method:  'POST',
    headers: didHeaders(),
    body:    JSON.stringify(req.body),
  });
  const data = await r.json();
  res.status(r.status).json(data);
}

// ── DELETE /api/did/streams/:id — close the stream ───────────────────────────
export async function deleteStream(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { session_id } = req.query as { session_id?: string };

  const url = session_id
    ? `${DID_BASE}/talks/streams/${id}?session_id=${session_id}`
    : `${DID_BASE}/talks/streams/${id}`;

  const r = await fetch(url, { method: 'DELETE', headers: didHeaders() });
  res.status(r.status).end();
}
