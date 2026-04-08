import { useEffect, useRef } from 'react';
import { Message } from '../../types';
import styles from './Transcript.module.css';

interface Props {
  messages: Message[];
  streamingResponse: string;
  interimTranscript: string;
  roleColor: string;
}

export function Transcript({
  messages,
  streamingResponse,
  interimTranscript,
  roleColor,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, streamingResponse, interimTranscript]);

  const isEmpty = messages.length === 0 && !streamingResponse && !interimTranscript;

  return (
    <div className={styles.container}>
      {isEmpty ? (
        <div className={styles.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p>Your conversation will appear here.</p>
          <p>Press <strong>Talk With Me</strong> to start.</p>
        </div>
      ) : (
        <div className={styles.messages}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} roleColor={roleColor} />
          ))}

          {/* Live streaming assistant response */}
          {streamingResponse && (
            <div className={`${styles.bubble} ${styles.assistant}`}
              style={{ '--role-color': roleColor } as React.CSSProperties}
            >
              <div className={styles.avatar}>AI</div>
              <div className={styles.content}>
                <p className={styles.text}>{streamingResponse}</p>
                <span className={styles.cursor} />
              </div>
            </div>
          )}

          {/* Live interim user transcript */}
          {interimTranscript && (
            <div className={`${styles.bubble} ${styles.user} ${styles.interim}`}>
              <div className={styles.content}>
                <p className={styles.text}>{interimTranscript}</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  roleColor,
}: {
  message: Message;
  roleColor: string;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}
      style={{ '--role-color': roleColor } as React.CSSProperties}
    >
      {!isUser && <div className={styles.avatar}>AI</div>}
      <div className={styles.content}>
        <p className={styles.text}>{message.content}</p>
        <span className={styles.timestamp}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
