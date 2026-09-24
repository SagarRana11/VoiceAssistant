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
"""
import asyncio
import hashlib
import sys
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from . import llm
from .config import EMBEDDING_PROVIDER, OLLAMA_EMBED_MODEL
from .db import KnowledgeEmbedding as KE, Session, now
from .sources import load_domain_docs

DOMAINS = ["exercise", "diet", "meditation", "general"]
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


async def main(domains: list[str]) -> None:
    from .db import init_db

    await init_db()
    for domain in domains:
        await sync_domain(domain)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or DOMAINS))
