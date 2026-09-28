"""
HRMS chunking pipeline: company_docs/pdf/*.pdf → typed elements → per-doc-type strategy → parents + children.

    from app.hrms_chunking import load_hrms_chunks
    parents, children = load_hrms_chunks()

    python -m app.hrms_chunking --dump      # stats + samples per PDF, fails on size-rule violations
"""
import re
from pathlib import Path
from typing import Final

from .elements import partition
from .enrich import entities, header, size_rules
from .strategies import STRATEGIES
from .types import ChildMeta, ChildRow, DocType, Element, ParentRow

PDF_DIR: Final = Path(__file__).resolve().parents[2] / "company_docs" / "pdf"

# slug → (doc type, two-column layout?)
DOC_TYPES: Final[dict[str, tuple[DocType, bool]]] = {
    "01-employee-handbook": ("handbook", False),
    "02-leave-policy": ("matrix", False),
    "03-code-of-conduct": ("legal", False),
    "04-anti-harassment-posh-policy": ("legal", False),
    "05-information-security-policy": ("matrix", False),
    "06-data-privacy-policy": ("reference", True),
    "07-remote-hybrid-work-policy": ("faq", False),
    "08-travel-reimbursement-policy": ("sheet", False),
    "09-performance-management-policy": ("slides", False),
    "10-compensation-benefits-policy": ("sheet", False),
    "11-learning-development-policy": ("checklist", False),
    "12-disciplinary-policy": ("legal", False),
    "13-whistleblower-policy": ("memo", False),
    "14-separation-exit-policy": ("checklist", False),
    "15-statutory-compliance-calendar": ("sheet", False),
    "16-holiday-calendar-2026": ("reference", True),
}


def _doc_title(els: list[Element], slug: str) -> str:
    for e in els:
        if e["type"] == "heading" and e["level"] <= 2 and e["text"] != "MEMORANDUM":
            t = re.sub(r"\s*-\s*(Questions & Answers|Checklist)$", "", e["text"])
            t = t.replace("Nimbus Digital Solutions — ", "")  # company name in one doc's title biases every "Nimbus" query
            if t.isupper():
                t = re.sub(r"\b(Of|And|The|For)\b", lambda m: m[1].lower(), t.title()).replace("(Posh)", "(POSH)")
            return t
    return slug.split("-", 1)[1].replace("-", " ").title() + " Policy"


def _version(els: list[Element]) -> tuple[str, str]:
    for e in els:
        if e["type"] == "para" and (m := re.search(r"Version ([\d.]+) · Effective (\d+ \w+ \d{4})", e["text"])):
            return m[1], m[2]
    return "", ""


def load_doc(path: Path) -> tuple[list[ParentRow], list[ChildRow]]:
    slug = path.stem
    doc_type, two_col = DOC_TYPES.get(slug, ("memo", False))
    els = partition(path, two_col)
    title = _doc_title(els, slug)
    if doc_type == "memo":
        title = next((r[1] for e in els if e["type"] == "table" for r in e["rows"] if r[0] == "Re"), title)
    version, effective = _version(els)
    parents: list[ParentRow] = []
    children: list[ChildRow] = []
    for p in STRATEGIES[doc_type](els):
        pid = f"{slug}::{p['key']}"
        if any(x["parent_id"] == pid for x in parents):
            pid += f"-{len(parents)}"
        parents.append({"parent_id": pid, "doc": slug, "title": f"{title} › {' › '.join(p['section'])}",
                        "content": p["content"]})
        for i, c in enumerate(size_rules(p["children"])):
            meta: ChildMeta = {"doc": slug, "doc_title": title, "doc_type": doc_type, "section_path": p["section"],
                               "element_type": c["element_type"], "version": version, "effective_date": effective,
                               "ordinal": i, **entities(c["text"] + " " + " ".join(p["section"])), **p.get("_meta", {})}
            children.append({
                "doc_id": f"{pid}#{i:03d}",
                "parent_id": pid,
                "doc": slug,
                "doc_type": doc_type,
                "element_type": c["element_type"],
                "content": c["text"],
                "embed_text": header(title, p["section"], meta) + "\n" + c["text"],
                "embed_only": bool(c.get("embed_only")),
                "meta": meta,
            })
    return parents, children


def load_hrms_chunks() -> tuple[list[ParentRow], list[ChildRow]]:
    parents: list[ParentRow] = []
    children: list[ChildRow] = []
    for path in sorted(PDF_DIR.glob("*.pdf")):
        try:
            p, c = load_doc(path)
        except Exception as e:
            print(f"[HRMS chunking] failed on {path.name}: {e!r}")
            continue
        parents += p
        children += c
        print(f"[HRMS chunking] {path.stem:<36} {DOC_TYPES.get(path.stem, ('?',))[0]:<9} "
              f"{len(p):3d} parents {len(c):3d} children")
    return parents, children
