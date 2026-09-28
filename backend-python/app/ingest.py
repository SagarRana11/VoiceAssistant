"""
Build/refresh the Postgres `knowledge_embeddings` table (pgvector).
Called automatically by rag._ensure_synced on first use of a domain; the CLI is optional
(e.g. to pre-warm).

Source: the actual knowledge files in backend/src/rag/knowledgeSources/
(<domain>Knowledge.ts + PDFs), plus backend-python/knowledge/ for the `general` domain, read by app/sources.py.

Doc text (title/content/tags) is embedded with nomic-embed-text via Ollama. Docs are re-embedded only when their content
hash changes; docs removed from the source are removed here too.

    python -m app.ingest            # all domains
    python -m app.ingest exercise   # one domain
    python -m app.ingest hrms       # company policy PDFs → hrms_parents / hrms_chunks (HRMS_LLM_CONTEXT=1 for LLM context)
"""
import asyncio
import hashlib
import sys
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from . import llm
from .config import EMBEDDING_PROVIDER, OLLAMA_EMBED_MODEL
from .db import HrmsChunk, HrmsParent, KnowledgeEmbedding as KE, Session, now
from .sources import load_domain_docs

DOMAINS = ["exercise", "diet", "meditation", "general"]
HRMS_DOMAIN = "hrms"  # kept out of DOMAINS so general chat never searches HR policies
BATCH = 16


def _hash(doc: dict) -> str:
    # Same formula as backend/src/rag/embeddingStore.ts
    return hashlib.md5(f"{doc['title']}\n{doc['content']}".encode()).hexdigest()


async def sync_domain(domain: str) -> int:
    """Returns number of docs (re)embedded."""
    model = OLLAMA_EMBED_MODEL if EMBEDDING_PROVIDER == "ollama" else "text-embedding-3-small"
    source = load_domain_docs(domain)
    async with Session() as s:
        existing = dict((await s.execute(select(KE.doc_id, KE.content_hash).where(KE.domain == domain))).all())

        todo = [d for d in source if existing.get(d["docId"]) != _hash(d)]
        for i in range(0, len(todo), BATCH):
            batch = todo[i : i + BATCH]
            vectors = await llm.embed_documents([f"{d['title']}\n{d['content']}" for d in batch])
            ts = now()
            for d, vec in zip(batch, vectors):
                values = {
                    "title": d["title"],
                    "category": d.get("category", ""),
                    "content": d["content"],
                    "tags": [t.lower() for t in d.get("tags", [])],
                    "embedding": vec,
                    "content_hash": _hash(d),
                    "model": model,
                    "updated_at": ts,
                }
                stmt = insert(KE).values(doc_id=d["docId"], domain=domain, created_at=ts, **values)
                await s.execute(stmt.on_conflict_do_update(constraint="uq_knowledge_doc_domain", set_=values))
            await s.commit()

        stale = set(existing) - {d["docId"] for d in source}
        if stale:
            await s.execute(delete(KE).where(KE.domain == domain, KE.doc_id.in_(stale)))
            await s.commit()

    print(f"[Ingest:{domain}] {len(source)} docs, {len(todo)} embedded, {len(stale)} removed")
    return len(todo)


async def sync_hrms() -> int:
    """Company policy PDFs → hrms_parents + hrms_chunks (app/hrms_chunking). Re-embeds only changed children.

    Optional HRMS_LLM_CONTEXT=1 adds an LLM-written situating context per child (contextual retrieval);
    it is part of the embedded text and cached through the content hash.
    """
    import os

    from .hrms_chunking import load_hrms_chunks
    from .hrms_chunking.enrich import llm_context

    use_ctx = os.getenv("HRMS_LLM_CONTEXT") == "1"
    model = OLLAMA_EMBED_MODEL if EMBEDDING_PROVIDER == "ollama" else "text-embedding-3-small"
    parents, children = load_hrms_chunks()
    parent_text = {p["parent_id"]: p["content"] for p in parents}
    async with Session() as s:
        ts = now()
        for p in parents:
            values = {"doc": p["doc"], "title": p["title"], "content": p["content"], "updated_at": ts}
            await s.execute(insert(HrmsParent).values(parent_id=p["parent_id"], created_at=ts, **values)
                            .on_conflict_do_update(index_elements=["parent_id"], set_=values))
        await s.commit()

        existing = dict((await s.execute(select(HrmsChunk.doc_id, HrmsChunk.content_hash))).all())
        h = lambda c: hashlib.md5(f"{c['embed_text']}|ctx={use_ctx}".encode()).hexdigest()  # noqa: E731
        todo = [c for c in children if existing.get(c["doc_id"]) != h(c)]
        for i in range(0, len(todo), BATCH):
            batch = todo[i : i + BATCH]
            texts = []
            for c in batch:
                ctx = await llm_context(c["meta"]["doc_title"], parent_text[c["parent_id"]], c["content"]) if use_ctx else ""
                if ctx:
                    c["meta"]["llm_context"] = ctx
                texts.append(c["embed_text"] if not ctx else c["embed_text"].replace("\n", f"\n{ctx}\n", 1))
            vectors = await llm.embed_documents(texts)
            ts = now()
            for c, text, vec in zip(batch, texts, vectors):
                values = {k: c[k] for k in ("parent_id", "doc", "doc_type", "element_type", "content", "embed_only", "meta")}
                values |= {"embed_text": text, "embedding": vec, "content_hash": h(c), "model": model, "updated_at": ts}
                await s.execute(insert(HrmsChunk).values(doc_id=c["doc_id"], created_at=ts, **values)
                                .on_conflict_do_update(index_elements=["doc_id"], set_=values))
            await s.commit()
            print(f"[Ingest:hrms] embedded {min(i + BATCH, len(todo))}/{len(todo)}")

        stale = set(existing) - {c["doc_id"] for c in children}
        if stale:
            await s.execute(delete(HrmsChunk).where(HrmsChunk.doc_id.in_(stale)))
        await s.execute(delete(HrmsParent).where(HrmsParent.parent_id.not_in(list(parent_text))))
        await s.commit()
    print(f"[Ingest:hrms] {len(parents)} parents, {len(children)} children, {len(todo)} embedded, {len(stale)} removed")
    return len(todo)


async def main(domains: list[str]) -> None:
    from .db import init_db

    await init_db()
    for domain in domains:
        await (sync_hrms() if domain == HRMS_DOMAIN else sync_domain(domain))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or [*DOMAINS, HRMS_DOMAIN]))
