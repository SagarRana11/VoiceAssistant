import { useEffect, useRef, useState } from 'react';
import { AssistantState } from '../../types';
import { ConversationState } from '../../utils/emotionDetector';
import styles from './Avatar.module.css';

interface Props {
  state: AssistantState;
  roleColor: string;
  currentChunk?: string;
  conversationState?: ConversationState;
  didVideoRef?: React.RefObject<HTMLVideoElement>;
  didConnected?: boolean;
}

export function Avatar({
  state,
  roleColor,
  currentChunk,
  conversationState,
  didVideoRef,
  didConnected,
}: Props) {
  const mouthRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);

  // videoReady: true as soon as the video element has decodable frames.
  // Drives visibility independently of isConnected state, so a brief
  // isConnected toggle (e.g. React StrictMode cleanup) doesn't flash-hide the video.
  const [videoReady, setVideoReady] = useState(false);

  // When D-ID connects, ensure the video element actually plays (guards against
  // autoplay policy or a srcObject that was set before the element mounted).
  useEffect(() => {
    if (!didConnected || !didVideoRef?.current) return;
    const video = didVideoRef.current;
    if (video.srcObject && video.paused) {
      video.play().catch(err => console.warn('[DID] Avatar play retry failed:', err));
    }
  }, [didConnected, didVideoRef]);

  // Amplitude-driven mouth animation (only used when D-ID is not active)
  useEffect(() => {
    if (state !== 'speaking' || !currentChunk || didConnected) {
      cancelAnimationFrame(frameRef.current);
      if (mouthRef.current) mouthRef.current.style.setProperty('--amp', '0.3');
      return;
    }
    const animate = () => {
      phaseRef.current += 0.18;
      const amp =
        0.35 +
        0.35 * Math.sin(phaseRef.current) +
        0.15 * Math.sin(phaseRef.current * 2.3 + 1) +
        0.08 * Math.sin(phaseRef.current * 3.7 + 2);
      if (mouthRef.current)
        mouthRef.current.style.setProperty('--amp', String(Math.max(0.1, Math.min(1, amp))));
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [state, currentChunk, didConnected]);

  const energy = conversationState?.energy ?? 'medium';
  const energySpeed = energy === 'high' ? '0.35s' : energy === 'low' ? '0.65s' : '0.5s';

  return (
    <div className={styles.wrapper}>
      {/* Ambient glow */}
      <div
        className={`${styles.glowRing} ${styles[`glow_${state}`]}`}
        style={{ '--role-color': roleColor } as React.CSSProperties}
      />

      {/* ── Shared display area — D-ID video and SVG face occupy the same box ── */}
      <div
        className={`${styles.displayArea} ${styles[`display_${state}`]}`}
        style={{ '--role-color': roleColor, '--energy-speed': energySpeed } as React.CSSProperties}
      >
        {/* Pulse border ring (lives on displayArea) */}
        <div
          className={`${styles.pulseRing} ${styles[`pulse_${state}`]}`}
          style={{ '--role-color': roleColor } as React.CSSProperties}
        />

        {/* D-ID video — fades in when the element has actual decodable frames */}
        <video
          ref={didVideoRef}
          autoPlay
          playsInline
          onCanPlay={() => setVideoReady(true)}
          onEmptied={() => setVideoReady(false)}
          className={`${styles.didVideo} ${videoReady ? styles.didVideoActive : ''}`}
        />

        {/* SVG avatar face — fades out once video has real content */}
        <div className={`${styles.face} ${videoReady ? styles.faceHidden : ''}`}>
          {/* Thinking dots */}
          {state === 'thinking' && (
            <div className={styles.thinkingDots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
          )}
          <div className={styles.eyes}>
            <Eye state={state} delay="0s" />
            <Eye state={state} delay="0.07s" />
          </div>
          <div className={styles.nose} />
          <div className={styles.mouthArea}>
            <Mouth state={state} mouthRef={mouthRef} />
          </div>
        </div>

        {/* State badge — overlaid at the bottom of the display area */}
        <div
          className={`${styles.badge} ${styles[`badge_${state}`]}`}
          style={{ '--role-color': roleColor } as React.CSSProperties}
        >
          {STATE_LABELS[state]}
        </div>
      </div>
    </div>
  );
}

// ─── Eye ──────────────────────────────────────────────────────────────────────
function Eye({ state, delay }: { state: AssistantState; delay: string }) {
  return (
    <div className={`${styles.eye} ${state === 'listening' ? styles.eyeAlert : ''}`}>
      <div className={`${styles.pupil} ${state === 'thinking' ? styles.pupilThinking : ''}`} />
      <div
        className={`${styles.eyelid} ${
          state === 'thinking'
            ? styles.eyeClosed
            : state === 'speaking'
              ? styles.eyeSlowBlink
              : styles.eyeBlink
        }`}
        style={{ animationDelay: delay }}
      />
    </div>
  );
}

// ─── Mouth ────────────────────────────────────────────────────────────────────
function Mouth({
  state,
  mouthRef,
}: {
  state: AssistantState;
  mouthRef: React.RefObject<HTMLDivElement>;
}) {
  if (state === 'speaking')
    return (
      <div
        className={styles.mouthSpeaking}
        ref={mouthRef}
        style={{ '--amp': '0.3' } as React.CSSProperties}
      >
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className={styles.mouthBar}
            style={{ '--bar-i': i } as React.CSSProperties}
          />
        ))}
      </div>
    );
  if (state === 'listening') return <div className={styles.mouthListening} />;
  if (state === 'thinking') return <div className={styles.mouthThinking} />;
  return <div className={styles.mouthIdle} />;
}

const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};
