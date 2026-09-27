"""
HRMS knowledge source — chunks the company policy PDFs in company_docs/pdf/ for the `hrms` RAG domain.

Every PDF was rendered with a different layout (see scripts/build_company_pdfs.py LAYOUTS), so one generic
splitter would cut tables, Q&As and clauses in half. Instead:

1. `_lines()` reads each PDF with pypdf's visitor → positioned lines (page, x, y, font, size, text),
   dropping the running header/footer.
2. The layout picks a chunker:

    book       one chunk per CHAPTER, long chapters split at paragraph boundaries (title repeated)
    legal      one chunk per ARTICLE (all its numbered clauses)
    faq        one chunk per Q/A pair, section name kept in the title
    slides     one chunk per slide (page)
    memo       To/From/Re header prepended to sliding windows over the body
    matrix     Topic | Requirement rows grouped by topic → one chunk per topic
    sheet      one chunk per section; tables become "cell | cell" rows, header repeated in splits
    checklist  one chunk per heading group, items as "- [ ] …"
    twocol     columns read left then right; one chunk per section

Each chunk: {docId, category=doc slug, title="<Doc> — <section>", content, tags=[layout, slug]}.
"""
import re
from pathlib import Path

from pypdf import PdfReader

PDF_DIR = Path(__file__).resolve().parents[1] / "company_docs" / "pdf"
MAX_CHARS, OVERLAP = 1500, 200

LAYOUTS = {
    "01-employee-handbook": "book",
    "02-leave-policy": "matrix",
    "03-code-of-conduct": "legal",
    "04-anti-harassment-posh-policy": "legal",
    "05-information-security-policy": "matrix",
    "06-data-privacy-policy": "twocol",
    "07-remote-hybrid-work-policy": "faq",
    "08-travel-reimbursement-policy": "sheet",
    "09-performance-management-policy": "slides",
    "10-compensation-benefits-policy": "sheet",
    "11-learning-development-policy": "checklist",
    "12-disciplinary-policy": "legal",
    "13-whistleblower-policy": "memo",
    "14-separation-exit-policy": "checklist",
    "15-statutory-compliance-calendar": "sheet",
    "16-holiday-calendar-2026": "twocol",
}


# ─── PDF → positioned lines ───────────────────────────────────────────────────
def _lines(path: Path) -> list[dict]:
    """Lines of text with position + font. Spans sharing (page, x, y) are one line (pypdf reports the line start)."""
    reader = PdfReader(path)
    lines: list[dict] = []
    for pno, page in enumerate(reader.pages):
        height, width = float(page.mediabox.height), float(page.mediabox.width)
        spans: dict[tuple, dict] = {}

        def visit(text, cm, tm, font, size):
            if not text.strip():
                return
            x, y = round(cm[4] + tm[4]), round(cm[5] + tm[5])
            fs = round((size or 0) * (tm[0] or 1), 1)
            name = (font or {}).get("/BaseFont", "") if font else ""
            if y > height - 45 or y < 40 or fs <= 7.5:  # running header / footer
                return
            key = (x, y)
            if key in spans:
                spans[key]["text"] += ("" if spans[key]["text"].endswith(" ") else " ") + text.strip()
            else:
                spans[key] = {"page": pno, "x": x, "y": y, "font": name, "size": fs, "text": text.strip(), "w": width}

        page.extract_text(visitor_text=visit)
        lines += sorted(spans.values(), key=lambda l: (-l["y"], l["x"]))
    for l in lines:
        l["text"] = re.sub(r"\s+", " ", l["text"].replace("\x7f", "•")).strip()
    return [l for l in lines if l["text"]]


def _bold(l, min_size=0.0) -> bool:
    return "Bold" in l["font"] and l["size"] >= min_size


def _section_head(l) -> bool:  # BoldOblique 12 = section heading in sheet/twocol/book
    return "BoldOblique" in l["font"] and l["size"] >= 11


def _rows(lines: list[dict]) -> list[str]:
    """Group lines by (page, y) into table-ish rows: 'cell | cell'."""
    rows: dict[tuple, list[dict]] = {}
    for l in lines:
        rows.setdefault((l["page"], l["y"]), []).append(l)
    out = []
    for key in sorted(rows, key=lambda k: (k[0], -k[1])):
        cells = sorted(rows[key], key=lambda l: l["x"])
        out.append(" | ".join(c["text"] for c in cells))
    return out


def _split(text: str, limit: int = MAX_CHARS, head: str = "") -> list[str]:
    """Split on line boundaries into ≤limit pieces with OVERLAP carry-over; `head` repeated on every piece."""
    if len(text) <= limit:
        return [text]
    parts, cur = [], ""
    for line in text.split("\n"):
        if cur and len(cur) + len(line) + 1 > limit:
            parts.append(cur)
            tail = cur[-OVERLAP:]
            cur = (head + "\n" if head else "") + tail[tail.find("\n") + 1 :] + "\n" + line
        else:
            cur = f"{cur}\n{line}" if cur else line
    if cur:
        parts.append(cur)
    return parts


def _group(lines, is_head, skip_before_first=True) -> list[tuple[str, list[dict]]]:
    """Split lines into (heading, body_lines) at every line where is_head(line)."""
    groups: list[tuple[str, list[dict]]] = []
    head, body = "Overview", []
    for l in lines:
        if is_head(l):
            if body:
                groups.append((head, body))
            head, body = l["text"], []
        else:
            body.append(l)
    if body:
        groups.append((head, body))
    return groups


def _title_and_body(lines):
    """First Bold-20/14 line(s) on page 1 = doc title; drop them from the body."""
    title_lines = [l for l in lines if l["page"] == 0 and _bold(l, 14) and not l["text"].startswith("ARTICLE")]
    return " ".join(l["text"] for l in title_lines[:2]), [l for l in lines if l not in title_lines[:2]]


# ─── Layout chunkers → list[(section, content)] ──────────────────────────────
def _book(lines):
    body = [l for l in lines if l["page"] > 1]  # page 0 cover, page 1 table of contents
    out, chapter, name, buf = [], None, "", []
    for l in body:
        if _section_head(l) and l["text"].upper().startswith("CHAPTER"):
            if buf:
                out.append((f"{chapter} {name}".strip(), buf))
            chapter, name, buf = l["text"].title(), "", []
        elif _bold(l, 18) and not name:
            name = l["text"]
        else:
            buf.append(l["text"])
    if buf:
        out.append((f"{chapter} {name}".strip(), buf))
    return [(t, piece) for t, b in out for piece in _split("\n".join(b), head=t)]


def _legal(lines):
    _, body = _title_and_body(lines)
    groups = _group(body, lambda l: _bold(l, 13) and l["text"].startswith("ARTICLE"))
    return [(h.title(), "\n".join(l["text"] for l in b)) for h, b in groups]


def _faq(lines):
    _, body = _title_and_body(lines)
    out, section, q, ans = [], "", None, []
    for l in body:
        if _bold(l, 13):
            section = l["text"]
        elif _bold(l) and re.match(r"Q\d+\.", l["text"]):
            if q:
                out.append((f"{section}: {q}" if section else q, f"{q}\n" + " ".join(ans)))
            q, ans = l["text"], []
        elif q:
            ans.append(l["text"])
    if q:
        out.append((f"{section}: {q}" if section else q, f"{q}\n" + " ".join(ans)))
    return out


def _slides(lines):
    out = []
    for p in sorted({l["page"] for l in lines}):
        page = [l for l in lines if l["page"] == p]
        heads = [l for l in page if _bold(l, 18)]
        title = heads[0]["text"] if heads else f"Slide {p + 1}"
        rest = [l for l in page if l is not (heads[0] if heads else None) and not re.fullmatch(r"\d+ / \d+", l["text"])]
        out.append((title, "\n".join(_rows(rest))))
    return out


def _memo(lines):
    _, body = _title_and_body(lines)
    meta = [l for l in body if l["size"] == 8.0]  # To / From / Date / Re table
    header = "\n".join(_rows(meta))
    text = " ".join(l["text"] for l in body if l not in meta)
    text = re.sub(r"\s+([.,;:])", r"\1", text)
    sents = re.split(r"(?<=[.!?])\s+", text)
    out, cur, n = [], "", 0
    for s in sents:  # ~700-char windows, 1 sentence overlap
        if cur and len(cur) + len(s) > 700:
            n += 1
            out.append((f"Part {n}", f"{header}\n\n{cur}"))
            cur = cur.rsplit(". ", 1)[-1] + " " + s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append((f"Part {n + 1}", f"{header}\n\n{cur}"))
    return out


def _matrix(lines):
    _, body = _title_and_body(lines)
    cells = [l for l in body if l["size"] <= 8.5]
    split_x = sorted({l["x"] for l in cells})[1] if len({l["x"] for l in cells}) > 1 else 10**6
    rows, label, value, last = [], [], [], None
    for l in cells:  # label col (left) / requirement col (right); new row when a label follows a value
        col = "v" if l["x"] >= split_x else "l"
        if col == "l" and last == "v":
            rows.append((" ".join(label), " ".join(value)))
            label, value = [], []
        (label if col == "l" else value).append(l["text"])
        last = col
    if label or value:
        rows.append((" ".join(label), " ".join(value)))
    rows = [r for r in rows if r != ("Topic", "Requirement")]
    topics: dict[str, list[str]] = {}
    for lab, val in rows:
        topic, _, sub = lab.partition(" - ")
        topics.setdefault(topic, []).append(f"- {sub}: {val}" if sub else f"- {val}")
    return [(t, piece) for t, items in topics.items() for piece in _split("\n".join(items), head=t)]


def _sheet(lines):
    _, body = _title_and_body(lines)
    out = []
    for head, b in _group(body, _section_head):
        rows = [r for r in _rows(b) if r not in ("# | Note",)]
        rows = [re.sub(r"^\d+ \| ", "- ", r) for r in rows]
        header = next((r for r in rows if r.count("|") >= 2), "")
        out += [(head, piece) for piece in _split("\n".join(rows), head=header)]
    return out


def _checklist(lines):
    _, body = _title_and_body(lines)
    boxes = {(l["page"], l["y"]) for l in body if l["text"] == "[ ]"}
    groups, head, items, prev_y = [], "Overview", [], None
    for l in body:
        if l["text"] == "[ ]" or l["size"] > 9:
            prev_y = l["y"]
            continue
        starts_item = (l["page"], l["y"]) in boxes
        gap = (prev_y - l["y"]) if prev_y is not None and prev_y > l["y"] else 99
        if not starts_item and gap > 14:  # heading: no checkbox, preceded by a section gap
            if items:
                groups.append((head, items))
            head, items = l["text"], []
        elif starts_item or not items:
            items.append(f"- [ ] {l['text']}")
        else:
            items[-1] += " " + l["text"]
        prev_y = l["y"]
    if items:
        groups.append((head, items))
    return [(h, piece) for h, it in groups for piece in _split("\n".join(it), head=h)]


def _twocol(lines):
    _, body = _title_and_body(lines)
    mid = body[0]["w"] / 2 if body else 0
    body = sorted(body, key=lambda l: (l["page"], l["x"] >= mid, -l["y"], l["x"]))
    out = []
    for head, b in _group(body, _section_head):
        for l in b:
            l["y"] = l["y"] * 10 + (1 if l["x"] >= mid else 0)  # keep columns apart in _rows
        out.append((head, "\n".join(_rows(b))))
    return out


CHUNKERS = {
    "book": _book, "legal": _legal, "faq": _faq, "slides": _slides, "memo": _memo,
    "matrix": _matrix, "sheet": _sheet, "checklist": _checklist, "twocol": _twocol,
}


def load_hrms_docs() -> list[dict]:
    docs = []
    for path in sorted(PDF_DIR.glob("*.pdf")):
        slug = path.stem
        layout = LAYOUTS.get(slug, "memo")
        try:
            lines = _lines(path)
            doc_title = _title_and_body(lines)[0] or slug
            chunks = [(s, c.strip()) for s, c in CHUNKERS[layout](lines) if c.strip()]
        except Exception as e:
            print(f"[HRMS] failed to chunk {path.name}: {e}")
            continue
        for i, (section, content) in enumerate(chunks):
            docs.append({
                "docId": f"hrms_{slug}_{i + 1:03d}",
                "category": slug,
                "title": f"{doc_title} — {section}",
                "content": content,
                "tags": [layout, slug],
            })
        print(f"[HRMS] {len(chunks):3d} chunks ({layout}) from {path.name}")
    return docs
