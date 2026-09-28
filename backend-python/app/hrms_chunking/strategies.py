"""
Per-document-type chunking strategies (parent–child / small-to-big).

Every strategy takes the typed elements of one PDF (elements.partition) and returns parents:

    {"key": str, "section": [path...], "content": str,
     "children": [{"text": str, "element_type": str, "embed_only": bool?}]}

- child  = retrieval unit that gets embedded (clause, table row, Q/A, list item, slide, labelled block …)
- parent = the section / article / table / slide the LLM actually reads

| doc type  | docs       | child                                         | parent        |
|-----------|------------|-----------------------------------------------|---------------|
| handbook  | 01         | "Term: definition" bullet / prose ≤300 tok / inline-table row | chapter |
| legal     | 03 04 12   | clause (short ones merged, procedures whole)  | article       |
| matrix    | 02 05      | one serialized row (sub-topic rows) / merged short rows | topic |
| reference | 06 16      | table row / location / section prose          | section       |
| faq       | 07         | Q/A pair + question-only vector; list-derived Qs → 1 procedure | section |
| sheet     | 08 10 15   | row with header; wide country tables pivoted per country; frequency pivot | section |
| slides    | 09         | whole slide (or bullet groups)                | slide         |
| checklist | 11 14      | item group; timelines/worked examples whole; one per learning path | heading group |
| memo      | 13         | bold-labelled block                           | whole memo    |
"""
import re
from typing import Final, TypedDict

from .types import ChildSpec, DocType, Element, MemoMeta, ParentSpec, Strategy

CHILD_MAX: Final = 350  # tokens (≈ chars / 4)
CHILD_MIN: Final = 25
COUNTRY_COLS: Final = {"india", "us", "canada", "germany", "singapore", "united states"}


def tok(s: str) -> int:
    return len(s) // 4


def split_long(text: str, limit: int = CHILD_MAX) -> list[str]:
    """Sentence-boundary split with 1-sentence overlap."""
    if tok(text) <= limit:
        return [text]
    sents = re.split(r"(?<=[.;!?])\s+", text)
    out: list[str] = []
    cur: list[str] = []
    for s in sents:
        if cur and tok(" ".join(cur + [s])) > limit:
            out.append(" ".join(cur))
            cur = [cur[-1]]
        cur.append(s)
    if cur:
        out.append(" ".join(cur))
    return out


def row_text(header: list[str], row: list[str]) -> str:
    pairs = [f"{h}: {c}" for h, c in zip(header, row) if c and h not in ("#", "")]
    return "; ".join(pairs) if pairs else " | ".join(row)


def table_text(rows: list[list[str]]) -> str:
    return "\n".join(" | ".join(r) for r in rows)


def _sections(els: list[Element], level: int) -> list[tuple[str | None, list[Element]]]:
    """[(heading_text, [elements])] split at headings of `level` (lower levels stay inside)."""
    out: list[tuple[str | None, list[Element]]] = []
    head: str | None = None
    body: list[Element] = []
    for e in els:
        if e["type"] == "heading" and e["level"] == level:
            if head is not None or body:
                out.append((head, body))
            head, body = e["text"], []
        else:
            body.append(e)
    out.append((head, body))
    return out


def _body_text(els: list[Element]) -> str:
    parts: list[str] = []
    for e in els:
        if e["type"] == "table":
            parts.append(table_text(e["rows"]))
        elif e["type"] == "heading":
            parts.append(f"## {e['text']}")
        else:
            parts.append(e["text"])
    return "\n".join(parts)


def _pack(texts: list[str], limit: int = 300) -> list[str]:
    """Merge consecutive short texts up to `limit` tokens (never splitting a text)."""
    out: list[str] = []
    cur = ""
    for t in texts:
        if cur and tok(cur) + tok(t) > limit:
            out.append(cur)
            cur = t
        else:
            cur = f"{cur}\n{t}" if cur else t
    if cur:
        out.append(cur)
    return out


def _is_title(e: Element) -> bool:
    return e["type"] == "heading" and e["level"] <= 2 and not e["text"].startswith("ARTICLE")


def _preamble(els: list[Element]) -> tuple[str, list[Element]]:
    """Drop the doc title heading + version line at the top; return (version, rest)."""
    version, rest = "", list(els)
    while rest and _is_title(rest[0]):
        rest.pop(0)
    if rest and (first := rest[0])["type"] == "para" and first["text"].startswith("Version"):
        version = first["text"]
        rest.pop(0)
    return version, rest


def _md_inline_table(text: str) -> tuple[str, list[str], list[list[str]]] | None:
    """'Notice period: | Level | Notice | |---|---| | Junior | 30 days | …' → (lead, header, rows)."""
    if "|---" not in text:
        return None
    lead, _, tbl = text.partition("|")
    cells = [c.strip() for c in ("|" + tbl).split("|")]
    cells = [c for c in cells if c != ""]
    sep = next(i for i, c in enumerate(cells) if re.fullmatch(r":?-+:?", c))
    n = sep
    header = cells[:n]
    body = [c for c in cells[n:] if not re.fullmatch(r":?-+:?", c)]
    rows = [body[i : i + n] for i in range(0, len(body), n)]
    return lead.strip(" •:"), header, rows


class _Chapter(TypedDict):
    num: str
    name: str
    els: list[Element]


class _Group(TypedDict):
    head: str
    items: list[str]


# ─── strategies ───────────────────────────────────────────────────────────────
def handbook(els: list[Element]) -> list[ParentSpec]:
    _, els = _preamble(els)
    parents: list[ParentSpec] = []
    body_start = next((i for i, e in enumerate(els) if e["type"] == "heading" and e["text"].upper().startswith("CHAPTER")), 0)
    els = els[body_start:]  # drops table of contents
    groups: list[_Chapter] = []
    cur: _Chapter | None = None
    for e in els:
        if e["type"] == "heading" and e["text"].upper().startswith("CHAPTER"):
            cur = {"num": e["text"].title(), "name": "", "els": []}
            groups.append(cur)
        elif cur is not None and e["type"] == "heading" and e["level"] == 1 and not cur["name"]:
            cur["name"] = e["text"]
        elif cur is not None:
            cur["els"].append(e)
    for g in groups:
        chapter = f"{g['num']}: {g['name']}"
        children: list[ChildSpec] = []
        prose: list[str] = []
        last_term = ""
        for e in g["els"]:
            if e["type"] == "table":
                h = e["rows"][0]
                children += [{"text": row_text(h, r), "element_type": "row"} for r in e["rows"][1:]]
                continue
            t = e["text"]
            if (it := _md_inline_table(t)) is not None:
                lead, h, rows = it
                lead = lead or last_term
                if children and children[-1]["text"].rstrip(":") == lead:
                    children.pop()  # the bare "Notice period after confirmation:" bullet
                children += [{"text": f"{lead}: {row_text(h, r)}", "element_type": "row"} for r in rows]
            elif t.startswith("•") or e["type"] == "heading":
                last_term = t.lstrip("• ").rstrip(":")
                children.append({"text": t.lstrip("• "), "element_type": "term" if ":" in t[:60] else "list_item"})
            else:
                prose.append(t)
        children += [{"text": p, "element_type": "prose"} for chunk in _pack(prose, 300) for p in split_long(chunk)]
        parents.append({"key": g["num"].lower().replace(" ", "-"), "section": [chapter],
                        "content": _body_text(g["els"]), "children": children})
    return parents


PROCEDURE: Final = re.compile(r"PROCEDURE|PROCESS|STEPS|FILING|HOW TO|TIMELINE", re.I)


def legal(els: list[Element]) -> list[ParentSpec]:
    _, els = _preamble(els)
    parents: list[ParentSpec] = []
    for head, body in _sections(els, 2):
        if head is None:
            continue
        m = re.match(r"ARTICLE (\d+) - (.*)", head)
        art = f"Article {m[1]} – {m[2].title()}" if m else head.title()
        clauses = [e["text"] for e in body if e["type"] == "para"]
        content = _body_text(body)
        if PROCEDURE.search(head) and tok(content) <= CHILD_MAX:
            children: list[ChildSpec] = [{"text": content, "element_type": "procedure"}]
        else:
            # short clauses merged (2–3) within the article; long ones alone
            children = [{"text": t, "element_type": "clause"} for t in _pack(clauses, 120)]
            children = [{"text": p, "element_type": c["element_type"]} for c in children for p in split_long(c["text"])]
        parents.append({"key": f"art-{m[1] if m else len(parents) + 1}", "section": [art], "content": content,
                        "children": children})
    return parents


def matrix(els: list[Element]) -> list[ParentSpec]:
    rows = [r for e in els if e["type"] == "table" for r in e["rows"]]
    rows = [r for r in rows if len(r) >= 2 and r[:2] != ["Topic", "Requirement"]]
    topics: dict[str, list[tuple[str, str]]] = {}
    for label, value, *_ in rows:
        topic, _, sub = label.partition(" - ")
        topics.setdefault(topic, []).append((sub, value))
    parents: list[ParentSpec] = []
    for topic, items in topics.items():
        if topic == "Overview":
            continue
        content = "\n".join(f"- {s + ': ' if s else ''}{v}" for s, v in items)
        children: list[ChildSpec] = []
        loose: list[str] = []
        for sub, value in items:
            if sub:  # table-derived row, e.g. "Sick leave" → "Days: 12; Notes: …"
                children.append({"text": f"{sub}: {value}", "element_type": "row"})
            else:
                loose.append(value)
        children += [{"text": t, "element_type": "rule"} for t in _pack(loose, 200)]
        parents.append({"key": re.sub(r"\W+", "-", topic.lower()).strip("-"), "section": [topic], "content": content,
                        "children": children})
    return parents


def reference(els: list[Element]) -> list[ParentSpec]:  # two-column reference docs (privacy, holiday calendar)
    _, els = _preamble(els)
    parents: list[ParentSpec] = []
    for sec, body in _sections(els, 3):
        head = sec or "Overview"
        children: list[ChildSpec] = []
        for e in body:
            if e["type"] == "table":
                h = e["rows"][0]
                children += [{"text": row_text(h, r), "element_type": "row"} for r in e["rows"][1:]]
            else:
                children.append({"text": e["text"].lstrip("• "), "element_type": "rule"})
        if re.search(r"\(.*\)|India|United States|Canada|Germany|Singapore", head) and "holiday" in " ".join(
            c["text"].lower() for c in children
        ) or re.match(r"(India|United States|Canada|Germany|Singapore)", head):
            # holiday location: one child for the whole location (dates listed together)
            children = [{"text": "; ".join(c["text"] for c in children), "element_type": "location"}]
        else:
            rows = [c for c in children if c["element_type"] == "row"]
            rules = [c["text"] for c in children if c["element_type"] != "row"]
            children = rows + [{"text": t, "element_type": "rule"} for t in _pack(rules, 250)]
        parents.append({"key": re.sub(r"\W+", "-", head.lower()).strip("-"), "section": [head],
                        "content": _body_text(body), "children": children})
    return parents


def faq(els: list[Element]) -> list[ParentSpec]:
    _, els = _preamble(els)
    parents: list[ParentSpec] = []
    for sec, body in _sections(els, 2):
        head = sec or "Overview"
        pairs: list[list[str]] = []
        q: list[str] | None = None
        for e in body:
            t = e["text"] if e["type"] == "para" else _body_text([e])
            if re.match(r"Q\d+\.", t):
                q = [t, ""]
                pairs.append(q)
            elif q is not None:
                q[1] = (q[1] + " " + re.sub(r"^A:\s*", "", t)).strip()
        content = "\n".join(f"{a}\nA: {b}" for a, b in pairs)
        generated = [p for p in pairs if "what applies to" in p[0] or "What does the policy say" in p[0]]
        children: list[ChildSpec] = []
        if generated:  # Qs synthesised from bullets/paragraphs: the question is noise, keep the answers
            kind = "procedure" if head.lower().startswith("how") else "rule"
            answers = [b for _, b in generated]
            if kind == "procedure":
                answers = [f"{i}. {b}" for i, b in enumerate(answers, 1)]
            children += [{"text": f"{head}:\n{t}", "element_type": kind} for t in _pack(answers, 250)]
            pairs = [p for p in pairs if p not in generated]
        for qq, a in pairs:
            question = re.sub(r"^Q\d+\.\s*", "", qq)
            children.append({"text": f"Q: {question}\nA: {a}", "element_type": "qa"})
            children.append({"text": question, "element_type": "question", "embed_only": True})  # multi-vector
        parents.append({"key": re.sub(r"\W+", "-", head.lower()).strip("-"), "section": [head], "content": content,
                        "children": children})
    return parents


FREQ: Final = re.compile(r"\b(monthly|quarterly|annual(?:ly)?|yearly)\b", re.I)


def sheet(els: list[Element]) -> list[ParentSpec]:
    _, els = _preamble(els)
    parents: list[ParentSpec] = []
    freq_rows: dict[str, list[str]] = {}
    for sec, body in _sections(els, 3):
        head = sec or "Overview"
        children: list[ChildSpec] = []
        for e in body:
            if e["type"] != "table":
                children.append({"text": e["text"], "element_type": "rule"})
                continue
            h, rows = e["rows"][0], e["rows"][1:]
            if h[:2] == ["#", "Note"]:
                notes: list[list[str]] = []
                group: list[str] | None = None
                for r in rows:
                    t = r[-1]
                    if t.endswith(":"):
                        group = [t]
                        notes.append(group)
                    elif group is not None and tok(t) < 30 and not re.match(r"[A-Z][\w ]+:\s", t):
                        group.append(t)
                    else:
                        group = None
                        notes.append([t])
                texts = [g[0] + " " + "; ".join(g[1:]) if len(g) > 1 else g[0] for g in notes]
                kind = "example" if "example" in head.lower() else "rule"
                if kind == "example":
                    children += [{"text": t, "element_type": kind} for t in texts]
                else:
                    children += [{"text": t, "element_type": kind} for t in _pack(texts, 150)]
                for t in texts:
                    if (m := FREQ.search(t)):
                        freq_rows.setdefault(m[1].lower().replace("annually", "annual").replace("yearly", "annual"), []).append(f"{head}: {t}")
            else:
                children += [{"text": row_text(h, r), "element_type": "row"} for r in rows]
                if len(h) >= 4 and sum(c.split(" (")[0].lower() in COUNTRY_COLS for c in h[1:]) >= 3:
                    for ci, country in enumerate(h[1:], 1):  # pivot: one child per country column
                        vals = "; ".join(f"{r[0]}: {r[ci]}" for r in rows if ci < len(r) and r[ci])
                        children.append({"text": f"{head} — {country}: {vals}", "element_type": "country_pivot"})
        parents.append({"key": re.sub(r"\W+", "-", head.lower()).strip("-"), "section": [head],
                        "content": _body_text(body), "children": children})
    if len(freq_rows) >= 2:  # statutory calendar: "what is due monthly?"
        for f, items in freq_rows.items():
            parents.append({"key": f"freq-{f}", "section": [f"{f.title()} obligations"],
                            "content": "\n".join(items),
                            "children": [{"text": p, "element_type": "frequency_pivot"}
                                         for p in _pack([f"{f.title()} obligations:"] + items, 300)]})
    return parents


def slides(els: list[Element]) -> list[ParentSpec]:
    _, els = _preamble(els)
    parents: list[ParentSpec] = []
    for head, body in _sections(els, 1):
        if head is None:
            continue
        body = [e for e in body if e["type"] == "table" or not re.fullmatch(r"\d+ / \d+", e["text"])]
        content = _body_text(body)
        if tok(content) <= CHILD_MAX:
            children: list[ChildSpec] = [{"text": content, "element_type": "slide"}]
        else:
            parts = [table_text(e["rows"]) if e["type"] == "table" else e["text"] for e in body]
            children = [{"text": p, "element_type": "slide_part"} for p in _pack(parts, 250)]
        parents.append({"key": f"slide-{len(parents) + 1}", "section": [f"Slide {len(parents) + 1}: {head}"],
                        "content": content, "children": children})
    return parents


def checklist(els: list[Element]) -> list[ParentSpec]:
    rows = [r for e in els if e["type"] == "table" for r in e["rows"]]
    groups: list[_Group] = []
    cur: _Group | None = None
    for r in rows:
        if len(r) == 1 and r[0] != "[ ]":
            cur = {"head": r[0], "items": []}
            groups.append(cur)
        elif cur is not None:
            cur["items"].append(r[-1])
    parents: list[ParentSpec] = []
    for g in groups:
        head, items = g["head"], g["items"]
        content = "\n".join(f"- [ ] {i}" for i in items)
        if re.search(r"timeline|worked example", head, re.I):
            children: list[ChildSpec] = [{"text": f"{head}:\n{content}", "element_type": "timeline" if "timeline" in head.lower() else "example"}]
        elif re.search(r"learning paths?", head, re.I):
            children = [{"text": f"Learning path — {i}", "element_type": "list_item"} for i in items]
        else:
            children = [{"text": t, "element_type": "checklist"} for t in _pack([f"- {i}" for i in items], 250)]
        parents.append({"key": re.sub(r"\W+", "-", head.lower()).strip("-"), "section": [head], "content": content,
                        "children": children})
    return parents


def _memo_meta(header: list[list[str]]) -> MemoMeta:
    meta: MemoMeta = {}
    for r in header:
        if len(r) != 2:
            continue
        match r[0].lower():
            case "to":
                meta["to"] = r[1]
            case "from":
                meta["from"] = r[1]
            case "date":
                meta["date"] = r[1]
            case "re":
                meta["re"] = r[1]
    return meta


def memo(els: list[Element]) -> list[ParentSpec]:
    header: list[list[str]] = next((e["rows"] for e in els if e["type"] == "table"), [])
    paras = [e["text"] for e in els if e["type"] == "para" and not e["text"].startswith("Version")]
    blocks: list[list[str]] = []
    for p in paras:
        p = re.sub(r",\.", ",", p).replace(" or.", " or").replace(":.", ":")
        label = re.match(r"^([A-Z][\w ,'/-]{2,40}?)[.:]\s", p)
        if label and len(label[1].split()) <= 5:
            blocks.append([label[1], p])
        elif blocks:
            blocks[-1][1] += " " + p
        else:
            blocks.append(["Summary", p])
    content = "\n".join(p for _, p in blocks)
    children: list[ChildSpec] = [{"text": part, "element_type": "memo_block"} for _, p in blocks for part in split_long(p)]
    return [{"key": "memo", "section": ["Memorandum"], "content": content, "children": children,
             "_meta": _memo_meta(header)}]


STRATEGIES: Final[dict[DocType, Strategy]] = {
    "handbook": handbook, "legal": legal, "matrix": matrix, "reference": reference, "faq": faq,
    "sheet": sheet, "slides": slides, "checklist": checklist, "memo": memo,
}
