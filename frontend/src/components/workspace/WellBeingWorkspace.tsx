import { useCallback, useEffect, useState } from 'react';
import { useAssistantContext } from '../../context/AssistantContext';
import { AssessmentOverlay } from '../Assessment/AssessmentOverlay';
import { AssessmentReport } from '../Assessment/AssessmentReport';
import { PlanHistory, HistoryItem } from '../PlanHistory/PlanHistory';
import { apiListReports, apiGetReport } from '../../services/apiService';
import styles from './FeatureWorkspace.module.css';

interface ReportSummary {
  _id: string;
  overallCategory: string;
  fullReport?: { overallSummary?: string };
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Needs Attention': '⚠️',
  Fair: '🌤',
  Good: '🌿',
  Thriving: '✨',
};

export function WellBeingWorkspace() {
  const { assessment } = useAssistantContext();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewingReport, setViewingReport] = useState<any>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { reports } = await apiListReports();
      setHistory(
        (reports as ReportSummary[]).map((r) => ({
          _id: r._id,
          icon: CATEGORY_ICONS[r.overallCategory] ?? '📊',
          title: r.overallCategory ?? 'Assessment',
          subtitle: r.fullReport?.overallSummary?.slice(0, 60) ?? 'Well-being report',
          date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }))
      );
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSelect = async (id: string) => {
    try {
      const { report } = await apiGetReport(id);
      setViewingReport(report);
    } catch {
      /* silent */
    }
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.emptyFeature}>
        <div className={styles.emptyIcon} aria-hidden="true">🧠</div>
        <h2 className={styles.emptyTitle}>Well Being Assessment</h2>
        <p className={styles.emptyDesc}>
          A structured voice-guided assessment across physical, mental, and emotional health domains.
          Takes around 10 minutes.
        </p>

        <div className={styles.assessmentMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>🎯</span>
            <span>3 health domains</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>⏱</span>
            <span>~10 minutes</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>📊</span>
            <span>Scored report</span>
          </div>
        </div>

        <button
          className={styles.primaryBtn}
          onClick={assessment.startAssessment}
          aria-label="Start Well-Being Assessment"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          Start Assessment
        </button>
      </div>

      <PlanHistory
        label="Assessment History"
        items={history}
        loading={loading}
        onRefresh={fetchHistory}
        onSelect={handleSelect}
        emptyText="No assessments yet. Complete one to see your history."
      />

      {/* Full-screen assessment overlay (fixed position, covers whole screen) */}
      {assessment.isActive && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <AssessmentOverlay {...(assessment as unknown as any)} />
      )}

      {/* View past report */}
      {viewingReport?.fullReport && (
        <div className={styles.overlayBackdrop}>
          <div className={styles.overlayPanel}>
            <AssessmentReport
              report={viewingReport.fullReport}
              physicalResult={viewingReport.physicalResult}
              mentalResult={viewingReport.mentalResult}
              emotionalResult={viewingReport.emotionalResult}
              assessmentId={viewingReport._id}
              onClose={() => setViewingReport(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
