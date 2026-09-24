"""
RAG pipeline for chat — port of chatController.getRagContext.

Knowledge docs (domains: exercise / diet / meditation). With
EMBEDDING_PROVIDER=ollama they are read from the source files
(backend/src/rag/knowledgeSources, see app/sources.py) and embedded by nomic-embed-text into `knowledgeembeddings_nomic`
(computed on first use per domain and stored; later loads reuse them).
"""
import math
from functools import lru_cache

from langchain_core.documents import Document

from . import llm
from .config import COHERE_API_KEY, EMBEDDING_PROVIDER
from .db import knowledge_embeddings, knowledge_embeddings_nomic
from .ingest import sync_domain

_stores: dict[str, list[dict]] = {}


async def _load(domain: str) -> list[dict]:
    if domain not in _stores:
        if EMBEDDING_PROVIDER == "ollama":
            # Like Node's loadOrComputeEmbeddings: embed missing/changed docs once, reuse stored ones after.
            await sync_domain(domain)
            coll = knowledge_embeddings_nomic
        else:
            coll = knowledge_embeddings
        cursor = coll.find({"domain": domain}).sort("_id", 1)
        _stores[domain] = await cursor.to_list(None)
        print(f"[RAG] {domain}: {len(_stores[domain])} docs loaded from MongoDB")
    return _stores[domain]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)) + 1e-10)


def _fmt(doc: dict) -> str:
    return f"### {doc['title']}\n{doc['content']}"


async def similarity_search(domain: str, query: str, top_k: int) -> list[dict]:
    entries = await _load(domain)
    if not entries:
        return []
    try:
        q = await llm.embed(query)
    except Exception as err:
        # Tag search still works without embeddings — degrade instead of dropping all context.
        print(f"[RAG] embedding failed, skipping semantic search: {err}")
        return []
    return sorted(entries, key=lambda e: _cosine(q, e["embedding"]), reverse=True)[:top_k]


async def search_by_tags(domain: str, tags: list[str], top_k: int) -> list[dict]:
    entries = await _load(domain)
    tag_set = {t.lower() for t in tags}
    matches = [e for e in entries if any(t.lower() in tag_set for t in e.get("tags", []))]
    if len(matches) >= top_k:
        return matches[:top_k]
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
