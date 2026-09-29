import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';

// In-process BM25 over the (small, in-memory) knowledge docs — catches exact terms
// (exercise names, "RPE", "deload") that embedding search can rank low.

const K1 = 1.2;
const B = 0.75;
const FIELD_BOOST = 2; // title + tags counted twice

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'should',
  'so',
  'that',
  'the',
  'this',
  'to',
  'what',
  'when',
  'which',
  'with',
  'you',
  'your',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

export class Bm25Index {
  private readonly docs: KnowledgeDoc[];
  private readonly termFreqs: Map<string, number>[];
  private readonly lengths: number[];
  private readonly docFreq = new Map<string, number>();
  private readonly avgLength: number;

  constructor(docs: KnowledgeDoc[]) {
    this.docs = docs;
    this.termFreqs = docs.map(doc => {
      const boosted = Array(FIELD_BOOST)
        .fill(`${doc.title} ${doc.tags.join(' ')}`)
        .join(' ');
      const tf = new Map<string, number>();
      for (const t of tokenize(`${boosted} ${doc.content}`)) tf.set(t, (tf.get(t) ?? 0) + 1);
      return tf;
    });
    this.lengths = this.termFreqs.map(tf => [...tf.values()].reduce((a, b) => a + b, 0));
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / (docs.length || 1);
    for (const tf of this.termFreqs) {
      for (const t of tf.keys()) this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
    }
  }

  /** Top-K docs by BM25 score; docs sharing no query term are never returned. */
  search(query: string, topK: number): KnowledgeDoc[] {
    const terms = [...new Set(tokenize(query))];
    const n = this.docs.length;
    const scored: { doc: KnowledgeDoc; score: number }[] = [];
    this.termFreqs.forEach((tf, i) => {
      let score = 0;
      for (const t of terms) {
        const f = tf.get(t);
        if (!f) continue;
        const df = this.docFreq.get(t) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * this.lengths[i]) / this.avgLength));
      }
      if (score > 0) scored.push({ doc: this.docs[i], score });
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.doc);
  }
}
