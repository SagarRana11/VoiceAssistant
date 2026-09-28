"""
Retrieval evaluation for the HRMS RAG (gold set: scripts/hrms_eval.json — question, expected doc, key fact).

    .venv/bin/python -m scripts.eval_hrms            # legacy vs vector vs hybrid
    .venv/bin/python -m scripts.eval_hrms --misses   # also print failed questions

Metrics per setting:
    doc@5     expected doc among the top-5 retrieved units (legacy: chunks; new: parents)
    MRR       reciprocal rank of the first unit from the expected doc
    fact hit  expected fact appears within 80 chars of its anchor term in the context sent to the LLM
              (legacy: top-5 chunks as before; new: parent-expanded context, top 4 parents)
Query rewriting is skipped (raw question) so settings are compared on retrieval only.
"""
import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Final, Literal, TypedDict, cast

from app.hrms_rag import PARENTS_OUT, expand_parents, legacy_search, retrieve_children

Setting = Literal["legacy", "vector", "hybrid"]


class GoldItem(TypedDict):
    q: str
    doc: str
    anchor: str
    fact: str


class EvalResult(TypedDict):
    setting: Setting
    doc_at_5: float
    MRR: float
    fact_hit: float
    ctx_tok: int
    weak_docs: list[str]


Miss = tuple[str, str, list[str]]  # (question, wanted fact, top-3 docs)

GOLD: Final = cast(list[GoldItem], json.loads((Path(__file__).parent / "hrms_eval.json").read_text()))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).lower()


def fact_near_anchor(ctx: str, anchor: str, fact: str, window: int = 80) -> bool:
    """The fact must sit within `window` chars of the anchor — i.e. correctly paired, not just present somewhere."""
    c, a, f = norm(ctx), norm(anchor), norm(fact)
    for m in re.finditer(re.escape(a), c):
        if f in c[max(0, m.start() - window - len(f)) : m.end() + window + len(f)]:
            return True
    return False


async def run(setting: Setting) -> tuple[EvalResult, list[Miss]]:
    hits5 = facts = tokens = 0
    rr = 0.0
    misses: list[Miss] = []
    per_doc: dict[str, list[bool]] = {}
    for g in GOLD:
        if setting == "legacy":
            units: list[tuple[str, str]] = [(str(e.category), f"{e.title}\n{e.content}") for e in await legacy_search(g["q"])][:5]
        else:
            parents = await expand_parents(await retrieve_children(g["q"], g["q"], mode=setting))
            units = [(str(p["doc"]), str(p["text"])) for p in parents][:5]
        docs = [d for d, _ in units]
        rank = docs.index(g["doc"]) + 1 if g["doc"] in docs else 0
        ctx = " ".join(t for _, t in units[: 5 if setting == "legacy" else PARENTS_OUT])
        fact = fact_near_anchor(ctx, g["anchor"], g["fact"])
        tokens += len(ctx) // 4
        hits5 += bool(rank)
        rr += 1 / rank if rank else 0
        facts += fact
        per_doc.setdefault(g["doc"], []).append(fact)
        if not fact:
            misses.append((g["q"], g["fact"], docs[:3]))
    n = len(GOLD)
    weak = [d for d, v in per_doc.items() if sum(v) < 2]
    return {"setting": setting, "doc_at_5": hits5 / n, "MRR": rr / n, "fact_hit": facts / n, "ctx_tok": tokens // n, "weak_docs": weak}, misses


async def main() -> None:
    settings: tuple[Setting, ...] = ("legacy", "vector", "hybrid")
    rows: list[EvalResult] = []
    for setting in settings:
        res, misses = await run(setting)
        rows.append(res)
        if "--misses" in sys.argv:
            print(f"\n-- {setting} misses")
            for q, f, d in misses:
                print(f"   {q!r} (want {f!r}) got {d}")
    print(f"\n{'setting':<8} {'doc@5':>6} {'MRR':>6} {'fact':>6} {'ctx tok':>8}  docs with <2/3 facts")
    for r in rows:
        print(f"{r['setting']:<8} {r['doc_at_5']:>6.2f} {r['MRR']:>6.2f} {r['fact_hit']:>6.2f} {r['ctx_tok']:>8}  "
              f"{', '.join(r['weak_docs']) or '-'}")


if __name__ == "__main__":
    asyncio.run(main())
