import { User, RoleId } from '../types';
import type { DomainId, ScoreDomainResponse, GenerateReportResponse, PhysicalScore, MentalScore, EmotionalScore } from '../assessment/assessmentTypes';

const BASE_URL = '/api'; // Proxied through Vite → backend:5000

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getToken(): string | null {
  return localStorage.getItem('va_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function apiRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse(res);
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function apiGetMe(): Promise<{ user: User }> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─── Conversations ────────────────────────────────────────────────────────────
export async function apiCreateConversation(
  roleId: RoleId,
  roleName: string
): Promise<{ conversation: { _id: string } }> {
  const res = await fetch(`${BASE_URL}/chat/conversations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ roleId, roleName }),
  });
  return handleResponse(res);
}

export async function apiGetConversations(): Promise<{ conversations: unknown[] }> {
  const res = await fetch(`${BASE_URL}/chat/conversations`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiDeleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export async function apiScoreDomain(
  domain: DomainId,
  answers: Record<string, string>
): Promise<ScoreDomainResponse> {
  const res = await fetch(`${BASE_URL}/assessment/score-domain`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ domain, answers }),
  });
  return handleResponse<ScoreDomainResponse>(res);
}

export async function apiGenerateReport(payload: {
  sessionId?: string;
  physicalResult: PhysicalScore;
  mentalResult: MentalScore;
  emotionalResult: EmotionalScore;
}): Promise<GenerateReportResponse> {
  const res = await fetch(`${BASE_URL}/assessment/report`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<GenerateReportResponse>(res);
}

export async function apiListReports(): Promise<{ reports: unknown[] }> {
  const res = await fetch(`${BASE_URL}/assessment/reports`, {
    headers: authHeaders(),
  });
  return handleResponse<{ reports: unknown[] }>(res);
}

export async function apiGetReport(id: string): Promise<{ report: unknown }> {
  const res = await fetch(`${BASE_URL}/assessment/reports/${id}`, {
    headers: authHeaders(),
  });
  return handleResponse<{ report: unknown }>(res);
}

// ─── Plan History ────────────────────────────────────────────────────────────

export async function apiListExercisePlans(): Promise<{ plans: unknown[] }> {
  const res = await fetch(`${BASE_URL}/plans/exercise`, { headers: authHeaders() });
  return handleResponse<{ plans: unknown[] }>(res);
}

export async function apiGetExercisePlan(id: string): Promise<{ plan: unknown }> {
  const res = await fetch(`${BASE_URL}/plans/exercise/${id}`, { headers: authHeaders() });
  return handleResponse<{ plan: unknown }>(res);
}

export async function apiListDietPlans(): Promise<{ plans: unknown[] }> {
  const res = await fetch(`${BASE_URL}/plans/diet`, { headers: authHeaders() });
  return handleResponse<{ plans: unknown[] }>(res);
}

export async function apiGetDietPlan(id: string): Promise<{ plan: unknown }> {
  const res = await fetch(`${BASE_URL}/plans/diet/${id}`, { headers: authHeaders() });
  return handleResponse<{ plan: unknown }>(res);
}

export async function apiListMeditationPlans(): Promise<{ plans: unknown[] }> {
  const res = await fetch(`${BASE_URL}/plans/meditation`, { headers: authHeaders() });
  return handleResponse<{ plans: unknown[] }>(res);
}

export async function apiGetMeditationPlan(id: string): Promise<{ plan: unknown }> {
  const res = await fetch(`${BASE_URL}/plans/meditation/${id}`, { headers: authHeaders() });
  return handleResponse<{ plan: unknown }>(res);
}

// ─── Streaming Chat Message ───────────────────────────────────────────────────
export async function apiStreamMessage(
  conversationId: string,
  message: string,
  roleId: RoleId,
  onChunk: (chunk: string) => void
): Promise<void> {
  const res = await fetch(`${BASE_URL}/chat/message`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ conversationId, message, roleId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const parsed = JSON.parse(trimmed.slice(6)) as {
            content?: string;
            done?: boolean;
            error?: string;
          };

          if (parsed.error) throw new Error(parsed.error);
          if (parsed.content) onChunk(parsed.content);
          if (parsed.done) return;
        } catch (parseErr) {
          // Re-throw only real errors, not JSON parse failures on keep-alives
          if ((parseErr as Error).message !== 'Unexpected end of JSON input') {
            throw parseErr;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
