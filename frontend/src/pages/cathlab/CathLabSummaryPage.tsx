import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useCathLabStore } from '../../store/cathLabStore';
import { getCathLabSummary } from '../../services/cathLabService';
import { CathLabLayout } from './CathLabLayout';
import styles from './CathLabSummaryPage.module.css';

// ─── Field label maps ────────────────────────────────────────────────────────

const MODULE2_FIELDS: [string, string][] = [
  ['chiefComplaint', 'Chief Complaint'],
  ['painCharacter', 'Pain Character'],
  ['painLocation', 'Location'],
  ['painRadiation', 'Radiation'],
  ['painSeverity', 'Severity (0–10)'],
  ['onset', 'Onset'],
  ['durationPerEpisode', 'Duration per Episode'],
  ['exertionalVsRest', 'Exertional vs. Rest'],
  ['exertionalQuantified', 'Exertional Tolerance'],
  ['relievingFactors', 'Relieving Factors'],
  ['aggravatingFactors', 'Aggravating Factors'],
  ['dyspnea', 'Dyspnea'],
  ['orthopnea', 'Orthopnea'],
  ['pnd', 'PND'],
  ['edema', 'Edema'],
  ['palpitations', 'Palpitations'],
  ['presyncope', 'Presyncope'],
  ['syncope', 'Syncope'],
  ['fatigue', 'Fatigue'],
];

const MODULE3_FIELDS: [string, string][] = [
  ['htn', 'Hypertension'],
  ['hyperlipidemia', 'Hyperlipidemia'],
  ['diabetes', 'Diabetes'],
  ['knownCAD', 'Known CAD'],
  ['priorMI', 'Prior MI'],
  ['priorPCI_CABG', 'Prior PCI / CABG'],
  ['heartFailure', 'Heart Failure'],
  ['priorCath', 'Prior Catheterization'],
  ['cva_tia', 'CVA / TIA'],
  ['ckd', 'CKD'],
  ['pad', 'PAD'],
  ['thyroidDisease', 'Thyroid Disease'],
  ['bleedingHistory', 'Bleeding History'],
  ['tobacco', 'Tobacco Use'],
  ['diet', 'Diet'],
  ['exercise', 'Exercise'],
  ['alcohol', 'Alcohol Use'],
  ['recreationalDrugUse', 'Recreational Drug Use'],
  ['familyHistory', 'Family History'],
  ['ros_constitutional', 'Constitutional'],
  ['ros_neuro', 'Neurological'],
  ['ros_pulmonary', 'Pulmonary'],
  ['ros_gi', 'GI'],
  ['ros_gu', 'GU'],
  ['ros_msk', 'MSK'],
  ['ros_heme', 'Hematologic'],
  ['ros_endocrine', 'Endocrine'],
  ['additionalConcerns', 'Additional Concerns'],
];

const MODULE4_FIELDS: [string, string][] = [
  ['medications', 'Medications'],
  ['anticoagulants', 'Anticoagulants / Blood Thinners'],
  ['pde5Inhibitors', 'PDE5 Inhibitors'],
  ['allergies', 'Allergies'],
  ['contrastAllergy', 'Contrast / Iodine Allergy'],
];

const MODULE5_FIELDS: [string, string][] = [
  ['echoResults', 'Echocardiogram'],
  ['stressTestResults', 'Stress Test'],
  ['cctaResults', 'Coronary CTA / Calcium Score'],
  ['labConcerns', 'Lab Concerns'],
];

const MODULE6_FIELDS: [string, string][] = [
  ['patientConcerns', 'Patient Concerns / Questions'],
  ['verbalConsent', 'Verbal Consent'],
];

interface ModuleSection {
  module: number;
  label: string;
  fields: [string, string][];
}

const MODULES: ModuleSection[] = [
  { module: 2, label: 'Chief Complaint & Chest Pain', fields: MODULE2_FIELDS },
  { module: 3, label: 'Medical History, Risk Factors & ROS', fields: MODULE3_FIELDS },
  { module: 4, label: 'Medications & Allergies', fields: MODULE4_FIELDS },
  { module: 5, label: 'Prior Non-Invasive Testing', fields: MODULE5_FIELDS },
  { module: 6, label: 'Education & Consent', fields: MODULE6_FIELDS },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CathLabSummaryPage() {
  const { navigate } = useAppStore();
  const { patient, session, hpRecord, flags, clearAll } = useCathLabStore();

  const [remoteRecord, setRemoteRecord] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch authoritative summary from backend (catches fields set after last render)
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    getCathLabSummary(session._id)
      .then(({ hpRecord: rec }) => setRemoteRecord(rec as Record<string, string>))
      .catch(() => setRemoteRecord(null))
      .finally(() => setLoading(false));
  }, [session]);

  const record = remoteRecord ?? (hpRecord as Record<string, string>);

  function getField(key: string): string {
    return (record?.[key] ?? '') as string;
  }

  function handleNewInterview() {
    clearAll();
    navigate('cathlab');
  }

  return (
    <CathLabLayout
      title="H&P Summary"
      subtitle="Pre-Procedural Interview Complete"
      onBack={() => navigate('assistant')}
    >
      <div className={styles.page}>
        {/* ─── Patient banner ─────────────────────────────────────────────── */}
        <div className={styles.patientBanner}>
          <div className={styles.patientInfo}>
            <div className={styles.patientName}>{patient?.patientName ?? '—'}</div>
            <div className={styles.patientMeta}>
              {patient?.dob && <span>DOB: {patient.dob}</span>}
              {patient?.mrn && <span>MRN: {patient.mrn}</span>}
              {patient?.procedureDate && <span>Procedure: {patient.procedureDate}</span>}
            </div>
          </div>
          <div className={styles.bannerActions}>
            <button className={styles.printBtn} onClick={() => window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print
            </button>
            <button className={styles.newBtn} onClick={handleNewInterview}>
              New Interview
            </button>
          </div>
        </div>

        {/* ─── Clinical flags ──────────────────────────────────────────────── */}
        {flags.length > 0 && (
          <div className={styles.flagsCard}>
            <div className={styles.flagsTitle}>
              <span>⚠</span>
              Clinical Alerts ({flags.length})
            </div>
            {flags.map((f, i) => (
              <div key={i} className={styles.flagItem}>
                <div className={styles.flagType}>{f.type.replace(/_/g, ' ').toUpperCase()}</div>
                <div className={styles.flagMsg}>{f.message}</div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className={styles.loadingMsg}>Loading complete H&P record…</div>
        )}

        {/* ─── Module sections ─────────────────────────────────────────────── */}
        {MODULES.map(mod => {
          const populated = mod.fields.filter(([key]) => !!getField(key));
          return (
            <div key={mod.module} className={styles.moduleCard}>
              <div className={styles.moduleHeader}>
                <div className={styles.moduleNum}>{mod.module}</div>
                <div className={styles.moduleTitle}>{mod.label}</div>
                <div className={styles.moduleBadge}>
                  {populated.length} / {mod.fields.length} captured
                </div>
              </div>

              {populated.length === 0 ? (
                <div className={styles.emptyModule}>No data captured for this module.</div>
              ) : (
                <div className={styles.fieldGrid}>
                  {mod.fields.map(([key, label]) => {
                    const val = getField(key);
                    if (!val) return null;
                    return (
                      <div key={key} className={styles.fieldRow}>
                        <div className={styles.fieldLabel}>{label}</div>
                        <div className={styles.fieldValue}>{val}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CathLabLayout>
  );
}
