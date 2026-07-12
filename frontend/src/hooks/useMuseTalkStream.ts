/**
 * useMuseTalkStream.ts
 *
 * Local, API-key-free avatar option backed by the MuseTalk lip-sync server.
 * Implements the shared AvatarStream interface (same shape as D-ID / HeyGen).
 *
 * speak(text):
 *   text -> /api/tts (ElevenLabs WAV/MP3)
 *        -> /api/musetalk/lipsync (raw audio -> MuseTalk v1.5 -> MP4)
 *        -> play the MP4 in videoRef
 */

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AvatarStream } from './useDIDStream';

export function useMuseTalkStream(): AvatarStream {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const token = useAppStore(s => s.token);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  const auth = useCallback(
    () => ({ Authorization: `Bearer ${token ?? ''}` }),
    [token],
  );

  // ── CONNECT — probe the local MuseTalk server ────────────────────────────
  const connect = useCallback(async () => {
    try {
      const r = await fetch('/api/musetalk/health', { headers: auth() });
      const data = await r.json();
      const ok = r.ok && data?.enabled && data?.weights_present;
      setIsAvailable(!!ok);
      setIsConnected(true);
      if (!ok) console.warn('[MuseTalk] not ready:', data);
    } catch (err) {
      console.warn('[MuseTalk] connect failed:', err);
      setIsAvailable(false);
      setIsConnected(true);
    }
  }, [auth]);

  // ── SPEAK — TTS -> lipsync -> play ───────────────────────────────────────
  const speak = useCallback(
    async (text: string): Promise<void> => {
      try {
        // 1) text -> audio
        const ttsRes = await fetch('/api/tts', {
          method: 'POST',
          headers: { ...auth(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!ttsRes.ok) {
          console.warn('[MuseTalk] TTS failed', ttsRes.status);
          return;
        }
        const audio = await ttsRes.arrayBuffer();

        // 2) audio -> lip-synced video
        const vidRes = await fetch('/api/musetalk/lipsync', {
          method: 'POST',
          headers: { ...auth(), 'Content-Type': 'audio/mpeg' },
          body: audio,
        });
        if (!vidRes.ok) {
          console.warn('[MuseTalk] lipsync failed', vidRes.status);
          return;
        }

        // 3) play
        const blob = await vidRes.blob();
        const url = URL.createObjectURL(blob);
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = url;

        if (videoRef.current) {
          videoRef.current.src = url;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('[MuseTalk] speak error:', err);
      }
    },
    [auth],
  );

  // ── DISCONNECT ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    setIsConnected(false);
  }, []);

  return { videoRef, isAvailable, isConnected, connect, speak, disconnect };
}
