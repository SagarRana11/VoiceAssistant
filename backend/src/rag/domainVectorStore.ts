/**
 * Generic in-memory vector store that can be instantiated per knowledge domain.
 * Separate from the existing vectorStore singleton (which serves exercise docs).
 */
import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';
import { getEmbedding } from './embedder';

interface VectorEntry {
  doc: KnowledgeDoc;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

export class DomainVectorStore {
  private entries: VectorEntry[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly name: string;

  constructor(name: string, private readonly docs: KnowledgeDoc[]) {
    this.name = name;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      console.log(`[DomainVectorStore:${this.name}] Building embeddings (${this.docs.length} docs)...`);
      for (const doc of this.docs) {
        const text = `${doc.title}\n${doc.content}`;
        const embedding = await getEmbedding(text);
        this.entries.push({ doc, embedding });
      }
      this.initialized = true;
      console.log(`[DomainVectorStore:${this.name}] Ready.`);
    })();

    return this.initPromise;
  }

  async similaritySearch(query: string, topK = 3): Promise<KnowledgeDoc[]> {
    await this.initialize();
    const queryEmbedding = await getEmbedding(query);
    return this.entries
      .map(e => ({ doc: e.doc, score: cosineSimilarity(queryEmbedding, e.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.doc);
  }

  async searchByTags(tags: string[], topK = 3): Promise<KnowledgeDoc[]> {
    await this.initialize();
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    const tagMatches = this.entries
      .filter(e => e.doc.tags.some(t => tagSet.has(t.toLowerCase())))
      .map(e => e.doc);

    if (tagMatches.length >= topK) return tagMatches.slice(0, topK);

    const semantic = await this.similaritySearch(tags.join(' '), topK);
    const seen = new Set(tagMatches.map(d => d.id));
    for (const doc of semantic) {
      if (!seen.has(doc.id)) {
        tagMatches.push(doc);
        seen.add(doc.id);
        if (tagMatches.length >= topK) break;
      }
    }
    return tagMatches;
  }
}
