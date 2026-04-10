import { Sidebar } from '../Sidebar/Sidebar';
import { ConversationPanel } from '../ConversationPanel/ConversationPanel';
import { WorkspaceRouter } from '../workspace/WorkspaceRouter';
import { GlobalInputBar } from '../GlobalInputBar/GlobalInputBar';
import type { CollectFieldSpec } from '../../hooks/useAgentConversation';
import styles from './AppLayout.module.css';

interface Props {
  streamingResponse: string;
  agentStreamingResponse: string;
  interimTranscript: string;
  onGlobalSubmit: (message: string, mode: 'voice' | 'text') => Promise<void>;
  collectAllFields: CollectFieldSpec[] | null;
  onSubmitBulkFields: (fields: Record<string, string>) => Promise<void>;
  isAgentThinking: boolean;
}

/**
 * 3-panel AI OS layout:
 *  [Sidebar] [Workspace + GlobalInputBar] [ConversationPanel]
 */
export function AppLayout({
  streamingResponse,
  agentStreamingResponse,
  interimTranscript,
  onGlobalSubmit,
  collectAllFields,
  onSubmitBulkFields,
  isAgentThinking,
}: Props) {
  return (
    <div className={styles.shell}>
      {/* ── Left: Feature navigation ─────────────────────────────────── */}
      <Sidebar />

      {/* ── Centre: Dynamic workspace ─────────────────────────────────── */}
      <main className={styles.workspaceCol} aria-label="Workspace">
        {/* Scrollable workspace content */}
        <div className={styles.workspaceInner}>
          <WorkspaceRouter />
        </div>

        {/* Floating input bar — absolute within workspace column */}
        <div className={styles.inputBarSlot}>
          <GlobalInputBar onSubmit={onGlobalSubmit} />
        </div>
      </main>

      {/* ── Right: Conversation panel ─────────────────────────────────── */}
      <ConversationPanel
        streamingResponse={streamingResponse}
        agentStreamingResponse={agentStreamingResponse}
        interimTranscript={interimTranscript}
        collectAllFields={collectAllFields}
        onSubmitBulkFields={onSubmitBulkFields}
        isAgentThinking={isAgentThinking}
      />
    </div>
  );
}
