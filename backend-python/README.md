# backend-python — Chat service (FastAPI)

Python port of `backend/src/routes/chat.ts` (+ `chatController.ts` and its RAG pipeline).
Only chat lives here; auth, profile, plans, etc. stay on the Node backend.

## Run

```bash
cd backend-python
uv venv -p 3.12 .venv && uv pip install -p .venv/bin/python -r requirements.txt
.venv/bin/python -m app.main        # http://localhost:5002
```

Run the Node backend too (port 5001) — login/JWT still come from it.
Vite proxies `/api/chat/*` → `:5002` (override with `CHAT_API_TARGET`), rest of `/api` → `:5001`.

## Config
Reads `backend-python/.env` first, then falls back to `backend/.env`.
### LLM provider (LangChain)
| Var | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` \| `openai` \| `mock`. Falls back to mock if the chosen provider's key is missing |
| `GEMINI_API_KEY` | — | Google AI Studio key, used when provider = gemini |
| `GEMINI_MODEL` | `gemini-3.5-flash` | pinned; `*-lite` models reject `thinking_budget=0` |
| `OPENAI_MODEL` | `gpt-4o-mini` | |

Chat + query rewrite use the selected provider (`ChatOpenAI` / `ChatGoogleGenerativeAI`).
Embeddings **always** use OpenAI `text-embedding-3-small` (stored Mongo vectors were made with it),
so RAG semantic search still needs `OPENAI_API_KEY`; without it only tag-based retrieval works.
Rerank via `langchain-cohere`.

### Embeddings (`EMBEDDING_PROVIDER`, default `ollama`)
- `ollama`: local `nomic-embed-text:latest` at `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`).
  Vectors (768-dim) stored in Mongo collection **`knowledgeembeddings_nomic`**.
  Queries use the `search_query: ` prefix, docs use `search_document: `.
- `openai`: `text-embedding-3-small`, reads Node's `knowledgeembeddings` (1536-dim).

**Embedding flow** (same as Node's `loadOrComputeEmbeddings`): on the first RAG request for a domain,
`rag._load` → `ingest.sync_domain` embeds any docs missing or changed in `knowledgeembeddings_nomic`
and saves them; stored vectors are reused after that. Optional pre-warm via CLI:
```bash
.venv/bin/python -m app.ingest            # all domains
.venv/bin/python -m app.ingest exercise   # one domain
```
Reads docs from the source files (`backend/src/rag/knowledgeSources/`: `<domain>Knowledge.ts` + PDFs listed in `sources.PDF_FILES`), embeds with nomic, upserts by `{docId, domain}`.
Skips docs whose md5(title+content) is unchanged; deletes docs gone from the source.

Needs `MONGODB_URI`, `JWT_SECRET` (same as Node); optional `OPENAI_API_KEY` (empty → mock replies),
`COHERE_API_KEY` (empty → no rerank), `PY_PORT` (default 5002).

## Files
| File | Role |
|---|---|
| `app/main.py` | FastAPI app, `/api/chat` routes, SSE streaming for `/message` |
| `app/auth.py` | Verifies Node-issued JWT (HS256, `{id}` payload), loads user from Mongo |
| `app/db.py` | Async PyMongo client; `users`, `conversations`, `knowledgeembeddings` |
| `app/llm.py` | LangChain chat models (OpenAI / Gemini), streaming, embeddings (+ mock mode) |
| `app/rag.py` | Query rewrite → vector search → Cohere rerank; builds system-prompt context |
| `app/sources.py` | Parses knowledge source files (TS arrays + PDFs via pypdf) into docs |
| `app/ingest.py` | Pipeline: source files → nomic-embed-text → `knowledgeembeddings_nomic` |
| `app/roles.json` | Role system prompts, exported from `backend/src/constants/roles.ts` |

## Endpoints (same contract as Node)
- `POST /api/chat/conversations` `{roleId, roleName}`
- `GET /api/chat/conversations`
- `GET /api/chat/conversations/{id}`
- `DELETE /api/chat/conversations/{id}`
- `POST /api/chat/message` `{conversationId, message, roleId}` → SSE: `data: {"content"}` … `data: {"done", conversationId}` / `data: {"error"}`

## Chat flow
1. JWT check → load conversation (owned by user) → `$push` user message.
2. RAG (`rag.get_rag_context`):
   - **fitness**: rewrite query (gpt-4o-mini → keywords) → top 15 cosine over `exercise` embeddings → Cohere rerank to 5.
   - **health**: tag search + 2 semantic extras over `diet` and `meditation` (top 2 each, same as Node defaults).
   - therapist / career: no RAG.
3. System prompt = role prompt + RAG context; plus last 8 messages → OpenAI stream → SSE chunks.
4. `$push` assistant message, send `done`.

## Limitations / status
- With `EMBEDDING_PROVIDER=ollama`, Python reads the source files (incl. PDFs) itself and computes doc embeddings; with `openai` it reads Node's stored vectors.
  Node backend populates them on its first RAG request (`loadOrComputeEmbeddings`).
- Embeddings cached in-process; restart after re-ingesting knowledge.
- If `roles.ts` changes, regenerate `app/roles.json`.

Status (2026-09-23): all 5 chat routes ported and tested against real Mongo; streaming verified.
