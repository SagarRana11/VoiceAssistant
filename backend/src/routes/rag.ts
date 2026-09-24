/**
 * rag.ts — Debug/test router for the RAG pipeline
 *
 * GET  /api/rag/pdf      — Run loadPdfAsKnowledgeDocs directly and return the parsed docs
 * POST /api/rag/init     — Force vectorStore.initialize() (PDF load + embeddings)
 * GET  /api/rag/status    — Report whether the vector store is initialized and how many docs
 * GET  /api/rag/search    — Run a similarity search against the exercise store
 *
 * These routes are development aids and are disabled when NODE_ENV=production.
 */

import { Router, Request, Response } from 'express';
import { loadPdfAsKnowledgeDocs } from '../rag/pdfLoader';
import { vectorStore } from '../rag/vectorStore';

const router = Router();

const DEFAULT_PDF = 'Advanced_Exercise_Planner_Framework_2026.pdf';

// Block these debug routes in production
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  next();
});

/** Parse a PDF into KnowledgeDoc[] without touching embeddings or MongoDB. */
router.get('/pdf', async (req: Request, res: Response) => {
  const fileName = (req.query.file as string) ?? DEFAULT_PDF;
  const category = (req.query.category as string) ?? 'exercise';
  const started = Date.now();

  try {
    const docs = await loadPdfAsKnowledgeDocs(fileName, category);
    res.json({
      success: true,
      fileName,
      category,
      durationMs: Date.now() - started,
      count: docs.length,
      docs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      fileName,
      category,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/** Force the exercise vector store to initialize (PDF load + embedding cache). */
router.post('/init', async (_req: Request, res: Response) => {
  const started = Date.now();
  try {
    await vectorStore.initialize();
    res.json({
      success: true,
      durationMs: Date.now() - started,
      initialized: vectorStore.isInitialized,
      docCount: vectorStore.size,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

/** Report vector store state without triggering initialization. */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    initialized: vectorStore.isInitialized,
    docCount: vectorStore.size,
  });
});

/** Similarity search over the exercise store. Initializes it on first call. */
router.get('/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const topK = parseInt((req.query.topK as string) ?? '3', 10);

  if (!query) {
    res.status(400).json({ success: false, message: 'Query param "q" is required.' });
    return;
  }

  try {
    const docs = await vectorStore.similaritySearch(query, topK);
    res.json({ success: true, query, topK, count: docs.length, docs });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
