import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useLayoutStore } from '../../store/useLayoutStore';
import { ROLES } from '../../constants/roles';
import type { Message } from '../../types';
import styles from './ConversationPanel.module.css';

interface Props {
  streamingResponse: string;
  agentStreamingResponse: string;
  interimTranscript: string;
}

export function ConversationPanel({
  streamingResponse,
  agentStreamingResponse,
  interimTranscript,
}: Props) {
  const { messages, currentRole, clearSession } = useAppStore();
  const { conversationPanelCollapsed, toggleConversationPanel } = useLayoutStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const role = ROLES[currentRole];
  const activeStreaming = streamingResponse || agentStreamingResponse;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, activeStreaming, interimTranscript]);

  const isEmpty = messages.length === 0 && !activeStreaming && !interimTranscript;

  return (
    <aside
      className={`${styles.panel} ${conversationPanelCollapsed ? styles.collapsed : ''}`}
      aria-label="Conversation history"
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button
          className={styles.collapseBtn}
          onClick={toggleConversationPanel}
          aria-label={conversationPanelCollapsed ? 'Expand conversation' : 'Collapse conversation'}
          title={conversationPanelCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {conversationPanelCollapsed
              ? <path d="M15 18l-6-6 6-6" />
              : <path d="M9 18l6-6-6-6" />}
          </svg>
        </button>

        {!conversationPanelCollapsed && (
          <>
            <span className={styles.title}>Conversation</span>
            {messages.length > 0 && (
              <span className={styles.badge}>{messages.length}</span>
            )}
            <div className={styles.headerActions}>
              {messages.length > 0 && (
                <button
                  className={styles.clearBtn}
                  onClick={clearSession}
                  aria-label="Clear conversation"
                  title="Clear"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Message body ─────────────────────────────────────────────── */}
      {!conversationPanelCollapsed && (
        <div className={styles.body}>
          {isEmpty ? (
            <EmptyState />
          ) : (
            <div className={styles.messages}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} roleColor={role.color} />
              ))}

              {/* Live streaming assistant response */}
              {activeStreaming && (
                <div
                  className={`${styles.bubble} ${styles.assistant}`}
                  style={{ '--role-color': role.color } as React.CSSProperties}
                >
                  <div className={styles.bubbleAvatar}>AI</div>
                  <div className={styles.bubbleContent}>
                    <p className={styles.bubbleText}>{activeStreaming}</p>
                    <span className={styles.cursor} aria-hidden="true" />
                  </div>
                </div>
              )}

              {/* Interim user speech */}
              {interimTranscript && (
                <div className={`${styles.bubble} ${styles.user} ${styles.interim}`}>
                  <div className={styles.bubbleContent}>
                    <p className={styles.bubbleText}>{interimTranscript}</p>
                  </div>
                </div>
              )}

              <div ref={bottomRef} className={styles.scrollAnchor} />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon} aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className={styles.emptyTitle}>No messages yet</p>
      <p className={styles.emptyHint}>Start talking to see your conversation here.</p>
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
      {!isUser && <div className={styles.bubbleAvatar}>AI</div>}
      <div className={styles.bubbleContent}>
        <p className={styles.bubbleText}>{message.content}</p>
        <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
