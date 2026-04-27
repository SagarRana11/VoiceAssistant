import { useState, useEffect } from 'react';
import { HospitalLayout }   from './HospitalLayout';
import { useHospitalStore } from '../../store/hospitalStore';
import { useAppStore }      from '../../store/useAppStore';
import { useDIDStream }     from '../../hooks/useDIDStream';
import { chatSync }         from '../../services/hospitalService';
import { speakWithElevenLabs } from '../../services/elevenLabsService';
import styles from './AvatarPage.module.css';

const GREETINGS = [
  "Hello! I'm your care assistant. How are you feeling today?",
  "Hi there! I'm here to answer any questions about your recovery.",
  "Welcome. I'm here to help you understand your condition and care plan.",
];

export function AvatarPage() {
  const { patient }         = useHospitalStore();
  const { token }           = useAppStore();
  const did                 = useDIDStream();
  const [input, setInput]   = useState('');
  const [status, setStatus] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [didReady, setDidReady]     = useState(false);

  // Connect D-ID on mount
  useEffect(() => {
    did.connect().then(() => {
      if (did.isConnected) setDidReady(true);
    });
    return () => did.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (did.isConnected && !didReady) setDidReady(true);
  }, [did.isConnected, didReady]);

  // Greet on load
  useEffect(() => {
    if (!patient) return;
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    setTimeout(() => speakResponse(greeting), 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient]);

  async function speakResponse(text: string) {
    setStatus('speaking');
    setTranscript(t => [...t, { role: 'assistant', text }]);

    if (did.isConnected) {
      await did.speak(text);
    } else {
      // Fallback: ElevenLabs or browser TTS
      const audio = token ? await speakWithElevenLabs(text, token) : null;
      if (audio) {
        await new Promise<void>(resolve => {
          audio.onended = () => resolve();
          audio.play();
        });
      } else {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate  = 0.9;
        utt.pitch = 1.0;
        await new Promise<void>(resolve => { utt.onend = () => resolve(); window.speechSynthesis.speak(utt); });
      }
    }
    setStatus('idle');
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !patient || status !== 'idle') return;

    setInput('');
    setTranscript(t => [...t, { role: 'user', text }]);
    setStatus('thinking');

    try {
      const response = await chatSync(patient._id, text);
      await speakResponse(response);
    } catch {
      setStatus('idle');
    }
  }

  if (!patient) return null;

  return (
    <HospitalLayout title="Voice Avatar" subtitle={`${patient.name} · ${patient.diagnosis}`}>
      <div className={styles.shell}>
        {/* ── Avatar panel ─────────────────────────────────────────────── */}
        <div className={styles.avatarPanel}>
          {did.isConnected ? (
            <video
              ref={did.videoRef}
              className={styles.didVideo}
              autoPlay
              playsInline
              muted={false}
            />
          ) : (
            <div className={`${styles.staticAvatar} ${status === 'speaking' ? styles.speaking : status === 'thinking' ? styles.thinking : ''}`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          )}
          <div className={styles.statusChip}>
            {status === 'idle'     && '● Ready'}
            {status === 'thinking' && '◌ Thinking...'}
            {status === 'speaking' && '◉ Speaking'}
          </div>
        </div>

        {/* ── Transcript ─────────────────────────────────────────────────── */}
        <div className={styles.transcriptPanel}>
          <div className={styles.transcriptTitle}>Conversation</div>
          <div className={styles.messages}>
            {transcript.length === 0 && (
              <div className={styles.emptyMsg}>The assistant will greet the patient shortly...</div>
            )}
            {transcript.map((m, i) => (
              <div key={i} className={`${styles.msgRow} ${m.role === 'user' ? styles.userRow : styles.aiRow}`}>
                <div className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* ── Input ─────────────────────────────────────────────────── */}
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a question..."
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={status !== 'idle'}
            />
            <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || status !== 'idle'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </HospitalLayout>
  );
}
