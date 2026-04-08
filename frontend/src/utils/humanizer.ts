/**
 * humanizer.ts
 * Transforms written AI text into natural spoken language.
 * Applied to the full response before TTS — transcript shows raw text,
 * TTS speaks humanized version.
 */

// ─── Formal → Spoken replacements ────────────────────────────────────────────
const SUBSTITUTIONS: [RegExp, string][] = [
  // Connectors
  [/\bHowever\b/g,                    'But'],
  [/\bFurthermore\b/g,                'And also'],
  [/\bTherefore\b/g,                  'So'],
  [/\bConsequently\b/g,               'So'],
  [/\bNevertheless\b/g,               'Still'],
  [/\bAdditionally\b/g,               'And'],
  [/\bMoreover\b/g,                   'And'],
  [/\bSubsequently\b/g,               'Then'],
  [/\bIn addition(,)?\s*/gi,          'Also, '],
  [/\bIn conclusion(,)?\s*/gi,        'So, '],
  [/\bTo summarize(,)?\s*/gi,         'So, '],
  [/\bTo summarise(,)?\s*/gi,         'So, '],

  // Verbose phrases → concise
  [/\bIn order to\b/gi,               'To'],
  [/\bDue to the fact that\b/gi,      'Because'],
  [/\bIt is important to note that\b/gi, 'Worth noting —'],
  [/\bIt should be noted that\b/gi,   'Worth knowing —'],
  [/\bAt this point in time\b/gi,     'Right now'],
  [/\bFor the purpose of\b/gi,        'To'],
  [/\bWith regard to\b/gi,            'About'],
  [/\bWith respect to\b/gi,           'About'],

  // Formal verbs → casual
  [/\bUtilize\b/gi,   'use'],
  [/\bObtain\b/gi,    'get'],
  [/\bPurchase\b/gi,  'buy'],
  [/\bAssist\b/gi,    'help'],
  [/\bCommencement\b/gi, 'start'],
  [/\bTerminate\b/gi, 'end'],
  [/\bInquire\b/gi,   'ask'],
  [/\bAttempt to\b/gi, 'try to'],
];

// ─── Bad AI openers to strip ──────────────────────────────────────────────────
const BAD_OPENERS = [
  /^Certainly[!,]?\s*/i,
  /^Of course[!,]?\s*/i,
  /^Absolutely[!,]?\s*/i,
  /^Great question[!,]?\s*/i,
  /^That's a great question[!,]?\s*/i,
  /^Sure[!,]?\s*/i,
  /^I'd be happy to help[.!,]?\s*/i,
];

// ─── Soft spoken starters ─────────────────────────────────────────────────────
const SOFT_STARTERS = [
  'Hmm... ',
  'Okay... ',
  'Right... ',
  'I see... ',
  'Got it... ',
  'Yeah... ',
  'Ah... ',
];

/**
 * Main humanizer — strips markdown, replaces formal language, optionally
 * adds a soft spoken opener.
 */
export function humanizeText(raw: string, addStarter = true): string {
  let text = raw;

  // 1. Strip markdown formatting
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')     // **bold**
    .replace(/\*(.+?)\*/g, '$1')          // *italic*
    .replace(/`(.+?)`/g, '$1')            // `code`
    .replace(/#{1,6}\s+/g, '')            // ## headers
    .replace(/^[-•*]\s+/gm, '')           // bullet points
    .replace(/^\d+[.)]\s+/gm, '');        // numbered lists

  // 2. Replace bad openers
  for (const pattern of BAD_OPENERS) {
    text = text.replace(pattern, '');
  }

  // 3. Formal → spoken
  for (const [pattern, replacement] of SUBSTITUTIONS) {
    text = text.replace(pattern, replacement);
  }

  // 4. Collapse multiple spaces / newlines → single space
  text = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // 5. Optionally add a soft spoken starter (~35% chance)
  if (addStarter && Math.random() < 0.35 && !hasNaturalOpener(text)) {
    const starter = SOFT_STARTERS[Math.floor(Math.random() * SOFT_STARTERS.length)];
    // Lowercase the first letter of the original text
    text = starter + text.charAt(0).toLowerCase() + text.slice(1);
  }

  return text.trim();
}

/**
 * Splits humanized text into sentence-level chunks for TTS queue.
 * Respects "..." mid-sentence as a pause point.
 */
export function splitIntoChunks(text: string): string[] {
  // Split on sentence boundaries: . ! ? followed by space or end
  // Also split on "..." used as pause marker
  const raw = text
    .split(/(?<=[.!?])\s+/);

  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function hasNaturalOpener(text: string): boolean {
  const openers = ['hmm', 'okay', 'right', 'i see', 'got it', 'oh', 'ah', 'yeah', 'well'];
  const lower = text.toLowerCase();
  return openers.some((o) => lower.startsWith(o));
}
