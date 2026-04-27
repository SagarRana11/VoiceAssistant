/**
 * useHeyGenVideo.ts
 *
 * Replaces sunset streaming-avatar SDK flow
 * Uses normal HeyGen Video Generation API
 */

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AvatarStream } from './useDIDStream';

export function useHeyGenStream(): AvatarStream {
  const [isAvailable, setIsAvailable] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const token = useAppStore(s => s.token);
  const videoRef = useRef<HTMLVideoElement>(null);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    }),
    [token],
  );

  // ─────────────────────────────
  // CONNECT
  // ─────────────────────────────
  const connect = useCallback(async () => {
    setIsConnected(true);
    setIsAvailable(true);
  }, []);

  // ─────────────────────────────
  // SPEAK => generate video
  // ─────────────────────────────
  const speak = useCallback(
    async (text: string): Promise<void> => {
      try {
        const r = await fetch('/api/heygen/generate', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ text }),
        });

        const data = await r.json();

        const videoId = data?.data?.video_id || data?.video_id || data?.id;

        if (!videoId) {
          console.warn('[HeyGen] No video_id', data);
          return;
        }

        // poll status
        let videoUrl = '';

        for (let i = 0; i < 30; i++) {
          await new Promise(res => setTimeout(res, 3000));

          const statusRes = await fetch(`/api/heygen/status/${videoId}`, {
            headers: authHeaders(),
          });

          const status = await statusRes.json();

          videoUrl = status?.data?.video_url || status?.video_url || '';

          const done = status?.data?.status === 'completed' || status?.status === 'completed';

          if (done && videoUrl) break;
        }

        if (!videoUrl) {
          console.warn('[HeyGen] Video generation timeout');
          return;
        }

        if (videoRef.current) {
          videoRef.current.src = videoUrl;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('[HeyGen] speak error:', err);
      }
    },
    [authHeaders],
  );

  // ─────────────────────────────
  // DISCONNECT
  // ─────────────────────────────
  const disconnect = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }

    setIsConnected(false);
  }, []);

  return {
    videoRef,
    isAvailable,
    isConnected,
    connect,
    speak,
    disconnect,
  };
}
