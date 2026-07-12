import { Request, Response } from 'express';

// ─── Types ───────────────────────────────────────────────────────────────────
interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface CodeChatBody {
  message?: string;
  images?: string[]; // data URLs (data:image/png;base64,...) or plain https URLs
  history?: HistoryTurn[];
}

// OpenAI vision content parts
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

const SYSTEM_PROMPT =
  'You are CodeWriter, an expert software engineering assistant. ' +
  'Answer coding questions precisely. When code is requested, return complete, ' +
  'runnable snippets in fenced markdown blocks with the correct language tag. ' +
  'If the user attaches images (screenshots, diagrams, error messages), read them ' +
  'carefully and reference what you see. Keep prose tight.';

// ─── SSE helpers ───────────────────────────────────────────────────────────────
function sseSend(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ─── Controller ────────────────────────────────────────────────────────────────
const controller = async (req: Request, res: Response): Promise<void> => {
  const { message = '', images = [], history = [] } = (req.body ?? {}) as CodeChatBody;

  if (!message.trim() && images.length === 0) {
    res.status(400).json({ message: 'A message or at least one image is required.' });
    return;
  }

  // ── Build the OpenAI message list ──
  const messages: OpenAIMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const turn of history.slice(-10)) {
    if (turn?.content) messages.push({ role: turn.role, content: turn.content });
  }

  // Current user turn — text + any attached images (vision)
  if (images.length > 0) {
    const parts: ContentPart[] = [];
    if (message.trim()) parts.push({ type: 'text', text: message });
    for (const url of images.slice(0, 6)) {
      if (typeof url === 'string' && url) parts.push({ type: 'image_url', image_url: { url } });
    }
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: message });
  }

  // ── Open SSE stream ──
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const apiKey = process.env.OPENAI_API_KEY;

  // No key → mock so the UI works in dev
  if (!apiKey) {
    const mock =
      "I'm running in mock mode (no `OPENAI_API_KEY` set). Once a key is configured " +
      "I'll answer your coding questions and read any images you attach.";
    for (const word of mock.split(' ')) {
      sseSend(res, { content: word + ' ' });
      await new Promise(r => setTimeout(r, 30));
    }
    sseSend(res, { done: true });
    res.end();
    return;
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        stream: true,
        max_tokens: 2000,
        temperature: 0.4,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => '');
      sseSend(res, { error: `OpenAI API error ${upstream.status}: ${body}` });
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder('utf-8');
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
          sseSend(res, { done: true });
          res.end();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (content) sseSend(res, { content });
        } catch {
          // skip malformed SSE frames
        }
      }
    }

    sseSend(res, { done: true });
    res.end();
  } catch (err) {
    sseSend(res, { error: (err as Error).message ?? 'Streaming failed' });
    res.end();
  }
};

export default controller;
