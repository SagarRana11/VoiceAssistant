import { useCallback } from 'react';
import { useLayoutStore, FeatureId } from '../../store/useLayoutStore';
import { useAppStore } from '../../store/useAppStore';
import styles from './Sidebar.module.css';
import hospitalStyles from './Sidebar.hospital.module.css';

interface NavItem {
  id: FeatureId;
  icon: string;
  label: string;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'talk',       icon: '🎙️', label: 'Talk With Me',         shortcut: '1' },
  { id: 'wellbeing',  icon: '🧠', label: 'Well Being',            shortcut: '2' },
  { id: 'exercise',   icon: '💪', label: 'Exercise Planner',      shortcut: '3' },
  { id: 'diet',       icon: '🥗', label: 'Diet Planner',          shortcut: '4' },
  { id: 'meditation', icon: '🧘', label: 'Meditation',            shortcut: '5' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'profile',  icon: '👤', label: 'Profile'  },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export function Sidebar() {
  const { activeFeature, sidebarCollapsed, setActiveFeature, toggleSidebar } = useLayoutStore();
  const { user, logout, navigate } = useAppStore();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const map: Record<string, FeatureId> = {
        '1': 'talk', '2': 'wellbeing', '3': 'exercise', '4': 'diet', '5': 'meditation',
      };
      if (map[e.key]) setActiveFeature(map[e.key]);
    },
    [setActiveFeature],
  );

  return (
    <aside
      className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}
      role="navigation"
      aria-label="Feature navigation"
      onKeyDown={handleKeyDown}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className={styles.brand}>
        <div className={styles.brandIcon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className={styles.brandText}>
            <span className={styles.brandName}>AI Health</span>
            <span className={styles.brandSub}>Agent</span>
          </div>
        )}
        <button
          className={styles.toggleBtn}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {sidebarCollapsed
              ? <path d="M9 18l6-6-6-6" />
              : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </button>
      </div>

      {/* ── Main nav ──────────────────────────────────────────────────── */}
      <nav className={styles.nav} aria-label="Main features">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeFeature === item.id}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveFeature(item.id)}
          />
        ))}
      </nav>

      {/* ── Hospital shortcut ────────────────────────────────────────── */}
      <div className={styles.bottom} style={{ paddingTop: 0 }}>
        <button
          className={hospitalStyles.hospitalBtn}
          onClick={() => navigate('hospital')}
          title="Hospital Cardiac Assistant"
        >
          <span className={hospitalStyles.hospitalIcon}>🏥</span>
          {!sidebarCollapsed && <span className={hospitalStyles.hospitalLabel}>Hospital Assistant</span>}
        </button>
      </div>

      {/* ── Bottom section ────────────────────────────────────────────── */}
      <div className={styles.bottom}>
        <div className={styles.divider} role="separator" />
        {BOTTOM_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeFeature === item.id}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveFeature(item.id)}
          />
        ))}

        <div className={styles.divider} role="separator" />

        {/* User row */}
        <div
          className={`${styles.userRow} ${sidebarCollapsed ? styles.userRowCollapsed : ''}`}
          title={sidebarCollapsed ? `${user?.name} — Logout` : undefined}
        >
          <div className={styles.userAvatar} aria-hidden="true">
            {user?.initials ?? '?'}
          </div>
          {!sidebarCollapsed && (
            <>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.name}</span>
                <span className={styles.userEmail}>{user?.email}</span>
              </div>
              <button
                className={styles.logoutBtn}
                onClick={logout}
                aria-label="Log out"
                title="Log out"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          )}
          {sidebarCollapsed && (
            <button
              className={styles.logoutBtnCollapsed}
              onClick={logout}
              aria-label="Log out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${styles.navItem} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      tabIndex={0}
    >
      {isActive && <span className={styles.activeBar} aria-hidden="true" />}
      <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
      {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
      {!collapsed && item.shortcut && (
        <kbd className={styles.kbd} aria-label={`Shortcut: ${item.shortcut}`}>
          {item.shortcut}
        </kbd>
      )}
    </button>
  );
}
