/**
 * useDIDStream.ts — D-ID WebRTC streaming hook
 */
import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

const DID_VOICE = { type: 'microsoft' as const, voice_id: 'en-IN-NeerjaNeural' };

export interface AvatarStream {
  videoRef:    React.RefObject<HTMLVideoElement>;
  isAvailable: boolean;
  isConnected: boolean;
  connect:     () => Promise<void>;
  speak:       (text: string) => Promise<void>;
  disconnect:  () => void;
}

export function useDIDStream(): AvatarStream {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const token    = useAppStore((s) => s.token);
  const videoRef = useRef<HTMLVideoElement>(null);

  const peerRef         = useRef<RTCPeerConnection | null>(null);
  const streamIdRef     = useRef('');
  const sessionIdRef    = useRef('');
  const talkDoneRef     = useRef<(() => void) | null>(null);
  const talkTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const remoteStreamRef  = useRef<MediaStream | null>(null);
  const isConnectedRef   = useRef(false);

  // Persist last stream info across page refreshes so the stale session is
  // always deleted before creating a new one (avoids "Max sessions reached").
  const STORAGE_KEY = 'did_last_stream';
  function saveStream(id: string, sessionId: string) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, sessionId })); } catch { /* ignore */ }
  }
  function loadStream(): { id: string; sessionId: string } | null {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  }
  function clearStream() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  const authHeaders = useCallback(() => ({
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token ?? ''}`,
  }), [token]);

  // ── connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    console.log('[DID] connect() called, peerRef:', !!peerRef.current);
    if (peerRef.current) return;

    // Abort any in-flight previous connect (React StrictMode double-invoke)
    connectAbortRef.current?.abort();
    const abort = new AbortController();
    connectAbortRef.current = abort;

    try {
      // Delete previous session BEFORE creating a new one so D-ID never sees
      // two sessions simultaneously (free plan allows only 1 at a time).
      // Uses localStorage so the ID survives page refreshes.
      const prev = loadStream();
      if (prev) {
        clearStream();
        await fetch(`/api/did/${prev.id}?session_id=${encodeURIComponent(prev.sessionId)}`, {
          method: 'DELETE', headers: authHeaders(), signal: abort.signal,
        }).catch(() => {});
        console.log('[DID] previous session deleted:', prev.id);
      }

      if (abort.signal.aborted) return;

      const initRes = await fetch('/api/did/', {
        method: 'POST', headers: authHeaders(), signal: abort.signal,
      });

      console.log('[DID] create stream response:', initRes.status);

      if (initRes.status === 503) {
        console.log('[DID] not configured — using built-in avatar');
        setIsAvailable(false);
        return;
      }
      if (!initRes.ok) {
        const body = await initRes.text();
        console.warn('[DID] create stream failed', initRes.status, body);
        setIsAvailable(false);
        return;
      }

      setIsAvailable(true);

      const { id, offer, ice_servers, session_id } =
        await initRes.json() as {
          id:          string;
          offer:       RTCSessionDescriptionInit;
          ice_servers: RTCIceServer[];
          session_id:  string;
        };

      // Persist so cleanup survives page refresh
      saveStream(id, session_id);

      if (abort.signal.aborted) {
        // Aborted after session was created — saved to localStorage, will be
        // deleted at the start of the next connect() call.
        return;
      }

      console.log('[DID] stream created, id:', id, '— negotiating WebRTC...');
      streamIdRef.current  = id;
      sessionIdRef.current = session_id;

      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      peerRef.current = pc;

      connTimeoutRef.current = setTimeout(() => {
        console.warn('[DID] 15 s timeout — no video. ICE:', pc.iceConnectionState);
      }, 15000);

      pc.ontrack = (e) => {
        console.log('[DID] ontrack:', e.track.kind, 'streams:', e.streams.length);

        // Some WebRTC impls fire ontrack with an empty streams array — build our own.
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(e.track);

        const stream = e.streams[0] ?? remoteStreamRef.current;

        if (e.track.kind === 'video') {
          if (connTimeoutRef.current) { clearTimeout(connTimeoutRef.current); connTimeoutRef.current = null; }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((err) => console.warn('[DID] autoplay blocked:', err));
          }
          isConnectedRef.current = true;
          setIsConnected(true);
          console.log('[DID] video stream live ✓');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[DID] ICE:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          if (connTimeoutRef.current) { clearTimeout(connTimeoutRef.current); connTimeoutRef.current = null; }
        }
      };

      // Must be set BEFORE setLocalDescription — ICE gathering starts immediately
      // when setLocalDescription is called, so candidates fired before this handler
      // is attached would be silently dropped.
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

      pc.ondatachannel = (e) => {
        e.channel.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data as string) as { event?: string };
            console.log('[DID] data channel event:', data.event);

            if (data.event === 'stream/ready') {
              // Fallback: grab the video track directly from receivers in case
              // ontrack fired before videoRef was mounted or srcObject wasn't set.
              const videoReceiver = pc.getReceivers().find((r) => r.track.kind === 'video');
              // Use !srcObject (not !isConnectedRef) — ontrack may have set isConnected=true
              // but failed to assign srcObject if videoRef.current was null at that moment.
              if (videoReceiver && videoRef.current && !videoRef.current.srcObject) {
                const stream = remoteStreamRef.current ?? new MediaStream([videoReceiver.track]);
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch((err) => console.warn('[DID] stream/ready play failed:', err));
                isConnectedRef.current = true;
                setIsConnected(true);
                console.log('[DID] video set via stream/ready fallback ✓');
              }
            }

            if (data.event === 'stream/done' || data.event === 'stream/ready') {
              if (talkTimerRef.current) { clearTimeout(talkTimerRef.current); talkTimerRef.current = null; }
              talkDoneRef.current?.();
              talkDoneRef.current = null;
            }
          } catch { /* non-JSON frames */ }
        };
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sdpRes = await fetch(`/api/did/${id}/sdp`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ answer: { type: 'answer', sdp: answer.sdp }, session_id }),
      });
      console.log('[DID] SDP answer sent, status:', sdpRes.status);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[DID] connect aborted — will retry on next mount');
      } else {
        console.warn('[DID] connect error:', err);
      }
    }
  }, [authHeaders]);

  // ── speak ───────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!peerRef.current || !streamIdRef.current) return;

    return new Promise((resolve) => {
      talkDoneRef.current = resolve;

      const estimatedMs = Math.max(text.length * 75, 4000);
      talkTimerRef.current = setTimeout(() => {
        talkDoneRef.current?.();
        talkDoneRef.current = null;
      }, estimatedMs);

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

  // ── disconnect ───────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    if (talkTimerRef.current)  { clearTimeout(talkTimerRef.current);  talkTimerRef.current  = null; }
    if (connTimeoutRef.current){ clearTimeout(connTimeoutRef.current); connTimeoutRef.current = null; }
    talkDoneRef.current = null;

    // localStorage already holds the stream info (saved on creation).
    // connect() will DELETE it before creating a new session.

    // DELETE the D-ID session. keepalive:true ensures the browser sends this
    // request even when the page is navigating away or being refreshed —
    // without it the fetch is cancelled and the session stays open on D-ID,
    // causing "Max sessions reached" on the next page load.
    if (streamIdRef.current) {
      const id  = streamIdRef.current;
      const sid = sessionIdRef.current;
      fetch(`/api/did/${id}?session_id=${encodeURIComponent(sid)}`, {
        method: 'DELETE', headers: authHeaders(), keepalive: true,
      }).then(() => clearStream()).catch(() => { /* localStorage keeps the ID; next connect() will retry */ });
    }

    peerRef.current?.close();
    peerRef.current      = null;
    streamIdRef.current  = '';
    sessionIdRef.current = '';

    if (videoRef.current) videoRef.current.srcObject = null;
    remoteStreamRef.current  = null;
    isConnectedRef.current   = false;
    setIsConnected(false);
  }, [authHeaders]);

  return { videoRef, isAvailable, isConnected, connect, speak, disconnect };
}
