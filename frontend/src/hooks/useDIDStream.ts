/**
 * useDIDStream.ts — D-ID WebRTC streaming hook
 */
import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

const DID_VOICE = { type: 'microsoft' as const, voice_id: 'en-IN-NeerjaNeural' };

interface DIDStream {
  videoRef:    React.RefObject<HTMLVideoElement>;
  isAvailable: boolean;
  isConnected: boolean;
  connect:     () => Promise<void>;
  speak:       (text: string) => Promise<void>;
  disconnect:  () => void;
}

export function useDIDStream(): DIDStream {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const token        = useAppStore((s) => s.token);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const peerRef      = useRef<RTCPeerConnection | null>(null);
  const streamIdRef  = useRef('');
  const sessionIdRef = useRef('');
  const talkDoneRef  = useRef<(() => void) | null>(null);
  const talkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authHeaders = useCallback(() => ({
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token ?? ''}`,
  }), [token]);

  // ── connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    console.log('[DID] connect() called, peerRef:', !!peerRef.current);
    if (peerRef.current) return;

    try {
      // POST /api/did/ — matches router.post('/', ...)
      const initRes = await fetch('/api/did/', {
        method: 'POST', headers: authHeaders(),
      });

      console.log('[DID] create stream response:', initRes.status);

      if (initRes.status === 503) {
        console.log('[DID] not configured — using built-in avatar');
        setIsAvailable(false);
        return;
      }
      setIsAvailable(true);

      if (!initRes.ok) {
        const body = await initRes.text();
        console.warn('[DID] create stream failed', initRes.status, body);
        return;
      }

      const { id, offer, ice_servers, session_id } =
        await initRes.json() as {
          id: string;
          offer: RTCSessionDescriptionInit;
          ice_servers: RTCIceServer[];
          session_id: string;
        };

      console.log('[DID] stream created, id:', id, '— negotiating WebRTC...');
      streamIdRef.current  = id;
      sessionIdRef.current = session_id;

      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      peerRef.current = pc;

      // Video track → attach to <video> element
      pc.ontrack = (e) => {
        console.log('[DID] ontrack:', e.track.kind);
        if (e.track.kind === 'video' && e.streams[0]) {
          if (videoRef.current) videoRef.current.srcObject = e.streams[0];
          setIsConnected(true);
          console.log('[DID] video stream live ✓');
        }
      };

      // Data channel — D-ID fires stream/done when avatar finishes speaking
      pc.ondatachannel = (e) => {
        e.channel.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data as string) as { event?: string };
            console.log('[DID] data channel event:', data.event);
            if (data.event === 'stream/done' || data.event === 'stream/ready') {
              if (talkTimerRef.current) { clearTimeout(talkTimerRef.current); talkTimerRef.current = null; }
              talkDoneRef.current?.();
              talkDoneRef.current = null;
            }
          } catch { /* non-JSON frames are fine */ }
        };
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // ICE candidates → POST /api/did/:id/ice
      pc.onicecandidate = async (e) => {
        if (!e.candidate) return;
        await fetch(`/api/did/${id}/ice`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            candidate:     e.candidate.candidate,
            sdpMid:        e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
            session_id,
          }),
        });
      };

      // SDP answer → POST /api/did/:id/sdp
      const sdpRes = await fetch(`/api/did/${id}/sdp`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ answer: { type: 'answer', sdp: answer.sdp }, session_id }),
      });
      console.log('[DID] SDP answer sent, status:', sdpRes.status);

    } catch (err) {
      console.warn('[DID] connect error:', err);
    }
  }, [authHeaders]);

  // ── speak ─────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!peerRef.current || !streamIdRef.current) return;

    return new Promise((resolve) => {
      talkDoneRef.current = resolve;

      const estimatedMs = Math.max(text.length * 75, 4000);
      talkTimerRef.current = setTimeout(() => {
        talkDoneRef.current?.();
        talkDoneRef.current = null;
      }, estimatedMs);

      // Talk → POST /api/did/:id/talk
      fetch(`/api/did/${streamIdRef.current}/talk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          script:     { type: 'text', input: text, provider: DID_VOICE },
          config:     { fluent: true, pad_audio: 0.5 },
          session_id: sessionIdRef.current,
        }),
      })
        .then((r) => console.log('[DID] talk sent, status:', r.status))
        .catch((err) => { console.warn('[DID] speak error:', err); resolve(); });
    });
  }, [authHeaders]);

  // ── disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (talkTimerRef.current) { clearTimeout(talkTimerRef.current); talkTimerRef.current = null; }
    talkDoneRef.current = null;

    if (streamIdRef.current) {
      // DELETE /api/did/:id
      fetch(`/api/did/${streamIdRef.current}?session_id=${sessionIdRef.current}`, {
        method: 'DELETE', headers: authHeaders(),
      }).catch(() => {});
    }

    peerRef.current?.close();
    peerRef.current  = null;
    streamIdRef.current  = '';
    sessionIdRef.current = '';

    if (videoRef.current) videoRef.current.srcObject = null;
    setIsConnected(false);
  }, [authHeaders]);

  return { videoRef, isAvailable, isConnected, connect, speak, disconnect };
}
