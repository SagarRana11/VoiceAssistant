/**
 * elevenLabsService.ts
 * Calls the backend /api/tts proxy which forwards to ElevenLabs.
 * Returns an HTMLAudioElement ready to play, or null if unavailable
 * (no API key, quota exceeded, network error) — caller falls back to Web Speech API.
 */

let elevenLabsAvailable: boolean | null = null; // null = untested

export async function speakWithElevenLabs(
  text: string,
  token: string,
): Promise<HTMLAudioElement | null> {
  // If we already know ElevenLabs is unavailable this session, skip immediately
  if (elevenLabsAvailable === false) return null;

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    // 503 = not configured, 402/429 = quota — mark unavailable for session
    if (res.status === 503 || res.status === 402 || res.status === 429) {
      console.warn('[ElevenLabs] unavailable (status', res.status, ') — falling back to browser TTS');
      elevenLabsAvailable = false;
      return null;
    }

    if (!res.ok) {
      console.warn('[ElevenLabs] request failed, status', res.status);
      return null;
    }

    elevenLabsAvailable = true;

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);

    // Clean up the object URL once audio has played
    audio.addEventListener('ended',  () => URL.revokeObjectURL(url), { once: true });
    audio.addEventListener('error',  () => URL.revokeObjectURL(url), { once: true });

    return audio;
  } catch {
    console.warn('[ElevenLabs] network error — falling back to browser TTS');
    return null;
  }
}

/** Call this when you want to force a re-check (e.g. user adds API key at runtime) */
export function resetElevenLabsAvailability(): void {
  elevenLabsAvailable = null;
}
