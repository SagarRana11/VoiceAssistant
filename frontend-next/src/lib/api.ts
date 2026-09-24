export type User = { id: string; name: string; email: string; initials: string };
export type ChatMessage = { _id: string; role: "user" | "assistant"; content: string; timestamp: string };
export type Conversation = {
  _id: string;
  roleId: RoleId;
  roleName: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};
export type ConversationSummary = Omit<Conversation, "messages"> & {
  messageCount: number;
  lastMessage: ChatMessage | null;
};
export type RoleId = "general" | "therapist" | "health" | "career" | "fitness";

const TOKEN_KEY = "va_token";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function headers(): HeadersInit {
  const token = tokenStore.get();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

/** POST /chat/message — reads the SSE stream, calling onChunk for each content piece. */
export async function streamMessage(
  body: { conversationId: string; message: string; roleId: RoleId },
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch("/api/chat/message", { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message ?? "Couldn't send the message.", res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const line = evt.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.error) throw new ApiError(data.error, 500);
      if (data.content) onChunk(data.content);
    }
  }
}
