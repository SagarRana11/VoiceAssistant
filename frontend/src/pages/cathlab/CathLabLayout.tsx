import styles from './CathLabLayout.module.css';

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

export function CathLabLayout({ children, title, subtitle, onBack }: Props) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🫀</span>
            <div>
              <div className={styles.brandName}>Mount Sinai</div>
              <div className={styles.brandSub}>Cardiac Catheterization Lab</div>
            </div>
          </div>
        </div>
        {(title || subtitle) && (
          <div className={styles.headerCenter}>
            {title && <div className={styles.pageTitle}>{title}</div>}
            {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
          </div>
        )}
        <div className={styles.headerRight}>
          <div className={styles.avatarBadge}>Sofiya · NP</div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <span>Mount Sinai Health System · Cardiac Catheterization Laboratory</span>
        <span>This interview is conducted by a virtual care team member. All data is securely stored.</span>
      </footer>
    </div>
  );
}
