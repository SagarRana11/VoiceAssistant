"""
HRMS RAG — retrieval over the company policy PDFs (domain `hrms`, chunked by app/hrms_sources.py).

query → rewrite_query("hrms") → pgvector cosine top-15 (≤ RAG_MAX_DISTANCE) → Cohere rerank top-5 → context + sources.
"""
from sqlalchemy import select

from . import llm
from .config import RAG_MAX_DISTANCE
from .db import KnowledgeEmbedding as KE
from .db import Session
from .rag import _ensure_synced, rerank, rewrite_query

DOMAIN = "hrms"


async def search(query: str, top_k: int = 15) -> list[KE]:
    await _ensure_synced(DOMAIN)
    try:
        q = await llm.embed(query)
    except Exception as err:
        print(f"[HRMS RAG] embedding failed: {err}")
        return []
    dist = KE.embedding.cosine_distance(q)
    async with Session() as s:
        rows = (
            await s.execute(
                select(KE, dist).where(KE.domain == DOMAIN, dist <= RAG_MAX_DISTANCE).order_by(dist).limit(top_k)
            )
        ).all()
    print(f"[HRMS RAG] {len(rows)} hits: " + ", ".join(f"{e.doc_id}={d:.3f}" for e, d in rows[:5]))
    return [e for e, _ in rows]


async def get_hrms_context(message: str, history: list[dict]) -> tuple[str, list[dict]]:
    """Returns (context block for the system prompt, [{doc, title}] sources actually passed to the LLM)."""
    try:
        query = await rewrite_query(message, DOMAIN, history)
        hits = await search(query)
        by_text = {f"### {e.title}\n{e.content}": e for e in hits}
        kept = await rerank(message, list(by_text), 5)
    except Exception as err:
        print(f"[HRMS RAG] retrieval error: {err}")
        return "", []
    if not kept:
        return "\n\n=== POLICY CONTEXT ===\n(no matching policy sections found)", []
    sources, seen = [], set()
    for text in kept:
        e = by_text[text]
        if e.category not in seen:
            seen.add(e.category)
            sources.append({"doc": e.category, "title": e.title.split(" — ")[0]})
    return "\n\n=== POLICY CONTEXT ===\n" + "\n\n".join(kept), sources
