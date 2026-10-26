"""Build DigiLog-Operator-Handbook.docx from handbook markdown chapters."""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "DigiLog-Operator-Handbook.docx"

NAVY = RGBColor(0x1E, 0x3A, 0x5F)
TEAL = RGBColor(0x0F, 0x76, 0x6E)
AMBER_BG = "FEF3C7"
AMBER_BORDER = "D97706"
TABLE_HEADER_BG = "1E3A5F"
GRAY = RGBColor(0x47, 0x55, 0x69)
CODE_BG = "F1F5F9"

CHAPTERS = [
    "README.md",
    "00-cover-and-use.md",
    "01-getting-started.md",
    "02-operation-form.md",
    "03-equipment-maintenance-history.md",
    "04-maintenance-notes.md",
    "05-approvals.md",
    "06-data-upload.md",
    "07-dashboards.md",
    "08-config.md",
    "09-profile-notifications.md",
    "10-workflows.md",
    "11-faqs.md",
    "12-glossary.md",
    "13-quick-reference.md",
    "14-support.md",
]

SCREENSHOT_RE = re.compile(
    r"^\[Screenshot:\s*`?([^`\]]+?)`?\s*[—\-]\s*(.+?),\s*annotate:\s*(.+)\]\s*$"
)

INLINE_RE = re.compile(
    r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)"
)


def set_run_font(run, name="Calibri", size=11, bold=False, italic=False, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color is not None:
        run.font.color.rgb = color


def shade_cell(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_cell_borders(cell, color="CBD5E1", sz="4"):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), sz)
        el.set(qn("w:color"), color)
        tcBorders.append(el)
    tcPr.append(tcBorders)


def add_field(paragraph, instr):
    run = paragraph.add_run()
    r = run._r
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    text = OxmlElement("w:instrText")
    text.set(qn("xml:space"), "preserve")
    text.text = instr
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    r.append(begin)
    r.append(text)
    r.append(sep)
    r.append(end)


def set_paragraph_spacing(p, before=0, after=8, line=1.08):
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = line


def add_inline(paragraph, text, base_size=11, base_color=None):
    text = text.replace("\\", "")
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() > pos:
            run = paragraph.add_run(text[pos : m.start()])
            set_run_font(run, size=base_size, color=base_color)
        token = m.group(0)
        if token.startswith("**") and token.endswith("**"):
            run = paragraph.add_run(token[2:-2])
            set_run_font(run, size=base_size, bold=True, color=base_color or NAVY)
        elif token.startswith("`") and token.endswith("`"):
            run = paragraph.add_run(token[1:-1])
            set_run_font(run, name="Consolas", size=base_size - 1, color=TEAL)
        elif token.startswith("[") and "](" in token:
            label, _url = token[1:-1].split("](", 1)
            run = paragraph.add_run(label)
            set_run_font(run, size=base_size, color=RGBColor(0x1D, 0x4E, 0xD8))
            run.underline = True
        elif token.startswith("*") and token.endswith("*"):
            run = paragraph.add_run(token[1:-1])
            set_run_font(run, size=base_size, italic=True, color=base_color)
        else:
            run = paragraph.add_run(token)
            set_run_font(run, size=base_size, color=base_color)
        pos = m.end()
    if pos < len(text):
        run = paragraph.add_run(text[pos:])
        set_run_font(run, size=base_size, color=base_color)


def add_screenshot_box(doc, lines=None, *, filename="", caption=""):
    pending = ""
    for raw in lines or []:
        t = raw.lstrip("> ").strip()
        if t.startswith("**Screenshot pending:**"):
            pending = t.replace("**Screenshot pending:**", "").strip().strip("`")
            filename = filename or Path(pending).name
        elif t.lower().startswith("caption:"):
            caption = caption or t.split(":", 1)[1].strip()
        elif t.startswith("!["):
            m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", t)
            if m and not caption:
                caption = m.group(1)
        else:
            sm = SCREENSHOT_RE.match(t)
            if sm:
                filename = filename or (sm.group(1).strip() + ".png" if not sm.group(1).strip().endswith(".png") else sm.group(1).strip())
                caption = caption or f"{sm.group(2).strip()}. Highlight: {sm.group(3).strip()}"

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    shade_cell(cell, AMBER_BG)
    set_cell_borders(cell, AMBER_BORDER, "12")

    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_spacing(p, 6, 2)
    run = p.add_run("SCREENSHOT PLACEHOLDER")
    set_run_font(run, size=9, bold=True, color=RGBColor(0x92, 0x40, 0x0E))

    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_spacing(p2, 0, 2)
    run = p2.add_run(filename or pending)
    set_run_font(run, name="Consolas", size=10, color=NAVY)

    if caption:
        p3 = cell.add_paragraph()
        p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_paragraph_spacing(p3, 0, 8)
        run = p3.add_run(caption)
        set_run_font(run, size=10, italic=True, color=GRAY)

    spacer = doc.add_paragraph()
    set_paragraph_spacing(spacer, 0, 10)
    return table


def add_table(doc, rows):
    if not rows:
        return
    cols = max(len(r) for r in rows)
    table = doc.add_table(rows=len(rows), cols=cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for i, row in enumerate(rows):
        for j in range(cols):
            cell = table.cell(i, j)
            text = row[j] if j < len(row) else ""
            cell.text = ""
            p = cell.paragraphs[0]
            set_paragraph_spacing(p, 2, 2, 1.0)
            add_inline(p, text, base_size=10, base_color=RGBColor(0xFF, 0xFF, 0xFF) if i == 0 else None)
            if i == 0:
                shade_cell(cell, TABLE_HEADER_BG)
                for run in p.runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            elif i % 2 == 0:
                shade_cell(cell, "F8FAFC")
            set_cell_borders(cell)
    spacer = doc.add_paragraph()
    set_paragraph_spacing(spacer, 0, 10)


def split_table_row(line):
    line = line.strip().strip("|")
    return [c.strip() for c in line.split("|")]


def is_table_sep(line):
    return bool(re.match(r"^\s*\|?\s*:?-{3,}", line))


def add_code_block(doc, lines, lang=""):
    if lang == "mermaid":
        p = doc.add_paragraph()
        set_paragraph_spacing(p, 6, 4)
        run = p.add_run("Diagram (insert screenshot later)")
        set_run_font(run, size=10, bold=True, italic=True, color=TEAL)
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    shade_cell(cell, CODE_BG)
    set_cell_borders(cell, "94A3B8")
    p = cell.paragraphs[0]
    set_paragraph_spacing(p, 6, 6, 1.15)
    body = "\n".join(lines)
    run = p.add_run(body)
    set_run_font(run, name="Consolas", size=9, color=NAVY)
    spacer = doc.add_paragraph()
    set_paragraph_spacing(spacer, 0, 8)


def style_heading(paragraph, level):
    paragraph.style = doc_heading_style(level)
    pf = paragraph.paragraph_format
    pf.space_before = Pt(16 if level == 1 else 12 if level == 2 else 8)
    pf.space_after = Pt(8 if level == 1 else 6)
    if level == 1:
        pf.page_break_before = True
    for run in paragraph.runs:
        run.font.color.rgb = NAVY
        run.font.name = "Calibri"
        if level == 1:
            run.font.size = Pt(20)
        elif level == 2:
            run.font.size = Pt(14)
        elif level == 3:
            run.font.size = Pt(12)
        else:
            run.font.size = Pt(11)


def doc_heading_style(level):
    return f"Heading {min(level, 4)}"


def strip_md_link(text):
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)


def render_markdown(doc, md, *, skip_h1_page_break=False, rewrite_h1=None):
    lines = md.replace("\r\n", "\n").split("\n")
    i = 0
    first_h1 = True
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            add_code_block(doc, block, lang)
            i += 1
            continue

        sm = SCREENSHOT_RE.match(stripped)
        if sm:
            token = sm.group(1).strip()
            filename = token if token.lower().endswith(".png") else f"{token}.png"
            caption = f"{sm.group(2).strip()}. Highlight: {sm.group(3).strip()}"
            add_screenshot_box(doc, filename=filename, caption=caption)
            i += 1
            continue

        if stripped.startswith(">"):
            quote = []
            while i < len(lines) and (lines[i].strip().startswith(">") or lines[i].strip() == ""):
                if lines[i].strip() == "" and quote and i + 1 < len(lines) and not lines[i + 1].strip().startswith(">"):
                    break
                if lines[i].strip().startswith(">"):
                    body = lines[i].lstrip("> ").strip()
                    if "Screenshot pending" in body and any("Screenshot pending" in q for q in quote):
                        add_screenshot_box(doc, quote)
                        quote = []
                    quote.append(lines[i])
                i += 1
            joined = "\n".join(quote)
            if "Screenshot pending" in joined or "![" in joined:
                add_screenshot_box(doc, quote)
            else:
                p = doc.add_paragraph()
                set_paragraph_spacing(p, 4, 8)
                p.paragraph_format.left_indent = Cm(0.4)
                text = " ".join(q.lstrip("> ").strip() for q in quote if q.strip() not in (">", ""))
                add_inline(p, text, base_size=10, base_color=GRAY)
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and is_table_sep(lines[i + 1]):
            rows = [split_table_row(stripped)]
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                if not is_table_sep(lines[i]):
                    rows.append(split_table_row(lines[i]))
                i += 1
            add_table(doc, rows)
            continue

        if stripped == "---":
            i += 1
            continue

        if stripped.startswith("#"):
            hashes = len(stripped) - len(stripped.lstrip("#"))
            title = stripped[hashes:].strip()
            title = strip_md_link(title)
            if hashes == 1 and rewrite_h1 and first_h1:
                title = rewrite_h1
            p = doc.add_paragraph(title)
            if hashes == 1 and first_h1 and skip_h1_page_break:
                p.paragraph_format.page_break_before = False
                first_h1 = False
                p.style = "Heading 1"
                for run in p.runs:
                    run.font.color.rgb = NAVY
                    run.font.size = Pt(20)
            else:
                if hashes == 1:
                    first_h1 = False
                style_heading(p, hashes)
            i += 1
            continue

        m_ol = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if m_ol:
            text = m_ol.group(3)
            p = doc.add_paragraph(style="List Number")
            p.clear()
            set_paragraph_spacing(p, 1, 3, 1.08)
            add_inline(p, text)
            i += 1
            continue

        m_ul = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if m_ul:
            indent = len(m_ul.group(1).replace("\t", "    "))
            text = m_ul.group(2)
            p = doc.add_paragraph(style="List Bullet")
            p.clear()
            set_paragraph_spacing(p, 1, 3, 1.08)
            if indent >= 2:
                p.paragraph_format.left_indent = Cm(1.5)
            add_inline(p, text)
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        p = doc.add_paragraph()
        set_paragraph_spacing(p, 0, 8)
        add_inline(p, stripped)
        i += 1


def configure_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
    for level in range(1, 5):
        h = styles[f"Heading {level}"]
        h.font.color.rgb = NAVY
        h.font.name = "Calibri"
        h.font.bold = True


def add_header_footer(doc):
    section = doc.sections[0]
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)
    section.different_first_page_header_footer = True

    header = section.header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = hp.add_run("DigiLog v2  ·  Operator Handbook")
    set_run_font(run, size=9, color=GRAY)

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = fp.add_run("Internal use  ·  Page ")
    set_run_font(run, size=9, color=GRAY)
    add_field(fp, "PAGE")
    run = fp.add_run(" of ")
    set_run_font(run, size=9, color=GRAY)
    add_field(fp, "NUMPAGES")


def add_title_page(doc):
    for _ in range(3):
        p = doc.add_paragraph()
        set_paragraph_spacing(p, 0, 0)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("ZUARI INDUSTRIES  ·  GSMA")
    set_run_font(run, size=12, bold=True, color=TEAL)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_spacing(p, 18, 6)
    run = p.add_run("DigiLog")
    set_run_font(run, size=36, bold=True, color=NAVY)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_spacing(p, 0, 18)
    run = p.add_run("Operator Handbook")
    set_run_font(run, size=22, color=NAVY)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Handbook and feature list  ·  numbered 1 / 1.1 / 1.1.1")
    set_run_font(run, size=13, italic=True, color=GRAY)

    meta = [
        ("Product version", "DigiLog v2"),
        ("Handbook date", "25 October 2026"),
        ("Audience", "Operators, maintenance, HODs, data owners, administrators"),
        ("Owner", "Plant training / DigiLog administrator  [TO CONFIRM]"),
        ("Classification", "Internal — plant operations"),
    ]
    t = doc.add_table(rows=len(meta), cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (k, v) in enumerate(meta):
        t.cell(i, 0).text = ""
        t.cell(i, 1).text = ""
        pk = t.cell(i, 0).paragraphs[0]
        pv = t.cell(i, 1).paragraphs[0]
        pk.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        add_inline(pk, k, base_size=11, base_color=GRAY)
        add_inline(pv, f"**{v}**", base_size=11)
        shade_cell(t.cell(i, 0), "F1F5F9")
        set_cell_borders(t.cell(i, 0), "E2E8F0")
        set_cell_borders(t.cell(i, 1), "E2E8F0")

    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_spacing(note, 28, 4)
    run = note.add_run(
        "Screenshot slots are amber boxes. Drop PNG files into docs/handbook/images/ using the filename on each box."
    )
    set_run_font(run, size=10, italic=True, color=GRAY)


def add_toc(doc):
    p = doc.add_paragraph("Contents")
    p.style = "Heading 1"
    p.paragraph_format.page_break_before = True
    for run in p.runs:
        run.font.color.rgb = NAVY
        run.font.size = Pt(20)

    hint = doc.add_paragraph()
    set_paragraph_spacing(hint, 0, 10)
    run = hint.add_run(
        "In Microsoft Word: click inside the field below, then press F9 (or right-click → Update Field) to refresh page numbers."
    )
    set_run_font(run, size=10, italic=True, color=GRAY)

    toc_p = doc.add_paragraph()
    add_field(toc_p, r'TOC \o "1-4" \h \z \u')

    static = [
        "0. Cover and how to use",
        "1. Getting started",
        "2. Operation Form (every form card)",
        "3. Equipment Maintenance History",
        "4. Maintenance Notes",
        "5. Approvals",
        "6. Data Upload",
        "7. Dashboards",
        "8. Config",
        "9. Profile and notifications",
        "10. Daily and shift workflows",
        "11. Troubleshooting and FAQs",
        "12. Glossary",
        "13. Quick reference cards",
        "14. Support",
    ]
    label = doc.add_paragraph()
    set_paragraph_spacing(label, 16, 6)
    run = label.add_run("Chapter list")
    set_run_font(run, size=12, bold=True, color=NAVY)
    for i, title in enumerate(static, start=0):
        p = doc.add_paragraph(style="List Number" if i else "List Number")
        p.clear()
        set_paragraph_spacing(p, 1, 2)
        run = p.add_run(title)
        set_run_font(run, size=11, color=NAVY)


def main():
    doc = Document()
    configure_styles(doc)
    add_header_footer(doc)
    add_title_page(doc)
    add_toc(doc)

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    # Drop the H1 (already on title page) and the duplicate chapter table is useful in Word.
    render_markdown(doc, readme, skip_h1_page_break=False, rewrite_h1="Handbook index")

    for name in CHAPTERS[1:]:
        path = ROOT / name
        text = path.read_text(encoding="utf-8")
        render_markdown(doc, text)

    try:
        doc.save(OUT)
        saved = OUT
    except PermissionError:
        saved = ROOT / "DigiLog-Operator-Handbook-v2.docx"
        doc.save(saved)
        print(f"Could not overwrite {OUT.name} (file is open).")
    print(f"Wrote {saved}")


if __name__ == "__main__":
    main()
