"""
HRMS RAG — hybrid, parent–child retrieval over the company policy PDFs (tables hrms_chunks / hrms_parents,
built by app/hrms_chunking + ingest.sync_hrms).

    question ─► rewrite_query("hrms") ─► keywords
             └► entities() ─► scope filter (country / level)       e.g. "Toronto" → country=canada
    vector top-20 (pgvector cosine on children)  ┐
    keyword top-20 (tsvector, OR of lexemes)     ┴► Reciprocal Rank Fusion (k=60)
    → group children by parent (small-to-big) → parent text (≤1200 tok, else matched child ± neighbours)
    → Cohere rerank to 4 → "=== POLICY CONTEXT ===" + sources [{doc, title, section}]

Scope filter keeps children whose meta has no country/level (generic rules) or a matching one; if the filter
leaves nothing, the unfiltered search is used.
"""
import re

from sqlalchemy import func, literal, or_, select, text

from . import llm
from .db import HrmsChunk as C, HrmsParent as P, KnowledgeEmbedding as KE, Session
from .hrms_chunking.enrich import entities
from .hrms_chunking.strategies import tok
from .rag import _ensure_synced, rerank, rewrite_query

RRF_K, TOP_N, PARENTS_OUT, PARENT_MAX = 60, 20, 4, 1200
KW_WEIGHT, KW_MAX_DF = 0.6, 0.04  # keyword channel weight in RRF; keep only lexemes in ≤4% of chunks (IDF filter)
_df: dict[str, int] = {}
_n_chunks = 0


async def _load_df() -> None:
    """Corpus document frequency per lexeme (ts_stat) — lets the keyword channel ignore common words (BM25-style IDF)."""
    global _n_chunks
    if _df:
        return
    async with Session() as s:
        _n_chunks = await s.scalar(select(func.count()).select_from(C)) or 1
        rows = await s.execute(text("SELECT word, ndoc FROM ts_stat('SELECT tsv FROM hrms_chunks')"))
        _df.update({w: n for w, n in rows.all()})


async def _rare_lexemes(query: str) -> list[str]:
    await _load_df()
    async with Session() as s:
        lex = await s.scalar(select(func.array_to_string(func.tsvector_to_array(func.to_tsvector("english", query)), " ")))
    return [w for w in (lex or "").split() if 0 < _df.get(w, 0) <= max(2, KW_MAX_DF * _n_chunks)]


def _scope(where, meta_filter: dict):
    for key in ("country", "level"):
        vals = meta_filter.get(key)
        if vals:
            where.append(or_(~C.meta.has_key(key), *[C.meta[key].contains([v]) for v in vals]))
    return where


async def _vector(qvec, meta_filter: dict, n: int = TOP_N) -> list[C]:
    async with Session() as s:
        where = _scope([], meta_filter)
        return list(await s.scalars(select(C).where(*where).order_by(C.embedding.cosine_distance(qvec)).limit(n)))


async def _keyword(query: str, meta_filter: dict, n: int = TOP_N) -> list[C]:
    words = await _rare_lexemes(query)
    if not words:
        return []
    async with Session() as s:
        tsq = func.to_tsquery("simple", literal(" | ".join(re.sub(r"[^\w]", "", w) for w in words)))
        where = _scope([C.tsv.op("@@")(tsq)], meta_filter)
        rank = func.ts_rank_cd(C.tsv, tsq)
        return list(await s.scalars(select(C).where(*where).order_by(rank.desc()).limit(n)))


def _rrf(*ranked: tuple[list[C], float]) -> list[tuple[C, float]]:
    score: dict[str, float] = {}
    by_id: dict[str, C] = {}
    for lst, weight in ranked:
        for r, c in enumerate(lst):
            score[c.doc_id] = score.get(c.doc_id, 0) + weight / (RRF_K + r + 1)
            by_id[c.doc_id] = c
    return sorted(((by_id[d], s) for d, s in score.items()), key=lambda x: -x[1])


async def retrieve_children(question: str, query: str, mode: str = "hybrid") -> list[C]:
    """Ranked children. mode: 'vector' | 'hybrid'. Scope filter from entities in the question."""
    meta_filter = {k: v for k, v in entities(question).items() if k in ("country", "level")}
    try:
        qvec = await llm.embed(query)
    except Exception as err:
        print(f"[HRMS RAG] embedding failed: {err}")
        qvec = None
    for f in ([meta_filter, {}] if meta_filter else [{}]):
        vec = await _vector(qvec, f) if qvec is not None else []
        kw = await _keyword(query, f) if mode == "hybrid" else []
        fused = [c for c, _ in _rrf((vec, 1.0), (kw, KW_WEIGHT))]
        if fused:
            return fused
    return []


async def expand_parents(children: list[C], limit: int = 8) -> list[dict]:
    """Small-to-big: best-ranked parents; oversized parents shrink to the matched child ± 1 neighbour."""
    order: list[str] = []
    hits: dict[str, list[C]] = {}
    for c in children:
        if c.parent_id not in hits:
            order.append(c.parent_id)
        hits.setdefault(c.parent_id, []).append(c)
    order = order[:limit]
    async with Session() as s:
        parents = {p.parent_id: p for p in await s.scalars(select(P).where(P.parent_id.in_(order)))}
        out = []
        for pid in order:
            p = parents.get(pid)
            if not p:
                continue
            text = p.content
            if tok(text) > PARENT_MAX:
                want = {o + d for c in hits[pid] for o in [c.meta.get("ordinal", 0)] for d in (-1, 0, 1)}
                sibs = await s.scalars(select(C).where(C.parent_id == pid, C.embed_only.is_(False)))
                text = "\n".join(c.content for c in sorted(sibs, key=lambda c: c.meta.get("ordinal", 0))
                                 if c.meta.get("ordinal", 0) in want)
            # table-derived hits: also give the matched row serialized with its headers ("Canada: … RRSP 4% match")
            rows = [c.content for c in hits[pid] if c.element_type in ("row", "country_pivot") and c.content not in text]
            if rows:
                text = "Matched: " + " || ".join(rows[:3]) + "\n" + text
            m = hits[pid][0].meta
            out.append({"doc": p.doc, "title": p.title, "text": f"### {p.title}\n{text}",
                        "doc_title": m.get("doc_title", p.doc), "section": " › ".join(m.get("section_path", []))})
    return out


async def get_hrms_context(message: str, history: list[dict]) -> tuple[str, list[dict]]:
    """Returns (context block for the system prompt, sources [{doc, title, section}])."""
    try:
        query = await rewrite_query(message, "hrms", history)
        kids = await retrieve_children(message, query)
        parents = await expand_parents(kids)
        by_text = {p["text"]: p for p in parents}
        kept = await rerank(message, list(by_text), PARENTS_OUT)
    except Exception as err:
        print(f"[HRMS RAG] retrieval error: {err}")
        return "", []
    print(f"[HRMS RAG] {len(kids)} children → {len(parents)} parents → {len(kept)}: "
          + ", ".join(by_text[t]["title"][:50] for t in kept))
    if not kept:
        return "\n\n=== POLICY CONTEXT ===\n(no matching policy sections found)", []
    sources, seen = [], set()
    for t in kept:
        p = by_text[t]
        if p["title"] not in seen:
            seen.add(p["title"])
            sources.append({"doc": p["doc"], "title": p["doc_title"], "section": p["section"]})
    return "\n\n=== POLICY CONTEXT ===\n" + "\n\n".join(kept), sources


# ─── Legacy (interim per-layout chunks in knowledge_embeddings, domain "hrms") — kept for eval only ───────────
async def legacy_search(query: str, top_k: int = 15) -> list[KE]:
    await _ensure_synced("hrms")
    q = await llm.embed(query)
    async with Session() as s:
        return list(await s.scalars(
            select(KE).where(KE.domain == "hrms").order_by(KE.embedding.cosine_distance(q)).limit(top_k)
        ))
