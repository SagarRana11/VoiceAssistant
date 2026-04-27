import { useState, useRef, useEffect } from 'react';
import { HospitalLayout }   from './HospitalLayout';
import { useHospitalStore } from '../../store/hospitalStore';
import { streamHospitalChat } from '../../services/hospitalService';
import styles from './ChatPage.module.css';

interface ChatMsg { role: 'user' | 'assistant'; content: string; }

const QUICK_QUESTIONS = [
  'What happened to my heart?',
  'Why so many medicines?',
  'Can I walk tomorrow?',
  'Can I travel by car?',
  'What if chest pain returns?',
  'When can I return to work?',
];

export function ChatPage() {
  const { patient, session } = useHospitalStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || !patient || !session || loading) return;

    const userMsg: ChatMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const assistantMsg: ChatMsg = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      await streamHospitalChat(patient._id, session._id, text, history, (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      });
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: 'Sorry, I ran into a problem. Please try again.' };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  if (!patient) return null;

  return (
    <HospitalLayout title="Ask Questions" subtitle={`${patient.name} · ${patient.diagnosis}`}>
      <div className={styles.chatShell}>
        {/* ── Quick questions ──────────────────────────────────────────── */}
        {messages.length === 0 && (
          <div className={styles.quickSection}>
            <div className={styles.quickTitle}>Common questions:</div>
            <div className={styles.quickList}>
              {QUICK_QUESTIONS.map(q => (
                <button key={q} className={styles.quickBtn} onClick={() => sendMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ─────────────────────────────────────────────────── */}
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.msgRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}>
              {msg.role === 'assistant' && (
                <div className={styles.aiAvatar}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
              )}
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
                {msg.content || (loading && i === messages.length - 1
                  ? <span className={styles.typing}><span /><span /><span /></span>
                  : ''
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ─────────────────────────────────────────────────────── */}
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your condition or recovery..."
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            disabled={loading}
          />
          <button
            className={styles.sendBtn}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </HospitalLayout>
  );
}
