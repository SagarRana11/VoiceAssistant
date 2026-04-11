import crypto from 'crypto';
import { KnowledgeDoc } from './knowledgeSources/exerciseKnowledge';
import { KnowledgeEmbedding } from '../models/KnowledgeEmbedding';
import { getEmbedding } from './embedder';

interface StoredEntry {
  doc: KnowledgeDoc;
  embedding: number[];
}

/** Hash the doc content so we know when it changes */
function hashDoc(doc: KnowledgeDoc): string {
  return crypto.createHash('md5').update(`${doc.title}\n${doc.content}`).digest('hex');
}

/**
 * Load embeddings from MongoDB for a given domain + doc set.
 * Only computes new embeddings for docs that are missing or changed.
 * Saves new/updated embeddings back to MongoDB.
 */
export async function loadOrComputeEmbeddings(
  domain: string,
  docs: KnowledgeDoc[],
): Promise<StoredEntry[]> {
  const entries: StoredEntry[] = [];

  // Fetch all existing embeddings for this domain from MongoDB
  const existing = await KnowledgeEmbedding.find({ domain }).lean();
  const existingMap = new Map(existing.map((e) => [e.docId, e]));

  // Track which docIds are still valid (for cleanup of removed docs)
  const activeDocIds = new Set<string>();

  for (const doc of docs) {
    activeDocIds.add(doc.id);
    const hash = hashDoc(doc);
    const cached = existingMap.get(doc.id);

    if (cached && cached.contentHash === hash) {
      // Cache hit — use stored embedding
      entries.push({
        doc,
        embedding: cached.embedding,
      });
    } else {
      // Cache miss — compute embedding and save to MongoDB
      const text = `${doc.title}\n${doc.content}`;
      const embedding = await getEmbedding(text);
      entries.push({ doc, embedding });

      await KnowledgeEmbedding.findOneAndUpdate(
        { docId: doc.id, domain },
        {
          docId: doc.id,
          domain,
          title: doc.title,
          category: doc.category,
          content: doc.content,
          tags: doc.tags,
          embedding,
          contentHash: hash,
        },
        { upsert: true },
      );
    }
  }

  // Clean up embeddings for docs that no longer exist
  const staleIds = existing.filter((e) => !activeDocIds.has(e.docId)).map((e) => e.docId);
  if (staleIds.length > 0) {
    await KnowledgeEmbedding.deleteMany({ domain, docId: { $in: staleIds } });
    console.log(`[EmbeddingStore:${domain}] Removed ${staleIds.length} stale embeddings.`);
  }

  return entries;
}
