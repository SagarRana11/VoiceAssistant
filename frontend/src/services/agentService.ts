export interface AgentAction {
  action: string;
  data: unknown;
}

export interface AgentStreamCallbacks {
  onChunk:  (text: string) => void;
  onAction: (action: AgentAction) => void;
  onDone:   () => void;
  onError:  (err: Error) => void;
}

export interface AgentMessagePayload {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  pendingField?: string;
  pendingIntent?: string;
  pendingRemainingFields?: string[];
  confirmField?: string;
  confirmValue?: unknown;
  voiceEnabled?: boolean;
  bulkFields?: Record<string, string>;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('va_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function streamAgentMessage(
  payload: AgentMessagePayload,
  callbacks: AgentStreamCallbacks
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/agent/message', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    callbacks.onError(err as Error);
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    callbacks.onError(new Error((data as { error?: string }).error ?? `HTTP ${res.status}`));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error('Response body is not readable'));
    return;
  }

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

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(payload) as {
            content?: string;
            action?: string;
            data?: unknown;
          };
          if (parsed.content) callbacks.onChunk(parsed.content);
          if (parsed.action)  callbacks.onAction({ action: parsed.action, data: parsed.data });
        } catch {
          // Skip malformed SSE frames
        }
      }
    }
  } finally {
    reader.releaseLock();
    callbacks.onDone();
  }
}
