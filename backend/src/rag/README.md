# RAG Pipeline — Voice Assistant

## Overview

The RAG (Retrieval-Augmented Generation) pipeline provides domain-specific knowledge to the LLM at query time. Instead of relying solely on the model's training data, we retrieve the most relevant knowledge documents and inject them into the prompt as context.

## Architecture

```
User Query
    │
    ▼
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│ Retriever│────▶│ Vector Store   │────▶│ Embedder (OpenAI)│
│          │     │ (in-memory)    │     │ or mock fallback │
└──────────┘     └───────────────┘     └──────────────────┘
    │                    ▲
    │                    │
    │         ┌──────────┴───────────┐
    │         │   Knowledge Sources   │
    │         │                       │
    │         │  ┌─────────────────┐  │
    │         │  │ Hardcoded .ts   │  │
    │         │  │ (exercise, diet,│  │
    │         │  │  meditation)    │  │
    │         │  └─────────────────┘  │
    │         │  ┌─────────────────┐  │
    │         │  │ PDF files       │  │
    │         │  │ (parsed at      │  │
    │         │  │  startup)       │  │
    │         │  └─────────────────┘  │
    │         └──────────────────────┘
    │
    │         ┌──────────────────────┐
    └────────▶│  MongoDB (local)     │
              │  knowledge_embeddings│
              │  (persistence layer) │
              └──────────────────────┘
```

## File-by-File Breakdown

### Knowledge Sources (`knowledgeSources/`)

| File | Purpose |
|------|---------|
| `exerciseKnowledge.ts` | Hardcoded exercise knowledge — 10 docs covering beginner, intermediate, strength, fat loss, endurance, recovery, warmup, injury, bodyweight, flexibility. Also exports the `KnowledgeDoc` interface used across the pipeline. |
| `dietKnowledge.ts` | Hardcoded diet knowledge — 10 docs covering calories/BMR, macros, vegan, fat loss diet, muscle gain diet, medical nutrition, hydration, vegetarian, meal timing, food substitutions. |
| `meditationKnowledge.ts` | Hardcoded meditation knowledge docs. |
| `Advanced_Exercise_Planner_Framework_2026.pdf` | PDF-based exercise knowledge — 8 sections covering adaptation laws, periodization, movement patterns, training variables (FITT-VP), advanced modalities, biometrics, nutrition/recovery, program design. Parsed at startup by `pdfLoader.ts`. |

### Core Pipeline Files

| File | Purpose |
|------|---------|
| `embedder.ts` | Converts text into vector embeddings. Uses OpenAI `text-embedding-3-small` when `OPENAI_API_KEY` is set, otherwise falls back to a deterministic mock embedding (character-code based, 1536 dimensions). Includes an in-process cache to avoid redundant API calls. |
| `embeddingStore.ts` | MongoDB persistence layer for embeddings. On startup, checks MongoDB for existing embeddings by `docId + domain`. Uses an MD5 content hash to detect changes — if a doc's content hasn't changed, the cached embedding is reused (no API call). New/changed docs get embedded and saved. Stale docs (removed from source) are cleaned up automatically. |
| `vectorStore.ts` | Exercise-specific in-memory vector store (singleton). On initialization, loads both hardcoded `EXERCISE_KNOWLEDGE_DOCS` and PDF docs from `pdfLoader.ts`, then calls `embeddingStore` to load/compute embeddings. Provides `similaritySearch()` (cosine similarity) and `searchByTags()` (tag match with semantic fallback). |
| `domainVectorStore.ts` | Generic/reusable in-memory vector store class (`DomainVectorStore`). Same logic as `vectorStore.ts` but instantiable per domain. Used for diet and meditation stores. Also uses `embeddingStore` for MongoDB persistence. |
| `pdfLoader.ts` | PDF ingestion utility. Reads a PDF file from `knowledgeSources/`, extracts text using `pdf-parse` v2 (`PDFParse` class), splits by numbered section headings (regex: `\n\d+\.\s+[A-Z]`), and converts each section into a `KnowledgeDoc` with auto-generated tags from the title. |
| `retriever.ts` | The public API for the RAG pipeline. Exposes domain-specific retrieval functions that the rest of the app calls. |

### MongoDB Model

| File | Purpose |
|------|---------|
| `models/KnowledgeEmbedding.ts` | Mongoose model for the `knowledge_embeddings` collection. Stores `docId`, `domain`, `title`, `content`, `tags`, `embedding` (number[]), and `contentHash` (MD5). Indexed uniquely on `(docId, domain)`. |

### Retriever Functions (`retriever.ts`)

| Function | Domain | How it works |
|----------|--------|-------------|
| `retrieveExerciseDocs(query, topK)` | Exercise | Pure semantic similarity search against the exercise vector store. |
| `retrieveDocsByProfile(fitnessGoal, activityLevel, hasInjuries, topK)` | Exercise | Builds tags from user profile → tag search with semantic fallback → always appends warmup/safety docs. |
| `retrieveMeditationDocs(stressLevel, sleepHours, activityLevel, hasExperience, topK)` | Meditation | Maps stress/sleep/experience to tags → tag + semantic search on meditation store. |
| `retrieveDietDocs(fitnessGoal, dietPreference, diseases, allergies, topK)` | Diet | Maps goal/preference/diseases/allergies to tags → tag + semantic search on diet store. |

## Data Flow (step by step)

### Startup (first run — cold cache)
1. `vectorStore` singleton calls `initialize()`
2. `pdfLoader.ts` reads the exercise PDF → parses text → splits into 8 `KnowledgeDoc[]` by section headings
3. PDF docs are merged with hardcoded `EXERCISE_KNOWLEDGE_DOCS` (10 docs) → total ~18 exercise docs
4. `embeddingStore.ts` checks MongoDB — no cached embeddings found
5. Each doc is embedded via `embedder.ts` → embedding + content hash saved to MongoDB
6. Diet and meditation `DomainVectorStore` instances initialize similarly

### Startup (subsequent runs — warm cache)
1. Same as above, but at step 4: `embeddingStore.ts` finds cached embeddings in MongoDB
2. Content hash is compared — if unchanged, cached embedding is loaded directly (no API call)
3. Only new or modified docs trigger an embedding API call
4. Stale docs (removed from source) are cleaned up from MongoDB

### At Query Time
1. A retriever function is called (e.g., `retrieveDocsByProfile`)
2. User profile data is converted to tags (e.g., `fat_loss` → `['fat_loss']`)
3. Tag matching runs first — finds docs whose tags overlap
4. If not enough tag matches, semantic similarity search supplements the results
5. Results are formatted as markdown (`### Title\nContent`) and returned
6. These formatted strings are injected into the LLM system prompt as context

## How to Add New Knowledge

### Adding a new hardcoded knowledge doc
Add a new entry to the appropriate `*Knowledge.ts` file following the `KnowledgeDoc` interface:
```ts
{
  id: 'unique_id',
  category: 'category_name',
  title: 'Document Title',
  content: `The actual knowledge content...`,
  tags: ['relevant', 'searchable', 'tags'],
}
```

### Adding a new PDF
1. Place the PDF in `knowledgeSources/`
2. In `vectorStore.ts` (or the relevant domain store), add a `loadPdfAsKnowledgeDocs()` call during initialization
3. The PDF must have numbered section headings (e.g., "1. Section Title") for automatic splitting to work
4. For unstructured PDFs without headings, a chunking strategy (paragraph-based or token-based) will need to be implemented in `pdfLoader.ts`

## Key Design Decisions

- **MongoDB for embedding persistence**: Embeddings are stored in a local MongoDB collection (`knowledge_embeddings`). On startup, cached embeddings are loaded from DB instead of re-computing via the OpenAI API. Content hashing (MD5) detects when a doc has changed and needs re-embedding.
- **In-memory for search**: Similarity search still runs in-memory (cosine similarity in JS). For ~30 docs this is instant. MongoDB is only used for persistence, not for vector search.
- **Two retrieval paths**: Tag matching (fast, exact) + semantic similarity (fuzzy, meaning-based). Tag search falls back to semantic when matches are insufficient.
- **Mock embeddings**: When no OpenAI key is set, a deterministic character-code-based embedding is used. Good enough for keyword-level similarity in dev mode.
- **PDF parsing at startup**: PDFs are parsed once when the server starts, not on every query.
- **Stale cleanup**: If you remove a doc from the source, its embedding is automatically deleted from MongoDB on next startup.
