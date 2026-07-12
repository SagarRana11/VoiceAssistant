const BASE = '/api/code'; // Proxied through Vite → backend:5000

export interface CodeChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

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

/**
 * Stream a CodeWriter chat response from `/api/code`.
 * `images` are data URLs (data:image/...;base64,...).
 */
export async function streamCode(
  message: string,
  images: string[],
  history: CodeChatTurn[],
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, images, history }),
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

        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data) as {
            content?: string;
            done?: boolean;
            error?: string;
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.content) onChunk(parsed.content);
          if (parsed.done) return;
        } catch (err) {
          if ((err as Error).message !== 'Unexpected end of JSON input') throw err;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
