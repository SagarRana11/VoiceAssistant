"""
RAG pipeline for chat — port of chatController.getRagContext.

Knowledge docs (domains: exercise / diet / meditation / general). The `general` role (no role selected)
searches every domain by the query itself. With
EMBEDDING_PROVIDER=ollama they are read from the source files
(backend/src/rag/knowledgeSources, see app/sources.py) and embedded by nomic-embed-text into `knowledgeembeddings_nomic`
(computed on first use per domain and stored; later loads reuse them).
"""
from functools import lru_cache

from langchain_core.documents import Document
from sqlalchemy import select

from . import llm
from .config import COHERE_API_KEY, RAG_MAX_DISTANCE, RAG_RELATIVE_MARGIN
from .db import KnowledgeEmbedding as KE, Session
from .ingest import DOMAINS, sync_domain

_synced: set[str] = set()


async def _ensure_synced(domain: str) -> None:
    # Like Node's loadOrComputeEmbeddings: embed missing/changed docs once per process, reuse stored ones after.
    if domain not in _synced:
        await sync_domain(domain)
        _synced.add(domain)


def _row(e: KE) -> dict:
    return {"docId": e.doc_id, "title": e.title, "content": e.content, "tags": e.tags}


def _fmt(doc: dict) -> str:
    return f"### {doc['title']}\n{doc['content']}"


async def similarity_search(domain: str, query: str, top_k: int) -> list[dict]:
    await _ensure_synced(domain)
    try:
        q = await llm.embed(query)
    except Exception as err:
        # Tag search still works without embeddings — degrade instead of dropping all context.
        print(f"[RAG] embedding failed, skipping semantic search: {err}")
        return []
    async with Session() as s:
        rows = await s.scalars(
            select(KE).where(KE.domain == domain).order_by(KE.embedding.cosine_distance(q)).limit(top_k)
        )
        return [_row(e) for e in rows]


async def search_all_domains(query: str, top_k: int) -> list[dict]:
    """Semantic search over every domain — used when no role picks the domain for us."""
    for domain in DOMAINS:
        await _ensure_synced(domain)
    try:
        q = await llm.embed(query)
    except Exception as err:
        print(f"[RAG] embedding failed, skipping semantic search: {err}")
        return []
    dist = KE.embedding.cosine_distance(q)
    async with Session() as s:
        rows = (
            await s.execute(select(KE, dist).where(dist <= RAG_MAX_DISTANCE).order_by(dist).limit(top_k))
        ).all()
    if rows:
        rows = [(e, d) for e, d in rows if d <= rows[0][1] + RAG_RELATIVE_MARGIN]
    print(f"[RAG:general] {len(rows)} chunks kept: " + ", ".join(f"{e.doc_id}={d:.3f}" for e, d in rows[:5]))
    return [_row(e) for e, _ in rows]


async def search_by_tags(domain: str, tags: list[str], top_k: int) -> list[dict]:
    await _ensure_synced(domain)
    tag_list = [t.lower() for t in tags]
    async with Session() as s:
        rows = await s.scalars(
            select(KE)
            .where(KE.domain == domain, KE.tags.overlap(tag_list))
            .order_by(KE.id)
            .limit(top_k)
        )
        matches = [_row(e) for e in rows]
    if len(matches) >= top_k:
        return matches
    seen = {e["docId"] for e in matches}
    for e in await similarity_search(domain, " ".join(tags), top_k):
        if e["docId"] not in seen:
            matches.append(e)
            seen.add(e["docId"])
            if len(matches) >= top_k:
                break
    return matches


async def _tags_plus_semantic(domain: str, tags: list[str], query: str, top_k: int) -> list[str]:
    docs = await search_by_tags(domain, list(dict.fromkeys(tags)), top_k)
    seen = {d["docId"] for d in docs}
    for d in await similarity_search(domain, query, 2):
        if d["docId"] not in seen:
            docs.append(d)
            seen.add(d["docId"])
    return [_fmt(d) for d in docs[: top_k + 2]]


# ─── Query rewriter (queryRewriter.ts) ────────────────────────────────────────
_REWRITE_PROMPTS = {
    "general": """Rewrite the user message as a standalone search query of 6–12 lowercase keywords for a document vector search.
Resolve pronouns and follow-ups using the conversation. Keep names, places, laws, articles and key terms. No punctuation.
Example: "what are my fundamental duties in india" → fundamental duties citizens india constitution article 51a""",
    "fitness": """Rewrite the user message as 6–10 space-separated lowercase keywords for a fitness vector search.
No sentences, no punctuation. Focus on: exercise types, muscle groups, goals, training variables, recovery.
Example: "tired and can't lose weight" → fatigue energy weight loss calorie deficit cardio resistance training recovery""",
    "health": """Rewrite the user message as 6–10 space-separated lowercase keywords for a health/wellness vector search.
No sentences, no punctuation. Focus on: symptoms, nutrition, diet, wellness concepts, body systems.
Example: "feel bloated and sluggish after lunch" → bloating digestion gut health meal timing energy fatigue inflammation diet""",
}
_rewrite_cache: dict[str, str] = {}


async def rewrite_query(message: str, domain: str, history: list[dict]) -> str:
    key = f"{domain}::{message[:200]}"
    if key in _rewrite_cache:
        return _rewrite_cache[key]
    ctx = "".join(f"{m['role']}: {m['content']}\n" for m in history[-2:]) if len(history) >= 2 else ""
    try:
        raw = await llm.chat(
            [
                {"role": "system", "content": _REWRITE_PROMPTS[domain]},
                {"role": "user", "content": f"{ctx}user: {message}\n\nRewrite the user message for domain: {domain}."},
            ],
            max_tokens=60,
            temperature=0.1,
        )
    except Exception:
        print("[QueryRewriter] LLM call failed, using original message")
        return message
    cleaned = raw.strip()
    result = cleaned if len(cleaned) >= 5 and not cleaned.startswith("{") else message
    if len(_rewrite_cache) >= 50:
        _rewrite_cache.pop(next(iter(_rewrite_cache)))
    _rewrite_cache[key] = result
    print(f'[QueryRewriter:{domain}] "{message[:60]}" → "{result}"')
    return result


# ─── Cohere rerank (reRanker.ts) ──────────────────────────────────────────────
@lru_cache
def _reranker():
    from langchain_cohere import CohereRerank

    return CohereRerank(model="rerank-v3.5", cohere_api_key=COHERE_API_KEY)


async def rerank(query: str, docs: list[str], top_k: int) -> list[str]:
    if len(docs) <= top_k or not COHERE_API_KEY:
        return docs[:top_k]
    try:
        reranker = _reranker()
        reranker.top_n = top_k
        ranked = await reranker.acompress_documents([Document(page_content=d) for d in docs], query)
        return [d.page_content for d in ranked]
    except Exception as err:
        print(f"[Reranker] Cohere call failed, using original order: {err}")
        return docs[:top_k]


# ─── Entry point ──────────────────────────────────────────────────────────────
async def get_rag_context(role_id: str, message: str, history: list[dict]) -> str:
    try:
        if role_id == "general":
            # No role → the query itself decides which docs are relevant, across all domains.
            query = await rewrite_query(message, "general", history)
            candidates = [_fmt(d) for d in await search_all_domains(query, 15)]
            docs = await rerank(message, candidates, 5)
            return "\n\n=== RELEVANT KNOWLEDGE ===\n" + "\n\n".join(docs) if docs else ""
        if role_id == "fitness":
            query = await rewrite_query(message, "fitness", history)
            candidates = [_fmt(d) for d in await similarity_search("exercise", query, 15)]
            docs = await rerank(query, candidates, 5)
            return "\n\n=== RELEVANT FITNESS KNOWLEDGE ===\n" + "\n\n".join(docs) if docs else ""
        if role_id == "health":
            await rewrite_query(message, "health", history)  # parity with Node (logged only)
            diet = await _tags_plus_semantic("diet", ["calorie", "macros", "hydration"], "healthy diet", 2)
            med = await _tags_plus_semantic(
                "meditation",
                ["beginner", "foundation", "first_steps", "breathing", "environment"],
                "mindfulness meditation beginner meditation guide",
                2,
            )
            docs = diet + med
            return "\n\n=== RELEVANT HEALTH KNOWLEDGE ===\n" + "\n\n".join(docs) if docs else ""
    except Exception as err:
        print(f"[RAG] retrieval error: {err}")
    return ""
