/**
 * PlanHistory.tsx
 * Reusable history list component for assessments and plans.
 * Shows a list of past items with icon, summary, date, and a click handler.
 */

import styles from './PlanHistory.module.css';

export interface HistoryItem {
  _id: string;
  icon: string;
  title: string;
  subtitle: string;
  date: string;
}

interface Props {
  label: string;
  items: HistoryItem[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  emptyText?: string;
}

export function PlanHistory({ label, items, loading, onRefresh, onSelect, emptyText }: Props) {
  return (
    <div className={styles.historySection}>
      <div className={styles.historyHeader}>
        <h3 className={styles.historyTitle}>{label}</h3>
        <button className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div className={styles.emptyHistory}>
          {emptyText ?? 'No history yet. Your past records will appear here.'}
        </div>
      ) : (
        <div className={styles.historyList}>
          {items.map((item) => (
            <button
              key={item._id}
              className={styles.historyCard}
              onClick={() => onSelect(item._id)}
            >
              <span className={styles.cardIcon}>{item.icon}</span>
              <div className={styles.cardBody}>
                <p className={styles.cardSummary}>{item.title}</p>
                <p className={styles.cardMeta}>{item.subtitle} · {item.date}</p>
              </div>
              <svg className={styles.cardArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
