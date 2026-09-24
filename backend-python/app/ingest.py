"""
Build/refresh `knowledgeembeddings_nomic`.
Called automatically by rag._load on first use of a domain; the CLI is optional
(e.g. to pre-warm).

Source: the actual knowledge files in backend/src/rag/knowledgeSources/
(<domain>Knowledge.ts + PDFs), read by app/sources.py.

Doc text (title/content/tags) is embedded with nomic-embed-text via Ollama. Docs are re-embedded only when their content
hash changes; docs removed from the source are removed here too.

    python -m app.ingest            # all domains
    python -m app.ingest exercise   # one domain
"""
import asyncio
import hashlib
import sys
from datetime import datetime, timezone

from . import llm
from .config import OLLAMA_EMBED_MODEL
from .db import knowledge_embeddings_nomic
from .sources import load_domain_docs

DOMAINS = ["exercise", "diet", "meditation"]
BATCH = 16


def _hash(doc: dict) -> str:
    # Same formula as backend/src/rag/embeddingStore.ts
    return hashlib.md5(f"{doc['title']}\n{doc['content']}".encode()).hexdigest()


async def sync_domain(domain: str) -> int:
    """Returns number of docs (re)embedded."""
    await knowledge_embeddings_nomic.create_index([("docId", 1), ("domain", 1)], unique=True)
    source = load_domain_docs(domain)
    existing = {
        d["docId"]: d.get("contentHash")
        async for d in knowledge_embeddings_nomic.find({"domain": domain}, {"docId": 1, "contentHash": 1})
    }

    todo = [d for d in source if existing.get(d["docId"]) != _hash(d)]
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        vectors = await llm.embed_documents([f"{d['title']}\n{d['content']}" for d in batch])
        now = datetime.now(timezone.utc)
        for d, vec in zip(batch, vectors):
            await knowledge_embeddings_nomic.update_one(
                {"docId": d["docId"], "domain": domain},
                {
                    "$set": {
                        "title": d["title"],
                        "category": d.get("category", ""),
                        "content": d["content"],
                        "tags": d.get("tags", []),
                        "embedding": vec,
                        "contentHash": _hash(d),
                        "model": OLLAMA_EMBED_MODEL,
                        "updatedAt": now,
                    },
                    "$setOnInsert": {"createdAt": now},
                },
                upsert=True,
            )

    stale = set(existing) - {d["docId"] for d in source}
    if stale:
        await knowledge_embeddings_nomic.delete_many({"domain": domain, "docId": {"$in": list(stale)}})

    print(f"[Ingest:{domain}] {len(source)} docs, {len(todo)} embedded, {len(stale)} removed")
    return len(todo)


async def main(domains: list[str]) -> None:
    for domain in domains:
        await sync_domain(domain)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or DOMAINS))
