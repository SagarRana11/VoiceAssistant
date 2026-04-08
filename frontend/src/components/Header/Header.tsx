import { User, RoleId, AppPage } from '../../types';
import { RoleSelector } from '../RoleSelector/RoleSelector';
import styles from './Header.module.css';

interface Props {
  user: User;
  currentRole: RoleId;
  currentPage: AppPage;
  voiceEnabled: boolean;
  onRoleChange: (role: RoleId) => void;
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
  onToggleVoice: () => void;
  isSessionActive: boolean;
}

export function Header({
  user,
  currentRole,
  currentPage,
  voiceEnabled,
  onRoleChange,
  onLogout,
  onNavigate,
  onToggleVoice,
  isSessionActive,
}: Props) {
  return (
    <header className={styles.header}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        </div>
        <span className={styles.logoText}>VoiceAI</span>
      </div>

      {/* Center — role selector (only on assistant page) */}
      <div className={styles.center}>
        {currentPage === 'assistant' && (
          <>
            <RoleSelector
              currentRole={currentRole}
              onChange={onRoleChange}
              disabled={isSessionActive}
            />
            {isSessionActive && (
              <span className={styles.sessionNote}>
                End session to change role
              </span>
            )}
          </>
        )}
      </div>

      {/* Right — voice toggle + profile nav + user chip + logout */}
      <div className={styles.right}>
        {/* Voice on/off toggle */}
        <button
          className={`${styles.voiceToggle} ${!voiceEnabled ? styles.voiceToggleOff : ''}`}
          onClick={onToggleVoice}
          title={voiceEnabled ? 'Switch to chat-only mode' : 'Switch to voice mode'}
        >
          {voiceEnabled ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>Voice On</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>Voice Off</span>
            </>
          )}
        </button>

        <button
          className={`${styles.profileBtn} ${currentPage === 'profile' ? styles.profileBtnActive : ''}`}
          onClick={() => onNavigate(currentPage === 'profile' ? 'assistant' : 'profile')}
          title="Health Profile"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profile</span>
        </button>

        <div className={styles.userChip}>
          <div className={styles.initials}>{user.initials}</div>
          <span className={styles.userName}>{user.name}</span>
        </div>
        <button className={styles.logoutBtn} onClick={onLogout} aria-label="Log out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </header>
  );
}
