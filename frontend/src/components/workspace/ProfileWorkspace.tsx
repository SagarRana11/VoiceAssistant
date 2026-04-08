import { useAppStore } from '../../store/useAppStore';
import styles from './FeatureWorkspace.module.css';

export function ProfileWorkspace() {
  const { navigate } = useAppStore();

  return (
    <div className={styles.workspace}>
      <div className={styles.emptyFeature}>
        <div className={styles.emptyIcon} aria-hidden="true">👤</div>
        <h2 className={styles.emptyTitle}>Your Health Profile</h2>
        <p className={styles.emptyDesc}>
          Keep your health profile up to date so the AI can give you accurate, personalised plans
          and advice tailored to your body and goals.
        </p>
        <div className={styles.assessmentMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>📏</span>
            <span>Body metrics</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>🎯</span>
            <span>Fitness goals</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>🏥</span>
            <span>Health conditions</span>
          </div>
        </div>
        <button
          className={styles.primaryBtn}
          onClick={() => navigate('profile')}
          aria-label="Open profile editor"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Profile
        </button>
      </div>
    </div>
  );
}
