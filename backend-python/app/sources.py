"""
Read knowledge docs straight from the source files in
backend/src/rag/knowledgeSources/ — no dependency on the Node backend having run.

- <domain>Knowledge.ts : hardcoded KnowledgeDoc arrays (id/category/title/content/tags)
- *.pdf                : split on top-level "N. Title" headings (same as pdfLoader.ts)

The `general` domain (used by the no-role assistant) instead reads every .pdf/.md/.txt dropped into
backend-python/knowledge/ and splits it into overlapping ~1200-char chunks.
"""
import re
from pathlib import Path

from pypdf import PdfReader

SOURCES_DIR = Path(__file__).resolve().parents[2] / "backend" / "src" / "rag" / "knowledgeSources"
GENERAL_DIR = Path(__file__).resolve().parents[1] / "knowledge"
CHUNK_CHARS, CHUNK_OVERLAP = 1200, 200

# PDFs per domain — keep in sync with vectorStore.ts
PDF_FILES: dict[str, list[str]] = {
    "exercise": ["Advanced_Exercise_Planner_Framework_2026.pdf"],
}

_TS_DOC = re.compile(
    r"id:\s*'(?P<id>[^']+)',\s*"
    r"category:\s*'(?P<category>[^']*)',\s*"
    r"title:\s*'(?P<title>(?:[^'\\]|\\.)*)',\s*"
    r"content:\s*`(?P<content>(?:[^`\\]|\\.)*)`,\s*"
    r"tags:\s*\[(?P<tags>[^\]]*)\]",
    re.S,
)


def _load_ts(domain: str) -> list[dict]:
    path = SOURCES_DIR / f"{domain}Knowledge.ts"
    if not path.exists():
        return []
    docs = []
    for m in _TS_DOC.finditer(path.read_text(encoding="utf-8")):
        docs.append({
            "docId": m["id"],
            "category": m["category"],
            "title": m["title"].replace("\\'", "'"),
            "content": m["content"].replace("\\`", "`"),
            "tags": re.findall(r"'([^']+)'", m["tags"]),
        })
    return docs


def _load_pdf(file_name: str, prefix: str) -> list[dict]:
    reader = PdfReader(SOURCES_DIR / file_name)
    raw = "\n".join(page.extract_text() or "" for page in reader.pages)
    sections = [s for s in re.split(r"(?=\n\d+\.\s+[A-Z])", raw) if s.strip()]
    docs = []
    for i, section in enumerate(sections):
        lines = [l for l in section.strip().split("\n") if l.strip()]
        if not lines:
            continue
        title = re.sub(r"^\d+\.\s*", "", lines[0]).strip()
        content = "\n".join(lines[1:]).strip()
        if not content:
            continue
        tags = [re.sub(r"[^a-z0-9_]", "", w) for w in re.split(r"[\s:,()]+", title.lower()) if len(w) > 3]
        docs.append({
            "docId": f"{prefix}_pdf_{i + 1:03d}",
            "category": prefix,
            "title": title,
            "content": content,
            "tags": list(dict.fromkeys(t for t in tags if t)),
        })
    print(f"[Sources] {len(docs)} docs from {file_name}")
    return docs


def _chunk(text: str) -> list[str]:
    """Paragraph-aware chunks of ~CHUNK_CHARS with CHUNK_OVERLAP chars carried over."""
    text = re.sub(r"[ \t]+", " ", text)
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, cur = [], ""
    for p in paras:
        while len(p) > CHUNK_CHARS:  # oversized paragraph (common in PDF text) → hard split
            head, p = p[:CHUNK_CHARS], p[CHUNK_CHARS - CHUNK_OVERLAP :]
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.append(head)
        if cur and len(cur) + len(p) + 2 > CHUNK_CHARS:
            chunks.append(cur)
            cur = cur[-CHUNK_OVERLAP:] + "\n\n" + p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    return chunks


def _load_general() -> list[dict]:
    if not GENERAL_DIR.exists():
        return []
    docs = []
    for path in sorted(GENERAL_DIR.iterdir()):
        ext = path.suffix.lower()
        try:
            if ext == ".pdf":
                text = "\n\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
            elif ext in (".md", ".txt"):
                text = path.read_text(encoding="utf-8")
            else:
                continue
        except Exception as e:
            print(f"[Sources] failed to load {path.name}: {e}")
            continue
        title = path.stem.replace("_", " ").replace("-", " ")
        slug = re.sub(r"[^a-z0-9]+", "_", path.stem.lower()).strip("_")
        chunks = _chunk(text)
        for i, chunk in enumerate(chunks):
            docs.append({
                "docId": f"general_{slug}_{i + 1:04d}",
                "category": "general",
                "title": f"{title} (part {i + 1})",
                "content": chunk,
                "tags": [],
            })
        print(f"[Sources] {len(chunks)} chunks from {path.name}")
    return docs


def load_domain_docs(domain: str) -> list[dict]:
    if domain == "general":
        return _load_general()
    docs = _load_ts(domain)
    for f in PDF_FILES.get(domain, []):
        try:
            docs += _load_pdf(f, domain)
        except Exception as e:
            print(f"[Sources] failed to load {f}: {e}")
    return docs
