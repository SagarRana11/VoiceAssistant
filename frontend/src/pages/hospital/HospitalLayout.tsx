import { useAppStore } from '../../store/useAppStore';
import { useHospitalStore } from '../../store/hospitalStore';
import styles from './HospitalLayout.module.css';

interface Props {
  children:   React.ReactNode;
  title?:     string;
  subtitle?:  string;
  showBack?:  boolean;
  backLabel?: string;
  onBack?:    () => void;
  fullWidth?: boolean;
}

export function HospitalLayout({ children, title, subtitle, showBack = true, backLabel = 'Back', onBack, fullWidth = false }: Props) {
  const { navigate } = useAppStore();
  const { patient }  = useHospitalStore();

  const handleBack = onBack ?? (() => navigate('hospital'));

  return (
    <div className={styles.shell}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div className={styles.headerTitle}>{title ?? 'Hospital Assistant'}</div>
            {subtitle && <div className={styles.headerSub}>{subtitle}</div>}
          </div>
        </div>

        <div className={styles.headerRight}>
          {patient && (
            <div className={styles.patientChip}>
              <span className={styles.patientDot} />
              {patient.name} · {patient.diagnosis}
            </div>
          )}
          <button
            className={styles.mainMenuBtn}
            onClick={() => navigate('assistant')}
            title="Back to main app"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Main App
          </button>
        </div>
      </header>

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      {showBack && (
        <div className={styles.breadcrumb}>
          <button className={styles.backBtn} onClick={handleBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            {backLabel}
          </button>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className={fullWidth ? styles.contentFull : styles.content}>
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <span>This assistant provides educational information only. Always follow your doctor's advice.</span>
      </footer>
    </div>
  );
}
