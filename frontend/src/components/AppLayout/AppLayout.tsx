import { Sidebar } from '../Sidebar/Sidebar';
import { CodeChat } from '../CodeChat/CodeChat';
import { WorkspaceRouter } from '../workspace/WorkspaceRouter';
import { GlobalInputBar } from '../GlobalInputBar/GlobalInputBar';
import styles from './AppLayout.module.css';

interface Props {
  onGlobalSubmit: (message: string, mode: 'voice' | 'text') => Promise<void>;
}

/**
 * AI OS layout:
 *  [Sidebar] [Workspace + GlobalInputBar]  + floating CodeChat (bottom-right)
 */
export function AppLayout({ onGlobalSubmit }: Props) {
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

      {/* ── Floating code chat (bottom-right) ─────────────────────────── */}
      <CodeChat />
    </div>
  );
}
