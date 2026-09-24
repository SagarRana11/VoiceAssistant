import { EXERCISE_KNOWLEDGE_DOCS, KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';
import { getEmbedding } from './embedder';
import { loadPdfAsKnowledgeDocs } from './pdfLoader';
import { loadOrComputeEmbeddings } from './embeddingStore';

interface VectorEntry {
  doc: KnowledgeDoc;
  embedding: number[];
}

class InMemoryVectorStore {
  private entries: VectorEntry[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise; // deduplicate concurrent calls

    this.initPromise = (async () => {
      console.log('[VectorStore] Loading exercise knowledge base...');

      // Load PDF-based exercise docs
      let pdfDocs: KnowledgeDoc[] = [];
      try {
        pdfDocs = await loadPdfAsKnowledgeDocs(
          'Advanced_Exercise_Planner_Framework_2026.pdf',
          'exercise',
        );
      } catch (err) {
        console.warn('[VectorStore] Failed to load exercise PDF, continuing without it:', err);
      }

      const allDocs = [...EXERCISE_KNOWLEDGE_DOCS, ...pdfDocs];

      // Load from MongoDB cache or compute new embeddings
      this.entries = await loadOrComputeEmbeddings('exercise', allDocs);

      this.initialized = true;
      console.log(
        `[VectorStore] Ready — ${this.entries.length} documents indexed (${EXERCISE_KNOWLEDGE_DOCS.length} hardcoded + ${pdfDocs.length} from PDF).`,
      );
    })();

    return this.initPromise;
  }

  /** True once initialize() has completed. */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Number of indexed documents. */
  get size(): number {
    return this.entries.length;
  }

  async similaritySearch(query: string, topK = 3): Promise<KnowledgeDoc[]> {
    await this.initialize();
    const queryEmbedding = await getEmbedding(query);
    const scored = this.entries.map(entry => ({
      doc: entry.doc,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }));
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.doc);
  }

  /** Tag-filtered search: tries tag match first, falls back to semantic */
  async searchByTags(tags: string[], topK = 3): Promise<KnowledgeDoc[]> {
    await this.initialize();
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    const tagMatches = this.entries
      .filter(e => e.doc.tags.some(t => tagSet.has(t.toLowerCase())))
      .map(e => e.doc);
    if (tagMatches.length >= topK) return tagMatches.slice(0, topK);
    // Supplement with semantic search if not enough tag matches
    const semantic = await this.similaritySearch(tags.join(' '), topK);
    const seen = new Set(tagMatches.map(d => d.id));
    for (const doc of semantic) {
      if (!seen.has(doc.id)) {
        tagMatches.push(doc);
        if (tagMatches.length >= topK) break;
      }
    }
    return tagMatches;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

// Singleton — shared across the whole server process
export const vectorStore = new InMemoryVectorStore();
