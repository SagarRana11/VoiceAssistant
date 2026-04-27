import { HospitalPatient, HospitalSession } from '../store/hospitalStore';

const BASE = '/api/hospital';

function getToken(): string {
  return localStorage.getItem('va_token') ?? '';
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

// ─── Enroll ────────────────────────────────────────────────────────────────
export async function enrollPatient(data: {
  name: string;
  age: number;
  gender: string;
  preferredLanguage: string;
  diagnosis: string;
  plannedProcedure: string;
  doctorName: string;
  riskFactors: string;
}): Promise<{ patient: HospitalPatient; session: HospitalSession }> {
  const res = await fetch(`${BASE}/enroll`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Enrollment failed');
  return res.json();
}

// ─── Patients ──────────────────────────────────────────────────────────────
export async function getPatients(): Promise<{ patients: HospitalPatient[] }> {
  const res = await fetch(`${BASE}/patients`, { headers: authHeaders() });
  return res.json() as Promise<{ patients: HospitalPatient[] }>;
}

// ─── Session ───────────────────────────────────────────────────────────────
export async function getSession(patientId: string): Promise<{ session: HospitalSession }> {
  const res = await fetch(`${BASE}/session/${patientId}`, { headers: authHeaders() });
  return res.json();
}

// ─── Streaming helper ──────────────────────────────────────────────────────
export async function streamHospitalSSE(
  url:    string,
  body:   Record<string, unknown>,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(url, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader  = res.body?.getReader();
  if (!reader)  throw new Error('No response body');
  const decoder = new TextDecoder();
  let   buffer  = '';

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
      if (data === '[DONE]') { reader.releaseLock(); return; }
      try {
        const parsed = JSON.parse(data) as { content?: string };
        if (parsed.content) onChunk(parsed.content);
      } catch { /* skip malformed frames */ }
    }
  }
  reader.releaseLock();
}

// ─── Chat ──────────────────────────────────────────────────────────────────
export async function streamHospitalChat(
  patientId: string,
  sessionId: string,
  message:   string,
  history:   { role: 'user' | 'assistant'; content: string }[],
  onChunk:   (chunk: string) => void,
): Promise<void> {
  return streamHospitalSSE(`${BASE}/chat`, { patientId, sessionId, message, history }, onChunk);
}

// ─── Consent step ──────────────────────────────────────────────────────────
export async function streamConsentStep(
  patientId:      string,
  sessionId:      string,
  step:           number,
  questionsAsked: number,
  onChunk:        (chunk: string) => void,
): Promise<void> {
  return streamHospitalSSE(`${BASE}/consent`, { patientId, sessionId, step, questionsAsked }, onChunk);
}

export async function completeConsent(patientId: string, sessionId: string, questionsAsked: number): Promise<void> {
  await fetch(`${BASE}/consent/complete`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ patientId, sessionId, questionsAsked }),
  });
}

// ─── Discharge step ────────────────────────────────────────────────────────
export async function streamDischargeStep(
  patientId: string,
  sessionId: string,
  step:      number,
  onChunk:   (chunk: string) => void,
): Promise<void> {
  return streamHospitalSSE(`${BASE}/discharge`, { patientId, sessionId, step }, onChunk);
}

// ─── Procedure done ────────────────────────────────────────────────────────
export async function markProcedureDone(sessionId: string): Promise<void> {
  await fetch(`${BASE}/procedure/done`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ sessionId }),
  });
}

// ─── Follow-up ─────────────────────────────────────────────────────────────
export async function getFollowupQuestions(day: number): Promise<{ day: number; questions: string[] }> {
  const res = await fetch(`${BASE}/followup/questions/${day}`, { headers: authHeaders() });
  return res.json();
}

export async function streamFollowup(
  patientId: string,
  sessionId: string,
  day:       number,
  responses: Record<string, string>,
  onChunk:   (chunk: string) => void,
): Promise<void> {
  return streamHospitalSSE(`${BASE}/followup`, { patientId, sessionId, day, responses }, onChunk);
}

// ─── Avatar sync chat ──────────────────────────────────────────────────────
export async function chatSync(patientId: string, message: string): Promise<string> {
  const res = await fetch(`${BASE}/chat/sync`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ patientId, message }),
  });
  const data = await res.json() as { response: string };
  return data.response;
}
