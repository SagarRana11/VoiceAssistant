import { useState, useRef, useEffect } from 'react';
import { HospitalLayout }   from './HospitalLayout';
import { useHospitalStore } from '../../store/hospitalStore';
import { getFollowupQuestions, streamFollowup } from '../../services/hospitalService';
import styles from './FollowupPage.module.css';

const DAYS = [1, 3, 7, 30];

export function FollowupPage() {
  const { patient, session } = useHospitalStore();
  const [selectedDay, setSelectedDay]   = useState(1);
  const [questions,   setQuestions]     = useState<string[]>([]);
  const [responses,   setResponses]     = useState<Record<string, string>>({});
  const [aiResponse,  setAiResponse]    = useState('');
  const [loading,     setLoading]       = useState(false);
  const [submitted,   setSubmitted]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuestions([]);
    setResponses({});
    setAiResponse('');
    setSubmitted(false);
    getFollowupQuestions(selectedDay)
      .then(({ questions: qs }) => setQuestions(qs))
      .catch(console.error);
  }, [selectedDay]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiResponse]);

  async function handleSubmit() {
    if (!patient || !session) return;
    setLoading(true);
    setAiResponse('');
    try {
      await streamFollowup(patient._id, session._id, selectedDay, responses, (chunk) => {
        setAiResponse(prev => prev + chunk);
      });
      setSubmitted(true);
    } catch {
      setAiResponse('Sorry, I ran into a problem. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const allAnswered = questions.length > 0 && questions.every(q => responses[q]?.trim());

  if (!patient) return null;

  return (
    <HospitalLayout title="Follow-Up Check-In" subtitle={`${patient.name} · Post-discharge`}>
      {/* ── Day selector ─────────────────────────────────────────────── */}
      <div className={styles.daySelector}>
        {DAYS.map(d => (
          <button
            key={d}
            className={`${styles.dayBtn} ${selectedDay === d ? styles.dayActive : ''}`}
            onClick={() => setSelectedDay(d)}
          >
            Day {d}
          </button>
        ))}
      </div>

      {/* ── Questions form ────────────────────────────────────────────── */}
      {!submitted ? (
        <div className={styles.formCard}>
          <div className={styles.formTitle}>Day {selectedDay} Check-In Questions</div>
          {questions.length === 0
            ? <div className={styles.loadingQs}>Loading questions...</div>
            : questions.map((q) => (
              <div key={q} className={styles.questionBlock}>
                <div className={styles.questionText}>{q}</div>
                <div className={styles.answerBtns}>
                  {['Yes', 'No', 'Not Sure'].map(opt => (
                    <button
                      key={opt}
                      className={`${styles.answerBtn} ${responses[q] === opt ? styles.answerSelected : ''}`}
                      onClick={() => setResponses(r => ({ ...r, [q]: opt }))}
                    >
                      {opt}
                    </button>
                  ))}
                  <input
                    className={styles.answerInput}
                    placeholder="Or type your answer..."
                    value={!['Yes','No','Not Sure'].includes(responses[q] ?? '') ? (responses[q] ?? '') : ''}
                    onChange={e => setResponses(r => ({ ...r, [q]: e.target.value }))}
                  />
                </div>
              </div>
            ))
          }
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={!allAnswered || loading}
          >
            {loading ? 'Analysing...' : 'Submit Check-In'}
          </button>
        </div>
      ) : (
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>
            <span className={styles.summaryIcon}>✓</span>
            Day {selectedDay} Check-In Summary
          </div>
          {loading && !aiResponse && (
            <div className={styles.thinking}>
              <span /><span /><span />
            </div>
          )}
          {aiResponse && <p className={styles.summaryText}>{aiResponse}</p>}
          <div ref={bottomRef} />
          <button className={styles.checkAnotherBtn} onClick={() => { setSubmitted(false); setAiResponse(''); setResponses({}); }}>
            Check Another Day
          </button>
        </div>
      )}
    </HospitalLayout>
  );
}
