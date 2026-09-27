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
| `LLM_PROVIDER` | `gemini` | `gemini` \| `openai` \| `ollama` (local, no key) \| `mock` (falls back to mock if gemini/openai key missing) |
| `OLLAMA_CHAT_MODEL` | `qwen2.5:7b` | Chat model when `LLM_PROVIDER=ollama` (`ollama pull qwen2.5:7b`) |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | — | |
| `GEMINI_MODEL` / `OPENAI_MODEL` | `gemini-3.5-flash` / `gpt-4o-mini` | |
| `EMBEDDING_PROVIDER` | `ollama` | `ollama` (nomic, 768-dim) \| `openai` (text-embedding-3-small, 1536-dim). Column size follows it — switching needs `knowledge_embeddings` dropped & re-ingested |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | |
| `COHERE_API_KEY` | — | empty → no rerank |
| `RAG_MAX_DISTANCE` | `0.45` | General role: max cosine distance for a chunk to count as relevant |
| `RAG_RELATIVE_MARGIN` | `0.15` | General role: also drop chunks this much worse than the best hit |

## Database (Postgres, SQLAlchemy async, `app/db.py`)
| Table | Columns |
|---|---|
| `users` | id UUID, name, email (unique, lowercased), password_hash (bcrypt 12), timestamps |
| `conversations` | id UUID, user_id → users (cascade), role_id, role_name, timestamps |
| `messages` | id UUID, conversation_id → conversations (cascade), role, content, timestamp |
| `knowledge_embeddings` | doc_id+domain unique, title, category, content, tags TEXT[] (lowercased), embedding VECTOR, content_hash, model |

**Employee / HRMS tables** (`app/models/employee.py`, share `Base` from `app/db.py`):
| Table | Columns |
|---|---|
| `employees` | id UUID, employee_id (EMP10xx), name, email, dept/level/status enums, role, hire_date, experience_years, manager_id → employees (self FK), location, bio |
| `education` | employee_id →, degree, field_of_study, institution, graduation_year, gpa, honors |
| `skills` | employee_id →, skill_name, category enum, proficiency 1–5, years_experience, last_used, is_current |
| `experience` | employee_id →, company, role, start/end, is_current, technologies[], achievements[] |
| `performance_reviews` | employee_id →, reviewer_id → employees, period (Q1–Q4/FY), type (quarterly/yearly), period_start/end, review_date, status, overall_rating; unique (emp, period, type, start) |
| `review_sections` | review_id →, section_type (manager_feedback/self_assessment/goals/achievements), content, rating; unique (review, type) |
| `project_reports` | employee_id →, project/client name, role, dates, technologies[], team_size, outcome, value |
| `client_reviews` | project_report_id →, client name/org, rating, feedback, would_recommend |
| `training_records` | employee_id →, name, provider, category, dates, hours, certification, score, status |
| `peer_feedback` | employee_id → (receiver), from_employee_id → (giver), text, rating, category, date, is_anonymous |

All child FKs `ON DELETE CASCADE`. Seed: `.venv/bin/python -m scripts.seed_employees` (idempotent: truncates + reinserts).

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

**HRMS** (Bearer required; `app/hrms_routes.py`) — HR policy Q&A over `company_docs/pdf/`
- `POST /api/hrms/conversations` (no body) → conversation with `roleId: "hrms"`
- `GET /api/hrms/conversations` / `GET …/{id}` / `DELETE …/{id}` — only hrms conversations (`/api/chat` lists exclude them)
- `POST /api/hrms/message` `{conversationId, message}` → SSE: `{"content"}` … `{"done", conversationId, sources:[{doc,title}]}`

## Files
| File | Role |
|---|---|
| `app/main.py` | FastAPI app, lifespan `init_db`, CORS, `/api/chat` routes, SSE streaming, JSON serializers |
| `app/schemas.py` | Pydantic request/response models (typed like TS interfaces, validated at runtime; camelCase JSON via aliases) |
| `app/auth_routes.py` | `/api/auth` register / login / me |
| `app/auth.py` | bcrypt hash/check, JWT sign, `current_user` dependency |
| `app/db.py` | Async engine/session, ORM models, `init_db` (vector extension + tables) |
| `app/config.py` | Env config |
| `app/llm.py` | LangChain chat models (Gemini / OpenAI / Ollama-Qwen / mock), streaming, embeddings |
| `app/rag.py` | Query rewrite → pgvector cosine search / tag overlap → Cohere rerank |
| `app/ingest.py` | Source docs → embeddings → upsert into `knowledge_embeddings` (hash-skip, stale delete) |
| `app/sources.py` | Parses knowledge source files (TS arrays + PDFs) into docs; chunks `knowledge/` files for `general` |
| `knowledge/` | Drop any `.pdf` / `.md` / `.txt` here → `general` domain (~1200-char chunks, 200 overlap). Sample: Constitution of India Art. 51A |
| `app/roles.json` | Role system prompts |
| `app/models/employee.py` | HRMS ORM models + enums (10 tables above) |
| `scripts/generate_employee_data.py` | Seeded (stdlib `random`) factory: 20 employees, each with a persona (2 strengths, 2 recurring concerns, career goal, rating trend) that drives coherent review/peer/client text and concern-matched training. Run directly to print a summary |
| `scripts/seed_employees.py` | Truncates employee tables, inserts generated data (employees first, then managers + children), prints row counts |
| `company_docs/` | 16 company-level HR docs (handbook, policies, statutory compliance calendar, holidays) as Markdown; no employee data. Index in `company_docs/README.md` |
| `scripts/build_company_pdfs.py` | Renders `company_docs/*.md` into `company_docs/pdf/` using 9 different layouts (book, legal, matrix, twocol, faq, slides, sheet, checklist, memo), so each doc needs a different chunking strategy. Mapping in `LAYOUTS` and in `company_docs/README.md` |

| `app/chat_common.py` | Shared conversation helpers (load/push message, serializers, SSE) for `/api/chat` and `/api/hrms` |
| `app/hrms_sources.py` | Chunks `company_docs/pdf/*.pdf` for RAG domain `hrms`: pypdf visitor → positioned lines (font/size/x/y) → one chunker per layout (book/legal/faq/slides/memo/matrix/sheet/checklist/twocol). Interim; industry-grade per-PDF chunking is next |
| `app/hrms_rag.py` | HRMS retrieval: rewrite query (`hrms` prompt) → pgvector top 15 in `hrms` → Cohere rerank 5 → context + sources |
| `app/hrms_routes.py` | `/api/hrms` router (conversations + SSE message), HR system prompt from `roles.json["hrms"]` |

## HRMS flow
1. `python -m app.ingest hrms` (or first request) → `hrms_sources.load_hrms_docs()` → 219 chunks → nomic embeddings in `knowledge_embeddings` (domain `hrms`, not in `DOMAINS`, so general chat never sees it).
2. `POST /api/hrms/message` → save user msg → `hrms_rag.get_hrms_context` → system prompt (answer only from policy context, cite policy, no personal records) + last 6 msgs → stream → save → `done` with sources.
3. Frontend `frontend-next` `/hrms` page: own history, suggested questions, source chips; linked from `/chat` rail.

## Chat flow
1. JWT → user from Postgres → load conversation (must belong to user) → insert user message.
2. RAG (`rag.get_rag_context`):
   - **fitness**: rewrite query → top 15 by `embedding <=> q` over `exercise` → Cohere rerank to 5.
   - **health**: tag overlap (`tags && …`) + 2 semantic extras over `diet` and `meditation`.
   - **general** (no role): rewrite query to standalone keywords → top 15 by cosine over **all** domains
     (exercise, diet, meditation, general) filtered by `RAG_MAX_DISTANCE` + `RAG_RELATIVE_MARGIN` → Cohere rerank to 5.
     Nothing relevant → no context, LLM answers from general knowledge.
   - therapist / career: no RAG.
   - First use of a domain per process runs `ingest.sync_domain` (embeds new/changed docs only).
3. System prompt = role prompt + RAG context + last 8 messages → LLM stream → SSE chunks.
4. Insert assistant message, bump `updated_at`, send `done`.

## Status
2026-09-24: Mongo → Postgres/pgvector migration done; own auth added. Verified with curl: register/login/me
(409/401 paths), conversation CRUD, SSE streaming, ingest (exercise 18, diet 10, meditation 10), fitness + health RAG.
Existing Mongo users/conversations were not migrated — users register again.

2026-09-24: `general` (no-role) role added — query-routed RAG across all domains + `knowledge/` folder.
Verified: "what are my fundamental duties in India" → only the 2 Constitution chunks retrieved, answer lists all 11
duties of Art. 51A; "how do I build muscle" → exercise + diet docs; "capital of peru" → no context. Frontend-next:
General Assistant listed first, and typing with no conversation open auto-starts a General conversation.

2026-09-24: `LLM_PROVIDER=ollama` added (ChatOllama, default `qwen2.5:7b`) — chat + query rewriter fully local.
Verified: general-role Art. 51A question answered from the Constitution chunks (~47s incl. cold model load);
fitness chat streams (~31s). Slower and a bit less complete than Gemini (listed 10 of 11 duties).

2026-09-25: HRMS employee data. Fixed model bugs (`cascade="all", delete-orphan` syntax error, separate `Base` so tables
never created, ambiguous `performance_reviews` FK, duplicate index names). Seeded: 20 employees, 26 education, 155 skills,
45 experience, 300 reviews (3 yrs × Q1–Q4+FY), 1200 sections, 95 projects, 39 client reviews, 183 training, 836 peer
feedback. Future-dated 2026 reviews (Q4, FY2026) are `draft` with no rating. Demo subject: John Smith (EMP1001).
Next: RAG over employee data for the 5 John questions (TODO.md).


- 2026-09-25: Added `company_docs/` (company-only HR handbook + policies).
- 2026-09-25: Company docs expanded (~8.6k words) and rendered to PDFs with 9 layouts for chunking-strategy experiments.
- 2026-09-25: HRMS RAG. `/api/hrms` routes + `/hrms` Next.js page; interim per-layout PDF chunker, 219 chunks embedded; verified end-to-end with curl.
  Known issue: matrix rows with wrapped labels mis-pair (e.g. sick leave answered 6 instead of 12). Next: industry-grade per-PDF chunking
  (structure-aware elements, parent–child, contextual retrieval, table-row serialization, metadata filters, hybrid BM25+vector, eval set).
