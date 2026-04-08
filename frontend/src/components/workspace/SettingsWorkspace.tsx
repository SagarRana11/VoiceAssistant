import { useAppStore } from '../../store/useAppStore';
import { ROLES } from '../../constants/roles';
import styles from './FeatureWorkspace.module.css';

export function SettingsWorkspace() {
  const { currentRole, voiceEnabled, toggleVoice, setRole } = useAppStore();
  const role = ROLES[currentRole];

  return (
    <div className={styles.workspace}>
      <div className={styles.settingsCard}>
        <div className={styles.settingsHeader}>
          <span aria-hidden="true">⚙️</span>
          <h2 className={styles.emptyTitle}>Settings</h2>
        </div>

        {/* Voice mode */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Voice Mode</span>
            <span className={styles.settingDesc}>Enable mic input and text-to-speech</span>
          </div>
          <button
            className={`${styles.toggle} ${voiceEnabled ? styles.toggleOn : ''}`}
            onClick={toggleVoice}
            role="switch"
            aria-checked={voiceEnabled}
            aria-label="Toggle voice mode"
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>

        {/* Active role */}
        <div className={styles.settingSection}>
          <p className={styles.settingSectionTitle}>Active AI Role</p>
          <div className={styles.roleGrid}>
            {Object.values(ROLES).map((r) => (
              <button
                key={r.id}
                className={`${styles.roleChip} ${currentRole === r.id ? styles.roleChipActive : ''}`}
                style={{ '--role-color': r.color } as React.CSSProperties}
                onClick={() => setRole(r.id)}
                aria-pressed={currentRole === r.id}
              >
                <span>{r.icon}</span>
                <span className={styles.roleChipName}>{r.name}</span>
              </button>
            ))}
          </div>
          <p className={styles.activeRoleDesc}>
            <strong style={{ color: role.color }}>{role.name}</strong> — {role.tone}
          </p>
        </div>
      </div>
    </div>
  );
}
