# backend-python — Auth + Chat service (FastAPI + Postgres)

Standalone Python backend: auth (register/login/me) and role-based RAG chat.
**No dependency on the Node backend at runtime** — own Postgres DB, own JWT secret, own `.env`.
(Knowledge *source files* are still read from `backend/src/rag/knowledgeSources/` at ingest time.)

Frontend: `frontend-next/` (Next.js) proxies `/api/*` here.

## Run

```bash
# Postgres 17 + pgvector (brew's pgvector ships for pg17/18, not pg16)
brew install postgresql@17 pgvector
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb voice_assistant

cd backend-python
uv venv -p 3.12 .venv && uv pip install -p .venv/bin/python -r requirements.txt
.venv/bin/python -m app.main        # http://localhost:5002 — creates tables + vector extension on startup
.venv/bin/python -m app.ingest      # optional pre-warm of embeddings (also runs lazily on first RAG use)
```

Needs Ollama running with `nomic-embed-text` for RAG embeddings (default provider).

## Config (`backend-python/.env` only)
| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://localhost/voice_assistant` | |
| `JWT_SECRET` | — (required) | Own secret; Node tokens are **not** accepted |
| `JWT_EXPIRES_DAYS` | `7` | |
| `CLIENT_URL` | `http://localhost:3000` | CORS origin (Next.js dev) |
| `PY_PORT` | `5002` | |
| `LLM_PROVIDER` | `gemini` | `gemini` \| `openai` \| `mock` (falls back to mock if key missing) |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | — | |
| `GEMINI_MODEL` / `OPENAI_MODEL` | `gemini-3.5-flash` / `gpt-4o-mini` | |
| `EMBEDDING_PROVIDER` | `ollama` | `ollama` (nomic, 768-dim) \| `openai` (text-embedding-3-small, 1536-dim). Column size follows it — switching needs `knowledge_embeddings` dropped & re-ingested |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | |
| `COHERE_API_KEY` | — | empty → no rerank |

## Database (Postgres, SQLAlchemy async, `app/db.py`)
| Table | Columns |
|---|---|
| `users` | id UUID, name, email (unique, lowercased), password_hash (bcrypt 12), timestamps |
| `conversations` | id UUID, user_id → users (cascade), role_id, role_name, timestamps |
| `messages` | id UUID, conversation_id → conversations (cascade), role, content, timestamp |
| `knowledge_embeddings` | doc_id+domain unique, title, category, content, tags TEXT[] (lowercased), embedding VECTOR, content_hash, model |

Tables are created via `create_all` on startup (no migrations yet).

## Endpoints
Errors are always `{ "message": "..." }`. Bodies are Pydantic models (`app/schemas.py`); invalid body → 400 `{message: "<field>: <reason>"}`.

**Auth** (`app/auth_routes.py`)
- `POST /api/auth/register` `{name, email, password}` → 201 `{success, token, user}` · 400 validation · 409 duplicate email
- `POST /api/auth/login` `{email, password}` → `{success, token, user}` · 401 bad credentials
- `GET /api/auth/me` (Bearer) → `{success, user}`
- `user` = `{id, name, email, initials}`; token = HS256 JWT `{id, exp}`

**Chat** (Bearer required; `app/main.py`)
- `POST /api/chat/conversations` `{roleId, roleName}`
- `GET /api/chat/conversations` → summaries with `messageCount`, `lastMessage`
- `GET /api/chat/conversations/{id}` / `DELETE …/{id}` (bad/foreign id → 404)
- `POST /api/chat/message` `{conversationId, message, roleId}` → SSE: `data: {"content"}` … `data: {"done", conversationId}` / `data: {"error"}`

## Files
| File | Role |
|---|---|
| `app/main.py` | FastAPI app, lifespan `init_db`, CORS, `/api/chat` routes, SSE streaming, JSON serializers |
| `app/schemas.py` | Pydantic request/response models (typed like TS interfaces, validated at runtime; camelCase JSON via aliases) |
| `app/auth_routes.py` | `/api/auth` register / login / me |
| `app/auth.py` | bcrypt hash/check, JWT sign, `current_user` dependency |
| `app/db.py` | Async engine/session, ORM models, `init_db` (vector extension + tables) |
| `app/config.py` | Env config |
| `app/llm.py` | LangChain chat models (Gemini / OpenAI / mock), streaming, embeddings |
| `app/rag.py` | Query rewrite → pgvector cosine search / tag overlap → Cohere rerank |
| `app/ingest.py` | Source docs → embeddings → upsert into `knowledge_embeddings` (hash-skip, stale delete) |
| `app/sources.py` | Parses knowledge source files (TS arrays + PDFs) into docs |
| `app/roles.json` | Role system prompts |

## Chat flow
1. JWT → user from Postgres → load conversation (must belong to user) → insert user message.
2. RAG (`rag.get_rag_context`):
   - **fitness**: rewrite query → top 15 by `embedding <=> q` over `exercise` → Cohere rerank to 5.
   - **health**: tag overlap (`tags && …`) + 2 semantic extras over `diet` and `meditation`.
   - therapist / career: no RAG.
   - First use of a domain per process runs `ingest.sync_domain` (embeds new/changed docs only).
3. System prompt = role prompt + RAG context + last 8 messages → LLM stream → SSE chunks.
4. Insert assistant message, bump `updated_at`, send `done`.

## Status
2026-09-24: Mongo → Postgres/pgvector migration done; own auth added. Verified with curl: register/login/me
(409/401 paths), conversation CRUD, SSE streaming, ingest (exercise 18, diet 10, meditation 10), fitness + health RAG.
Existing Mongo users/conversations were not migrated — users register again.

Next: `general` role with query-routed RAG (classifier picks domain/tags from the message).
