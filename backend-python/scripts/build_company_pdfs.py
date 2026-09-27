"""Render company_docs/*.md into PDFs with deliberately DIFFERENT layouts per document,
so each needs its own chunking strategy (see LAYOUTS / company_docs/README.md).

Layouts:
    book       chapters, TOC, page break per H2, running header      -> heading-hierarchy chunking
    legal      every paragraph/bullet numbered as a clause 1.1, 1.2   -> clause-level chunking
    twocol     two-column newspaper flow                              -> layout-aware (column) chunking
    faq        everything rendered as Q/A pairs                       -> Q&A-pair chunking
    slides     landscape, one H2 per page, big type                   -> page-level chunking
    sheet      landscape dense tables, prose squeezed into notes      -> table-row chunking
    checklist  checkbox items grouped under headings                  -> list-item / group chunking
    memo       memo header block (To/From/Date/Re), continuous prose  -> fixed-size sliding window
    matrix     each section becomes a 2-col key/value matrix row      -> row/record chunking

Run from backend-python/:  .venv/bin/python -m scripts.build_company_pdfs
"""
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

SRC = Path(__file__).resolve().parent.parent / "company_docs"
OUT = SRC / "pdf"
COMPANY = "Nimbus Digital Solutions"

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

ss = getSampleStyleSheet()
BODY = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9.5, leading=13)
H1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=20)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=colors.HexColor("#1f3a5f"))
H3 = ParagraphStyle("h3", parent=ss["Heading3"])
CELL = ParagraphStyle("c", parent=BODY, fontSize=8, leading=10)
NAVY = colors.HexColor("#1f3a5f")


# ---------- markdown -> blocks ----------

def inline(t: str) -> str:
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    return re.sub(r"`(.+?)`", r"<font face='Courier'>\1</font>", t)


def parse(md: str):
    """-> list of (kind, payload): h1/h2/h3 text, p text, ul [items], ol [items], table [rows]."""
    blocks, lines, i = [], md.splitlines(), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip():
            i += 1
            continue
        if m := re.match(r"^(#{1,3}) (.*)", ln):
            blocks.append((f"h{len(m.group(1))}", m.group(2)))
            i += 1
        elif ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            blocks.append(("table", rows))
        elif re.match(r"^\s*[-*] ", ln):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*] ", lines[i]):
                items.append(re.sub(r"^\s*[-*] ", "", lines[i]))
                i += 1
            blocks.append(("ul", items))
        elif re.match(r"^\d+\. ", ln):
            items = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                items.append(re.sub(r"^\d+\. ", "", lines[i]))
                i += 1
            blocks.append(("ol", items))
        else:
            para = [ln]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"^(#|\||\s*[-*] |\d+\. )", lines[i]):
                para.append(lines[i].strip())
                i += 1
            blocks.append(("p", " ".join(para)))
    return blocks


def sections(blocks):
    """Group into (h2_title, [blocks]) with preamble under title ''. Returns (doc_title, sections)."""
    title, secs = "", [("", [])]
    for k, v in blocks:
        if k == "h1":
            title = v
        elif k == "h2":
            secs.append((v, []))
        else:
            secs[-1][1].append((k, v))
    return title, [s for s in secs if s[0] or s[1]]


# ---------- shared flowables ----------

def table(rows, width, font=8, header=True):
    n = max(len(r) for r in rows)
    rows = [r + [""] * (n - len(r)) for r in rows]
    data = [[Paragraph(inline(c), CELL) for c in r] for r in rows]
    t = Table(data, colWidths=[width / n] * n, repeatRows=1 if header else 0)
    st = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0b8c4")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("FONTSIZE", (0, 0), (-1, -1), font),
          ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f5f9")])]
    if header:
        st += [("BACKGROUND", (0, 0), (-1, 0), NAVY)]
        for c in data[0]:
            c.style = ParagraphStyle("hc", parent=CELL, textColor=colors.white, fontName="Helvetica-Bold")
    t.setStyle(TableStyle(st))
    return t


def generic(blocks, width, body=BODY):
    out = []
    for k, v in blocks:
        if k == "h3":
            out.append(Paragraph(inline(v), H3))
        elif k == "p":
            out.append(Paragraph(inline(v), body))
        elif k in ("ul", "ol"):
            for n, it in enumerate(v, 1):
                out.append(Paragraph(("&bull; " if k == "ul" else f"{n}. ") + inline(it), body, bulletText=None))
        elif k == "table":
            out += [Spacer(1, 4), table(v, width), Spacer(1, 4)]
    return out


def doc(path, pagesize, frames_fn, header_text, footer_text):
    d = BaseDocTemplate(str(path), pagesize=pagesize, leftMargin=1.8 * cm, rightMargin=1.8 * cm,
                        topMargin=2 * cm, bottomMargin=1.8 * cm, title=path.stem, author=COMPANY)

    def deco(c, dd):
        c.saveState()
        c.setFont("Helvetica-Bold", 8.5); c.setFillColor(NAVY)
        c.drawString(d.leftMargin, pagesize[1] - 1.2 * cm, COMPANY)
        c.setFont("Helvetica", 7.5); c.setFillColor(colors.grey)
        c.drawRightString(pagesize[0] - d.rightMargin, pagesize[1] - 1.2 * cm, header_text)
        c.drawString(d.leftMargin, 1 * cm, footer_text)
        c.drawRightString(pagesize[0] - d.rightMargin, 1 * cm, f"Page {dd.page}")
        c.restoreState()
    d.addPageTemplates([PageTemplate(id="main", frames=frames_fn(d), onPage=deco)])
    return d


def single(d): return [Frame(d.leftMargin, d.bottomMargin, d.width, d.height, id="f")]


def two(d):
    gap, w = 0.6 * cm, (d.width - 0.6 * cm) / 2
    return [Frame(d.leftMargin, d.bottomMargin, w, d.height, id="l"),
            Frame(d.leftMargin + w + gap, d.bottomMargin, w, d.height, id="r")]


# ---------- layouts ----------

def render(name, md):
    title, secs = sections(parse(md))
    layout = LAYOUTS[name]
    path = OUT / f"{name}.pdf"
    ver = next((b[1] for s in secs[:1] for b in s[1] if b[0] == "p"), "")
    foot = f"Confidential - internal use | {layout} layout"
    W = A4[0] - 3.6 * cm
    WL = landscape(A4)[0] - 3.6 * cm
    story = []

    if layout == "book":
        d = doc(path, A4, single, title, foot)
        story += [Spacer(1, 5 * cm), Paragraph(inline(title), H1), Paragraph(inline(ver), BODY), PageBreak(),
                  Paragraph("Table of Contents", H2)]
        story += [Paragraph(f"Chapter {i}. {inline(re.sub(r'^\d+\.\s*', '', t))}", BODY) for i, (t, _) in enumerate(secs[1:], 1)]
        for i, (t, blocks) in enumerate(secs[1:], 1):
            story += [PageBreak(), Paragraph(f"CHAPTER {i}", H3), Paragraph(inline(re.sub(r"^\d+\.\s*", "", t)), H1)]
            story += generic(blocks, W)

    elif layout == "legal":
        d = doc(path, A4, single, title, foot)
        story += [Paragraph(inline(title).upper(), H1), Paragraph(inline(ver), BODY), Spacer(1, 8)]
        for si, (t, blocks) in enumerate(secs[1:], 1):
            story.append(Paragraph(f"ARTICLE {si} - {inline(t).upper()}", H2))
            n = 0
            for k, v in blocks:
                items = v if k in ("ul", "ol") else [v] if k == "p" else []
                for it in items:
                    n += 1
                    story.append(Paragraph(f"<b>{si}.{n}</b>&nbsp;&nbsp;{inline(it)}", BODY))
                if k == "table":
                    for r in v[1:]:
                        n += 1
                        story.append(Paragraph(f"<b>{si}.{n}</b>&nbsp;&nbsp;" + "; ".join(
                            f"{inline(h)}: {inline(c)}" for h, c in zip(v[0], r)), BODY))
                if k == "h3":
                    story.append(Paragraph(inline(v), H3))

    elif layout == "twocol":
        d = doc(path, A4, two, title, foot)
        story += [Paragraph(inline(title), H2), Paragraph(inline(ver), BODY)]
        for t, blocks in secs[1:]:
            story.append(Paragraph(inline(t), H3))
            story += generic(blocks, W / 2 - 0.3 * cm, body=ParagraphStyle("n", parent=BODY, fontSize=8.5, leading=11))

    elif layout == "faq":
        d = doc(path, A4, single, title, foot)
        story += [Paragraph(inline(title) + " - Questions &amp; Answers", H1), Paragraph(inline(ver), BODY)]
        qn = 0
        for t, blocks in secs[1:]:
            story.append(Paragraph(inline(t), H2))
            pending_q = None
            for k, v in blocks:
                if k == "p" and v.startswith("**") and "?**" in v:  # explicit FAQ "**Q?** A"
                    q, a = v.split("?**", 1)
                    items = [(q.strip("*") + "?", a.strip())]
                elif k == "p":
                    items = [(f"What does the policy say about {t.lower()}?", v)]
                elif k in ("ul", "ol"):
                    items = [(f"{t}: what applies to '{re.split(r'[:.,(]', re.sub(r'\*', '', it))[0].strip()}'?", it) for it in v]
                elif k == "table":
                    items = [(f"{t}: {r[0]}?", "; ".join(f"{h}: {c}" for h, c in zip(v[0][1:], r[1:]))) for r in v[1:]]
                else:
                    items = []
                for q, a in items:
                    qn += 1
                    story.append(KeepTogether([Paragraph(f"<b>Q{qn}. {inline(q)}</b>", BODY),
                                               Paragraph(f"<i>A:</i> {inline(a)}", BODY), Spacer(1, 5)]))

    elif layout == "slides":
        d = doc(path, landscape(A4), single, title, foot)
        big = ParagraphStyle("big", parent=BODY, fontSize=13, leading=18)
        story += [Spacer(1, 4 * cm), Paragraph(inline(title), H1), Paragraph(inline(ver), big)]
        for i, (t, blocks) in enumerate(secs[1:], 1):
            story += [PageBreak(), Paragraph(f"{i} / {len(secs) - 1}", BODY),
                      Paragraph(inline(t), ParagraphStyle("st", parent=H1, alignment=0))]
            story += generic(blocks, WL, body=big)

    elif layout == "sheet":
        d = doc(path, landscape(A4), single, title, foot)
        story += [Paragraph(inline(title), H2), Paragraph(inline(ver), BODY)]
        for t, blocks in secs[1:]:
            story.append(Paragraph(inline(t), H3))
            notes = []
            for k, v in blocks:
                if k == "table":
                    story += [table(v, WL, font=7.5), Spacer(1, 4)]
                elif k in ("ul", "ol"):
                    notes += v
                elif k == "p":
                    notes.append(v)
            if notes:
                story += [table([["#", "Note"]] + [[str(i), n] for i, n in enumerate(notes, 1)], WL, font=7.5), Spacer(1, 6)]

    elif layout == "checklist":
        d = doc(path, A4, single, title, foot)
        story += [Paragraph(inline(title) + " - Checklist", H1), Paragraph(inline(ver), BODY)]
        for t, blocks in secs[1:]:
            rows = [["", inline(t)]]
            for k, v in blocks:
                items = v if k in ("ul", "ol") else [v] if k == "p" else \
                    [" | ".join(r) for r in v[1:]] if k == "table" else []
                rows += [["[  ]", it] for it in items]
            story += [table(rows, W), Spacer(1, 8)]

    elif layout == "memo":
        d = doc(path, A4, single, title, foot)
        story += [Paragraph("MEMORANDUM", H1),
                  table([["To", "All employees"], ["From", "Ethics Committee (General Counsel, Head of People, CFO)"],
                         ["Date", "1 April 2026"], ["Re", inline(title)]], W, header=False), Spacer(1, 10)]
        prose = []
        for t, blocks in secs:
            start = len(prose)
            for k, v in blocks:
                if k == "p":
                    prose.append(v)
                elif k in ("ul", "ol"):
                    prose.append(" ".join(x.rstrip(".") + "." for x in v))
                elif k == "table":
                    prose.append(" ".join("; ".join(r) + "." for r in v[1:]))
            if t and len(prose) > start:
                prose[start] = f"<b>{t}.</b> " + prose[start]
        story += [Paragraph(inline(p).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>"), BODY) for p in prose]
        story += [Spacer(1, 20), Paragraph("Signed,<br/>Ethics Committee", BODY)]

    elif layout == "matrix":
        d = doc(path, A4, single, title, foot)
        story += [Paragraph(inline(title), H1), Paragraph(inline(ver), BODY), Spacer(1, 6)]
        rows = [["Topic", "Requirement"]]
        for t, blocks in secs:
            for k, v in blocks:
                if k == "p":
                    rows.append([t or "Overview", v])
                elif k in ("ul", "ol"):
                    rows += [[t, it] for it in v]
                elif k == "table":
                    rows += [[f"{t} - {r[0]}", "; ".join(f"{h}: {c}" for h, c in zip(v[0][1:], r[1:]))] for r in v[1:]]
                elif k == "h3":
                    rows.append([t, f"<b>{v}</b>"])
        t = table(rows, W)
        t._argW = [4.5 * cm, W - 4.5 * cm]
        story.append(t)

    d.build(story)
    return layout


def main():
    OUT.mkdir(exist_ok=True)
    for md in sorted(SRC.glob("[0-9]*.md")):
        layout = render(md.stem, md.read_text(encoding="utf-8"))
        print(f"{md.stem:<36} {layout:<10} {(OUT / (md.stem + '.pdf')).stat().st_size // 1024:>4} KB")


if __name__ == "__main__":
    main()
