import { CathLabPatient, CathLabSession } from '../store/cathLabStore';

const BASE = '/api/cathlab';

function getToken(): string {
  return localStorage.getItem('va_token') ?? '';
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

// ─── Enroll ────────────────────────────────────────────────────────────────
export async function enrollCathLabPatient(data: {
  patientName: string;
  dob: string;
  mrn: string;
  procedureDate: string;
}): Promise<{ patient: CathLabPatient; session: CathLabSession }> {
  const res = await fetch(`${BASE}/enroll`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Enrollment failed');
  return res.json();
}

// ─── Get session ───────────────────────────────────────────────────────────
export async function getCathLabSession(sessionId: string): Promise<{
  session: CathLabSession;
  patient: CathLabPatient;
  hpRecord: Record<string, string>;
}> {
  const res = await fetch(`${BASE}/session/${sessionId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

// ─── Get summary ───────────────────────────────────────────────────────────
export async function getCathLabSummary(sessionId: string): Promise<{
  session: CathLabSession;
  patient: CathLabPatient;
  hpRecord: Record<string, string>;
}> {
  const res = await fetch(`${BASE}/summary/${sessionId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Summary not found');
  return res.json();
}

// ─── SSE action types ──────────────────────────────────────────────────────
export type SSEAction =
  | { action: 'CAPTURE'; data: { field: string; value: string } }
  | { action: 'FLAG'; data: { type: string; message: string } }
  | { action: 'ADVANCE'; data: { nextStep: string; nextModule: number; nextStepLabel: string; nextModuleLabel: string; nextAvatarText: string; isEducation: boolean } }
  | { action: 'COMPLETE'; data: { message: string } };

// ─── Stream H&P chat turn ──────────────────────────────────────────────────
export async function streamCathLabChat(
  sessionId: string,
  patientMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (chunk: string) => void,
  onAction: (action: SSEAction) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, patientMessage, history }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        reader.releaseLock();
        return;
      }
      try {
        const parsed = JSON.parse(data) as { content?: string; action?: string; data?: unknown };
        if (parsed.content) {
          onChunk(parsed.content);
        } else if (parsed.action) {
          onAction({ action: parsed.action, data: parsed.data } as SSEAction);
        }
      } catch {
        // skip malformed frames
      }
    }
  }
  reader.releaseLock();
}
