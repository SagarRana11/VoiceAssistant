"""
Chunk enrichment: contextual header, entity metadata, size rules, optional LLM context.

- header    "[Doc] › [Section] › [scope]" prepended to every child before embedding (deterministic, free)
- entities  country / location / level / leave_type from dictionaries → meta (used as query filters)
- sizes     children < CHILD_MIN tokens merged into a neighbour of the same parent; > CHILD_MAX split
- llm ctx   optional (HRMS_LLM_CONTEXT=1): 1–2 sentence situating context per child (Anthropic
            "contextual retrieval"), generated from the parent, cached in hrms_chunks.meta by content hash
"""
import re
from typing import Final

from .strategies import CHILD_MAX, CHILD_MIN, split_long, tok
from .types import ChildMeta, ChildSpec, EntityMeta

COUNTRIES: Final[dict[str, list[str]]] = {
    "india": ["india", "gurugram", "bengaluru", "inr", "pf", "esi", "gst", "form 16"],
    "us": ["united states", "us", "usa", "new york", "401(k)", "usd", "w-2"],
    "canada": ["canada", "toronto", "cad", "rrsp", "t4", "roe"],
    "germany": ["germany", "berlin", "eur", "gkv", "lohnsteuer"],
    "singapore": ["singapore", "sgd", "cpf", "ir8a"],
}
LOCATIONS: Final = ["gurugram", "bengaluru", "new york", "toronto", "berlin", "singapore"]
LEVELS: Final = ["intern", "junior", "mid", "senior", "lead", "principal", "director"]
LEAVE_TYPES: Final = ["earned", "sick", "casual", "maternity", "paternity", "bereavement", "marriage",
               "compensatory", "sabbatical", "volunteering", "floating"]


def _has(text: str, word: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(word)}(?![\w-])", text) is not None


def entities(text: str) -> EntityMeta:
    t = text.lower()
    meta: EntityMeta = {}
    if country := [c for c, words in COUNTRIES.items() if any(_has(t, w) for w in words)]:
        meta["country"] = country
    if location := [l for l in LOCATIONS if _has(t, l)]:
        meta["location"] = location
    if level := [l for l in LEVELS if _has(t, l)]:
        meta["level"] = level
    if leave := [l for l in LEAVE_TYPES if _has(t, f"{l} leave") or (l == "floating" and "floating holiday" in t)]:
        meta["leave_type"] = leave
    return meta


def header(doc_title: str, section: list[str], meta: ChildMeta) -> str:
    scope = ", ".join(meta.get("country", []) + meta.get("level", []))
    return f"[{doc_title}] › {' › '.join(section)}" + (f" (applies to: {scope})" if scope else "")


def size_rules(children: list[ChildSpec]) -> list[ChildSpec]:
    """Merge tiny children into the previous one (same parent, same type); split oversized ones."""
    out: list[ChildSpec] = []
    for c in children:
        if out and tok(c["text"]) < CHILD_MIN and not c.get("embed_only") and not out[-1].get("embed_only") \
                and tok(out[-1]["text"]) + tok(c["text"]) <= CHILD_MAX:
            out[-1] = {**out[-1], "text": out[-1]["text"] + "\n" + c["text"]}
        else:
            out.append(c.copy())
    # a tiny first child merges forward into the next one
    if len(out) > 1 and tok(out[0]["text"]) < CHILD_MIN and not out[0].get("embed_only") and not out[1].get("embed_only"):
        out[1] = {**out[1], "text": out[0]["text"] + "\n" + out[1]["text"]}
        out.pop(0)
    final: list[ChildSpec] = []
    for c in out:
        final += [{**c, "text": p} for p in split_long(c["text"], CHILD_MAX)]
    return final


_CTX_PROMPT: Final = """<document>
{parent}
</document>
Here is a chunk from the section above of the Nimbus "{doc}":
<chunk>
{chunk}
</chunk>
Give a short (1–2 sentence) context situating this chunk within the policy, naming who/where it applies to, to improve
search retrieval. Answer only with the context."""


async def llm_context(doc: str, parent: str, chunk: str) -> str:
    from .. import llm

    try:
        return (await llm.chat([{"role": "user", "content": _CTX_PROMPT.format(parent=parent[:6000], doc=doc, chunk=chunk)}],
                               max_tokens=90, temperature=0.0)).strip()
    except Exception as err:
        print(f"[HRMS ctx] LLM context failed: {err}")
        return ""
