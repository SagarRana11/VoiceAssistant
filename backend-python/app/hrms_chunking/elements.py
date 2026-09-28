"""
Structure-aware PDF partitioner (Unstructured/Docling style) for the company policy PDFs.

PDF → positioned text lines (pypdf visitor: page, x, y, font, size) → typed elements:

    {"type": "heading", "level": 1|2|3, "text", "page"}
    {"type": "para",    "text", "page"}              # wrapped lines re-joined; bullets start with "• "
    {"type": "table",   "rows": [[cell, ...], ...], "page"}

Tables are rebuilt cell by cell: every table cell is 8pt text; inside one column a line that follows the previous
one by ≤ one leading (~10pt) continues the same cell, a bigger gap starts a new cell, and cells whose first
lines share a y form a row. This is what keeps wrapped labels ("Entitlements (per calendar year, pro-rated …)
- Sick leave") attached to the right value.
"""
import re
from pathlib import Path
from typing import Final, TypedDict

from pypdf import PdfReader
from pypdf.generic import DictionaryObject

from .types import Element, HeadingEl, HeadingLevel, RawLine

CELL_SIZE: Final = 8.0  # every reportlab table cell in build_company_pdfs.py is 8pt


class _Cell(RawLine):
    _last: int  # y of the cell's latest continuation line


def _raw_lines(path: Path) -> list[RawLine]:
    reader = PdfReader(path)
    out: list[RawLine] = []
    for pno, page in enumerate(reader.pages):
        height, width = float(page.mediabox.height), float(page.mediabox.width)
        spans: dict[tuple[int, int], RawLine] = {}

        def visit(text: str, cm: list[float], tm: list[float], font: DictionaryObject | None,
                  size: float | None) -> None:
            if not text.strip():
                return
            x, y = round(cm[4] + tm[4]), round(cm[5] + tm[5])
            fs = round((size or 0) * (tm[0] or 1), 1)
            if y > height - 45 or y < 40 or fs <= 7.5:  # running header / footer / page number
                return
            name = str(font.get("/BaseFont", "")) if font else ""
            key = (x, y)
            if key in spans:
                prev = spans[key]["text"]
                sep = "" if prev.endswith((" ", "(", "/")) or text[:1] in ",.;:)" else " "
                spans[key]["text"] = prev + sep + text.strip()
                spans[key]["bold"] = spans[key]["bold"] and "Bold" in name  # bold only if the whole line is
            else:
                spans[key] = {"page": pno, "x": x, "y": y, "size": fs, "text": text.strip(), "w": width,
                              "bold": "Bold" in name, "oblique": "Oblique" in name}

        page.extract_text(visitor_text=visit)
        out += spans.values()
    for l in out:
        l["text"] = re.sub(r"\s+", " ", l["text"].replace("\x7f", "•")).strip()
    return [l for l in out if l["text"]]


def _order(lines: list[RawLine], two_column: bool) -> list[RawLine]:
    if not two_column:
        return sorted(lines, key=lambda l: (l["page"], -l["y"], l["x"]))
    mid = lines[0]["w"] / 2 if lines else 0.0
    for l in lines:
        l["col"] = int(l["x"] >= mid)
    return sorted(lines, key=lambda l: (l["page"], l["col"], -l["y"], l["x"]))


def _build_table(cells: list[RawLine]) -> list[list[str]]:
    """8pt lines of one table region → rows of cell strings."""
    xs = sorted({l["x"] for l in cells})
    cols: dict[int, list[RawLine]] = {x: [] for x in xs}
    for l in cells:
        cols[l["x"]].append(l)
    starts: list[_Cell] = []  # first line of each cell, with its text accumulated
    for x in xs:
        cur: _Cell | None = None
        for l in sorted(cols[x], key=lambda l: (l["page"], -l["y"])):
            if cur and l["page"] == cur["page"] and 0 < cur["_last"] - l["y"] <= 11.5:
                cur["text"] += " " + l["text"]
                cur["_last"] = l["y"]
            else:
                cur = _Cell(**l, _last=l["y"])
                starts.append(cur)
    rows: dict[tuple[int, int], list[_Cell]] = {}
    for c in starts:
        rows.setdefault((c["page"], c["y"]), []).append(c)
    out: list[list[str]] = []
    header: list[str] | None = None
    for key in sorted(rows, key=lambda k: (k[0], -k[1])):
        row = [c["text"] for c in sorted(rows[key], key=lambda c: c["x"])]
        if header is None:
            header = row
        elif row == header:  # header repeated on a new page (repeatRows=1)
            continue
        out.append(row)
    return out


def partition(path: Path, two_column: bool = False) -> list[Element]:
    lines = _order(_raw_lines(path), two_column)
    els: list[Element] = []
    head_y = 0  # y of the last line of the latest heading (multi-line heading join)
    i = 0
    while i < len(lines):
        l = lines[i]
        if l["size"] == CELL_SIZE:  # table region: consecutive 8pt lines in the same column
            j = i
            while j < len(lines) and lines[j]["size"] == CELL_SIZE and lines[j].get("col") == l.get("col"):
                j += 1
            els.append({"type": "table", "rows": _build_table(lines[i:j]), "page": l["page"]})
            i = j
            continue
        if l["bold"] and l["size"] >= 12 or l["oblique"] and l["bold"]:
            level: HeadingLevel = 1 if l["size"] >= 18 else 2 if l["size"] >= 13.5 else 3
            prev = els[-1] if els else None
            if prev is not None and prev["type"] == "heading" and prev["level"] == level \
                    and head_y - l["y"] <= l["size"] * 1.4 and prev["page"] == l["page"]:
                prev["text"] += " " + l["text"]  # multi-line heading
            else:
                heading: HeadingEl = {"type": "heading", "level": level, "text": l["text"], "page": l["page"]}
                els.append(heading)
            head_y = l["y"]
            i += 1
            continue
        # paragraph: join wrapped lines (gap ≤ ~1.5 × font size, same column, no new bullet/clause/Q start)
        text, last = l["text"], l
        j = i + 1
        while j < len(lines):
            n = lines[j]
            same_block = n["page"] == last["page"] and 0 < last["y"] - n["y"] <= n["size"] * 1.5
            same_block = same_block and n["size"] == last["size"] and n.get("col") == last.get("col")
            new_item = re.match(r"(•|\d+\.\d+\s|Q\d+\.|A:)", n["text"])
            if not same_block or new_item or n["bold"] and n["size"] >= 12:
                break
            text += " " + n["text"]
            last = n
            j += 1
        prev = els[-1] if els else None
        if prev is not None and prev["type"] == "para" and prev["page"] != l["page"] and text[:1].islower():
            prev["text"] += " " + text  # paragraph broken across a page
        else:
            els.append({"type": "para", "text": text, "page": l["page"]})
        i = j
    return els
