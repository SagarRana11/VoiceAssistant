/**
 * useSpeechQueue.ts — Reliable streaming-aware TTS queue
 *
 * Fixes applied:
 *  1. Chrome GC bug  — utterance stored in ref so it can't be collected mid-speech
 *  2. Chrome 15s bug — keepalive interval calls pause()/resume() every 10 s
 *  3. Clean cancel()  — cancels browser queue AND our internal queue atomically
 *  4. resetQueue()    — call before first enqueue() in a new turn (clears cancelled flag)
 *  5. Race-free drain — re-checks queue after loop exits in case items arrived late
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { humanizeText, splitIntoChunks } from '../utils/humanizer';
import {
  ConversationState,
  DEFAULT_STATE,
  getInterChunkPause,
  getSpeakingPitch,
  getSpeakingRate,
} from '../utils/emotionDetector';
import { speakWithElevenLabs } from '../services/elevenLabsService';
import { useAppStore } from '../store/useAppStore';

interface Return {
  isSpeaking:   boolean;
  isSupported:  boolean;
  currentChunk: string;
  enqueue:      (sentence: string, state?: ConversationState) => void;
  waitForDrain: () => Promise<void>;
  speak:        (text: string, state?: ConversationState, onEnd?: () => void) => Promise<void>;
  cancel:       () => void;
  resetQueue:   () => void;
}

export function useSpeechQueue(): Return {
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [currentChunk, setCurrentChunk] = useState('');

  const cancelledRef    = useRef(false);
  const isDrainingRef   = useRef(false);
  const queueRef        = useRef<string[]>([]);
  const stateRef        = useRef<ConversationState>(DEFAULT_STATE);
  const utteranceRef    = useRef<SpeechSynthesisUtterance | null>(null); // ← GC fix
  const audioRef        = useRef<HTMLAudioElement | null>(null);          // ← ElevenLabs audio
  const drainResolveRef = useRef<(() => void) | null>(null);
  const voiceRef        = useRef<SpeechSynthesisVoice | null>(null);

  const token        = useAppStore((s) => s.token);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // ── Voice selection ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupported) return;

    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      const n = (s = '') => s.toLowerCase();
      const preferred = voices.find(v =>
        n(v.name).includes('google hindi') ||        // Chrome Indian English
        n(v.name).includes('google ind')  ||         // Chrome fallback
        n(v.lang) === 'en-in'                        // any en-IN voice
      );
      const anyEnIN  = voices.find(v => n(v.lang).startsWith('en-in'));
      const localUS  = voices.find(v => n(v.lang).startsWith('en-us') && v.localService);
      const anyEnUS  = voices.find(v => n(v.lang).startsWith('en-us'));
      voiceRef.current = preferred ?? anyEnIN ?? localUS ?? anyEnUS ?? null;
      console.log('[TTS] voice selected:', voiceRef.current?.name ?? 'browser default', voiceRef.current?.lang);
    };

    pick();
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pick);
  }, [isSupported]);

  // ── Chrome 15-second keepalive ───────────────────────────────────────────────
  // Chrome silently stops speechSynthesis after ~15 s. pause()+resume() resets it.
  useEffect(() => {
    if (!isSupported) return;
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [isSupported]);

  const sanitize = (text: string) =>
    text.trim()
      .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '') // invisible chars
      .replace(/\.{3}/g, ', ') 
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim();


  const speakOne = useCallback(async (text: string): Promise<void> => {
    if (cancelledRef.current || !text.trim()) return;

    const clean = sanitize(text);
    if (!clean) return;

    // ── ElevenLabs path ──────────────────────────────────────────────────────
    if (token) {
      const audio = await speakWithElevenLabs(clean, token);
      if (audio && !cancelledRef.current) {
        audioRef.current = audio;
        return new Promise<void>((resolve) => {
          audio.onended = () => { audioRef.current = null; resolve(); };
          audio.onerror = () => { audioRef.current = null; resolve(); };
          audio.play().catch(() => { audioRef.current = null; resolve(); });
        });
      }
    }

    // ── Web Speech API fallback ──────────────────────────────────────────────
    if (cancelledRef.current) return;
    window.speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(clean);
      utteranceRef.current = u;

      const s = stateRef.current;
      u.rate   = getSpeakingRate(s);
      u.pitch  = getSpeakingPitch(s);
      u.volume = 1;
      if (voiceRef.current) u.voice = voiceRef.current;

      u.onend   = () => { utteranceRef.current = null; resolve(); };
      u.onerror = (e) => {
        utteranceRef.current = null;
        resolve();
        if (e.error !== 'interrupted') console.warn('[TTS] utterance error:', e.error);
      };

      window.speechSynthesis.speak(u);
    });
  }, [token]);

  // ── Internal drain loop ──────────────────────────────────────────────────────
  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current) return; // already running — enqueue() added to queueRef, loop will pick it up
    isDrainingRef.current = true;
    setIsSpeaking(true);

    while (queueRef.current.length > 0 && !cancelledRef.current) {
      const sentence = queueRef.current.shift()!;
      setCurrentChunk(sentence);
      await speakOne(sentence);

      if (!cancelledRef.current && queueRef.current.length > 0) {
        await sleep(getInterChunkPause(stateRef.current));
      }
    }

    // Race-condition guard: a new sentence may have arrived in the gap between
    // the while condition checking false and isDrainingRef being cleared.
    if (queueRef.current.length > 0 && !cancelledRef.current) {
      // Let the next tick pick it up cleanly
      setTimeout(() => { isDrainingRef.current = false; drainQueue(); }, 0);
      return;
    }

    isDrainingRef.current = false;
    setIsSpeaking(false);
    setCurrentChunk('');

    if (!cancelledRef.current && drainResolveRef.current) {
      drainResolveRef.current();
      drainResolveRef.current = null;
    }
  }, [speakOne]);

  // ── enqueue — add one sentence, start playback immediately if idle ───────────
  const enqueue = useCallback((sentence: string, state?: ConversationState) => {
    if (!sentence.trim()) return;
    // Voice disabled: skip TTS, resolve drain immediately so callers don't hang
    if (!voiceEnabled) {
      if (drainResolveRef.current) { drainResolveRef.current(); drainResolveRef.current = null; }
      return;
    }
    if (!isSupported || cancelledRef.current) return;
    if (state) stateRef.current = state;
    queueRef.current.push(sentence.trim());
    drainQueue();
  }, [voiceEnabled, isSupported, drainQueue]);

  // ── waitForDrain — resolves when queue is empty and audio has finished ────────
  const waitForDrain = useCallback((): Promise<void> =>
    new Promise((resolve) => {
      if (!isDrainingRef.current && queueRef.current.length === 0) {
        resolve();
      } else {
        drainResolveRef.current = resolve;
      }
    }),
  []);

  // ── speak — full-text mode: humanise → split → enqueue all chunks ─────────────
  const speak = useCallback(async (
    rawText: string,
    state?:  ConversationState,
    onEnd?:  () => void,
  ): Promise<void> => {
    if (!voiceEnabled || !isSupported || !rawText.trim()) { onEnd?.(); return; }

    cancelledRef.current  = false;
    isDrainingRef.current = false;
    queueRef.current      = [];
    drainResolveRef.current = null;
    window.speechSynthesis.cancel();

    if (state) stateRef.current = state;

    const humanized = humanizeText(rawText, true);
    const chunks    = splitIntoChunks(humanized);
    if (!chunks.length) { onEnd?.(); return; }

    queueRef.current = [...chunks];
    await drainQueue();
    onEnd?.();
  }, [voiceEnabled, isSupported, drainQueue]);

  // ── cancel — stop everything immediately ─────────────────────────────────────
  const cancel = useCallback(() => {
    cancelledRef.current    = true;
    isDrainingRef.current   = false;
    queueRef.current        = [];
    drainResolveRef.current = null;
    utteranceRef.current    = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentChunk('');
  }, [isSupported]);

  // ── resetQueue — call before first enqueue() of a new turn ───────────────────
  // cancel() sets cancelledRef=true; without this enqueue() would silently no-op.
  const resetQueue = useCallback(() => {
    cancelledRef.current    = false;
    isDrainingRef.current   = false;
    queueRef.current        = [];
    drainResolveRef.current = null;
  }, []);

  return { isSpeaking, isSupported, currentChunk, enqueue, waitForDrain, speak, cancel, resetQueue };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
