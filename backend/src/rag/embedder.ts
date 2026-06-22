// Simple embedding cache to avoid redundant API calls in the same process
const embeddingCache = new Map<string, number[]>();

export async function getEmbedding(text: string): Promise<number[]> {
  const key = text.slice(0, 200);
  console.log('key in getEmbeddings>>>>>', key);
  if (embeddingCache.has(key)) return embeddingCache.get(key)!;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const mock = mockEmbedding(text);
    embeddingCache.set(key, mock);
    return mock;
  }

  // generating embeddings for query
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // model limit safety
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Embeddings API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  const embedding = data.data[0].embedding;
  embeddingCache.set(key, embedding);
  return embedding;
}

/**
 * Deterministic pseudo-embedding based on character codes.
 * Good enough for keyword-level similarity in dev/offline mode.
 */
function mockEmbedding(text: string): number[] {
  const dim = 1536;
  const vec = new Array<number>(dim).fill(0);
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const idx = (lower.charCodeAt(i) * (i + 1)) % dim;
    vec[idx] += 1;
  }
  // L2-normalise
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}
