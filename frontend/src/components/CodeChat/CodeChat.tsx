import { useEffect, useRef, useState } from 'react';
import { streamCode, type CodeChatTurn } from '../../services/codeService';
import styles from './CodeChat.module.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // data URLs (user turns only)
}

let idSeq = 0;
const nextId = () => `cc-${Date.now()}-${idSeq++}`;

export function CodeChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, streaming, open]);

  // ── Image attach ──
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 6)
      .forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          setPendingImages(prev => (prev.length >= 6 ? prev : [...prev, url]));
        };
        reader.readAsDataURL(file);
      });
  };

  const removePendingImage = (idx: number) =>
    setPendingImages(prev => prev.filter((_, i) => i !== idx));

  // ── Send ──
  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isBusy) return;

    const images = pendingImages;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text, images };
    const history: CodeChatTurn[] = messages.map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImages([]);
    setError(null);
    setStreaming('');
    setIsBusy(true);

    let acc = '';
    try {
      await streamCode(text, images, history, chunk => {
        acc += chunk;
        setStreaming(acc);
      });
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: acc }]);
    } catch (err) {
      setError((err as Error).message ?? 'Something went wrong');
      if (acc) setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: acc }]);
    } finally {
      setStreaming('');
      setIsBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreaming('');
    setError(null);
  };

  // ── Launcher (closed state) ──
  if (!open) {
    return (
      <button className={styles.fab} onClick={() => setOpen(true)} aria-label="Open code chat">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
    );
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Code chat">
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>Code Chat</span>
        </div>
        <div className={styles.headerActions}>
          {messages.length > 0 && (
            <button className={styles.iconBtn} onClick={clearChat} aria-label="Clear chat" title="Clear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
          <button className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="Close" title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {messages.length === 0 && !streaming ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon} aria-hidden="true">💬</div>
            <p className={styles.emptyTitle}>Ask a coding question</p>
            <p className={styles.emptyHint}>Type your question or attach an image (screenshot, error, diagram).</p>
          </div>
        ) : (
          <>
            {messages.map(m => (
              <Bubble key={m.id} message={m} />
            ))}
            {streaming && (
              <div className={`${styles.bubble} ${styles.assistant}`}>
                <div className={styles.bubbleText}>
                  {streaming}
                  <span className={styles.cursor} aria-hidden="true" />
                </div>
              </div>
            )}
            {isBusy && !streaming && (
              <div className={`${styles.bubble} ${styles.assistant}`}>
                <div className={styles.typing}>
                  <span /><span /><span />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Error ── */}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {/* ── Pending image previews ── */}
      {pendingImages.length > 0 && (
        <div className={styles.previews}>
          {pendingImages.map((src, i) => (
            <div key={i} className={styles.preview}>
              <img src={src} alt={`attachment ${i + 1}`} />
              <button
                className={styles.previewRemove}
                onClick={() => removePendingImage(i)}
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Composer ── */}
      <div className={styles.composer}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach image"
          title="Attach image"
          disabled={pendingImages.length >= 6}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your code…"
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={isBusy || (!input.trim() && pendingImages.length === 0)}
          aria-label="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}>
      {message.images && message.images.length > 0 && (
        <div className={styles.bubbleImages}>
          {message.images.map((src, i) => (
            <img key={i} src={src} alt={`attachment ${i + 1}`} />
          ))}
        </div>
      )}
      {message.content && <div className={styles.bubbleText}>{message.content}</div>}
    </div>
  );
}
