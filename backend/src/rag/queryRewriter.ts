import { openaiChat, ChatMessage } from '../services/openaiService';

export type RewriterDomain = 'fitness' | 'health' | 'hospital';

// Process-level cache — key: domain::message[:200]
const _cache = new Map<string, string>();

const DOMAIN_PROMPTS: Record<RewriterDomain, string> = {
  fitness: `Rewrite the user message as 6–10 space-separated lowercase keywords for a fitness vector search.
No sentences, no punctuation. Focus on: exercise types, muscle groups, goals, training variables, recovery.
Example: "tired and can't lose weight" → fatigue energy weight loss calorie deficit cardio resistance training recovery`,

  health: `Rewrite the user message as 6–10 space-separated lowercase keywords for a health/wellness vector search.
No sentences, no punctuation. Focus on: symptoms, nutrition, diet, wellness concepts, body systems.
Example: "feel bloated and sluggish after lunch" → bloating digestion gut health meal timing energy fatigue inflammation diet`,

  hospital: `Rewrite the patient question as 6–10 space-separated lowercase keywords for a cardiac medical knowledge base.
No sentences, no punctuation. Focus on: procedures, diagnoses, medications, cardiac anatomy, recovery.
Example: "will it hurt during the heart operation?" → cardiac procedure angioplasty PCI stent anesthesia pain management surgery recovery`,
};

function buildUserPrompt(message: string, domain: RewriterDomain, history?: ChatMessage[]): string {
  let ctx = '';
  if (history && history.length >= 2) {
    // Last 2 turns for pronoun resolution ("it", "that exercise", etc.)
    ctx = history.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n') + '\n';
  }
  return `${ctx}user: ${message}\n\nRewrite the user message for domain: ${domain}.`;
}

export async function rewriteQueryForRetrieval(
  message: string,
  domain: RewriterDomain,
  history?: ChatMessage[]
): Promise<string> {
  const cacheKey = `${domain}::${message.slice(0, 200)}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!;

  try {
    const raw = await openaiChat(
      [
        { role: 'system', content: DOMAIN_PROMPTS[domain] },
        { role: 'user', content: buildUserPrompt(message, domain, history) },
      ],
      { maxTokens: 60, temperature: 0.1 }
    );

    const cleaned = raw.trim();
    // Guard: JSON blob means mock mode is active — fall back to original message
    const result = cleaned.length >= 5 && !cleaned.startsWith('{') ? cleaned : message;

    // Evict oldest entry if cache exceeds 50 entries
    if (_cache.size >= 50) _cache.delete(_cache.keys().next().value!);
    _cache.set(cacheKey, result);

    console.log(`[QueryRewriter:${domain}] "${message.slice(0, 60)}" → "${result}"`);
    return result;
  } catch {
    console.warn('[QueryRewriter] LLM call failed, using original message');
    return message;
  }
}
