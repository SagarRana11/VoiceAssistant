// backend/src/rag/reranker.ts
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

export async function rerankDocs(query: string, docs: string[], topK: number): Promise<string[]> {
  if (docs.length <= topK) return docs; // no point reranking fewer than topK

  try {
    const response = await cohere.rerank({
      model: 'rerank-v3.5',
      query,
      documents: docs,
      topN: topK,
    });
    console.log('response.result in reRanker>>>>', response.results);
    return response.results.map(r => docs[r.index]);
  } catch (err) {
    console.warn('[Reranker] Cohere call failed, using original order:', err);
    return docs.slice(0, topK); // graceful fallback
  }
}
