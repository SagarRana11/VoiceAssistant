import { HospitalLayout }  from './HospitalLayout';
import { useHospitalStore, HospitalPatient } from '../../store/hospitalStore';
import { useAppStore }     from '../../store/useAppStore';
import { markProcedureDone, getPatients, getSession } from '../../services/hospitalService';
import { useEffect, useState } from 'react';
import styles from './HospitalHomePage.module.css';

interface ModuleCard {
  id:       string;
  icon:     string;
  title:    string;
  desc:     string;
  color:    string;
  page:     string;
  disabled?: boolean;
}

export function HospitalHomePage() {
  const { patient, session, setPatient, setSession, clearPatient } = useHospitalStore();
  const { navigate } = useAppStore();
  const [markingDone, setMarkingDone] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [savedPatients, setSavedPatients] = useState<HospitalPatient[]>([]);

  useEffect(() => {
    if (!patient) {
      setLoadingPatients(true);
      getPatients()
        .then(({ patients }) => { setSavedPatients(patients); })
        .catch(console.error)
        .finally(() => setLoadingPatients(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoadPatient(p: NonNullable<typeof patient>) {
    setPatient(p);
    try {
      const { session: s } = await getSession(p._id);
      setSession(s);
    } catch { /* new patient — no session yet */ }
  }

  async function handleMarkProcedureDone() {
    if (!session) return;
    setMarkingDone(true);
    try {
      await markProcedureDone(session._id);
      setSession({ ...session, stage: 'procedure_done' });
    } catch { /* ignore */ }
    finally { setMarkingDone(false); }
  }

  if (!patient) {
    return (
      <HospitalLayout title="Hospital Assistant" showBack={false}>
        <div className={styles.noPatient}>
          <div className={styles.noPatientIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className={styles.noPatientTitle}>No patient enrolled</h2>
          <p className={styles.noPatientDesc}>Enroll a new patient to begin the cardiac care journey.</p>
          <button className={styles.enrollBtn} onClick={() => navigate('hospital')}>
            Enroll New Patient
          </button>

          {savedPatients.length > 0 && (
            <div className={styles.savedSection}>
              <div className={styles.savedLabel}>Or continue with a previous patient:</div>
              <div className={styles.savedList}>
                {savedPatients.map((p) => p && (
                  <button key={p._id} className={styles.savedCard} onClick={() => handleLoadPatient(p)}>
                    <span className={styles.savedName}>{p.name}</span>
                    <span className={styles.savedMeta}>{p.diagnosis} · Dr. {p.doctorName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {loadingPatients && <div className={styles.loading}>Loading patients...</div>}
        </div>
      </HospitalLayout>
    );
  }

  const cards: ModuleCard[] = [
    {
      id:    'consent',
      icon:  '📋',
      title: 'Consent Assistant',
      desc:  'Step-by-step education on diagnosis, procedure, benefits, and risks.',
      color: '#1a7fe8',
      page:  'hospital-consent',
      disabled: false,
    },
    {
      id:    'discharge',
      icon:  '🏠',
      title: 'Discharge Assistant',
      desc:  'Medicines, activity guidance, diet, and warning signs before going home.',
      color: '#0ea5a0',
      page:  'hospital-discharge',
      disabled: false,
    },
    {
      id:    'chat',
      icon:  '💬',
      title: 'Ask Questions',
      desc:  'Patient can ask anything about their condition, medicines, or recovery.',
      color: '#7c3aed',
      page:  'hospital-chat',
      disabled: false,
    },
    {
      id:    'followup',
      icon:  '📅',
      title: 'Follow-Up Check-In',
      desc:  'Day 1, 3, 7, and 30 follow-up symptom checks and recovery tracking.',
      color: '#d97706',
      page:  'hospital-followup',
      disabled: false,
    },
    {
      id:    'avatar',
      icon:  '🎙️',
      title: 'Voice Avatar',
      desc:  'Talk with the AI avatar — warm voice, face-to-face patient education.',
      color: '#dc2626',
      page:  'hospital-avatar',
      disabled: false,
    },
  ];

  const stageLabel: Record<string, string> = {
    enrolled:      'Enrolled',
    consent:       'Consent Done',
    procedure_done:'Procedure Complete',
    discharge:     'Discharge Done',
    followup:      'In Follow-Up',
  };

  return (
    <HospitalLayout title="Patient Dashboard" showBack={false}>
      {/* ── Patient summary card ──────────────────────────────────────── */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryLeft}>
          <div className={styles.avatar}>{patient.name.charAt(0)}</div>
          <div>
            <div className={styles.patientName}>{patient.name}</div>
            <div className={styles.patientMeta}>{patient.age} yrs · {patient.gender} · {patient.preferredLanguage}</div>
            <div className={styles.patientMeta}>Dr. {patient.doctorName || 'Not specified'} · {patient.riskFactors || 'No risk factors noted'}</div>
          </div>
        </div>
        <div className={styles.summaryRight}>
          <div className={styles.diagnosisBadge}>{patient.diagnosis}</div>
          <div className={styles.procedureBadge}>{patient.plannedProcedure}</div>
          {session && <div className={styles.stageBadge}>{stageLabel[session.stage] ?? session.stage}</div>}
        </div>
      </div>

      {/* ── Procedure done button ──────────────────────────────────────── */}
      {session && session.stage === 'consent' && !session.dischargeCompleted && (
        <div className={styles.procedureBar}>
          <div className={styles.procedureBarText}>
            Consent complete. Once the procedure is done, mark it to unlock Discharge Assistant.
          </div>
          <button className={styles.procedureDoneBtn} onClick={handleMarkProcedureDone} disabled={markingDone}>
            {markingDone ? 'Updating...' : 'Mark Procedure Done'}
          </button>
        </div>
      )}

      {/* ── Module cards ──────────────────────────────────────────────── */}
      <div className={styles.modulesGrid}>
        {cards.map((card) => (
          <button
            key={card.id}
            className={`${styles.moduleCard} ${card.disabled ? styles.moduleDisabled : ''}`}
            onClick={() => !card.disabled && navigate(card.page as Parameters<typeof navigate>[0])}
            disabled={card.disabled}
          >
            <div className={styles.moduleIcon} style={{ background: `${card.color}18`, color: card.color }}>
              {card.icon}
            </div>
            <div className={styles.moduleBody}>
              <div className={styles.moduleTitle}>{card.title}</div>
              <div className={styles.moduleDesc}>{card.desc}</div>
            </div>
            <div className={styles.moduleArrow} style={{ color: card.color }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* ── Change patient ─────────────────────────────────────────────── */}
      <div className={styles.changePatientRow}>
        <button className={styles.changePatientBtn} onClick={clearPatient}>Change Patient</button>
        <button className={styles.enrollNewBtn} onClick={() => navigate('hospital')}>Enroll New Patient</button>
      </div>
    </HospitalLayout>
  );
}
