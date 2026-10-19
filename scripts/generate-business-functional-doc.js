/**
 * Converts docs/BUSINESS_FUNCTIONAL_DOCUMENT.md into a full Word document.
 * Run: npm run docs:business
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  Header, Footer, PageNumber, VerticalAlign, PageBreak,
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE = '1A5276';
const HEADER_BG = '1A5276';
const HEADER_TEXT = 'FFFFFF';
const ALT_ROW = 'F4F7F8';
const BORDER_COLOR = 'D5DDE0';
const MUTED = '5D6D7E';
const BODY = 22; // 11pt
const TABLE_SIZE = 20; // 10pt

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
};

function inlineRuns(text, base = {}) {
  const size = base.size || BODY;
  const font = base.font || 'Calibri';
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = [];
  let last = 0;
  let m;
  const src = String(text);
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push({ t: src.slice(last, m.index), kind: 'text' });
    const s = m[0];
    if (s.startsWith('**')) parts.push({ t: s.slice(2, -2), kind: 'bold' });
    else if (s.startsWith('`')) parts.push({ t: s.slice(1, -1), kind: 'code' });
    else if (s.startsWith('[')) parts.push({ t: s.replace(/\[([^\]]+)\]\([^)]+\)/, '$1'), kind: 'bold' });
    else parts.push({ t: s.slice(1, -1), kind: 'italic' });
    last = m.index + s.length;
  }
  if (last < src.length) parts.push({ t: src.slice(last), kind: 'text' });
  if (!parts.length) parts.push({ t: src, kind: 'text' });
  return parts.filter((p) => p.t !== '').map((p) => new TextRun({
    text: p.t,
    bold: p.kind === 'bold' || !!base.bold,
    italics: p.kind === 'italic' || !!base.italics,
    font: p.kind === 'code' ? 'Consolas' : font,
    size,
    color: p.kind === 'code' ? BLUE : base.color,
  }));
}

function p(text, extra = {}) {
  return new Paragraph({
    children: inlineRuns(text, extra),
    spacing: { before: extra.before ?? 80, after: extra.after ?? 80, line: 276 },
    alignment: extra.align,
  });
}

function heading(text, level, pageBreakBefore = false) {
  const map = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
  };
  return new Paragraph({
    heading: map[level] || HeadingLevel.HEADING_2,
    children: [new TextRun({ text })],
    spacing: { before: level === 1 ? 240 : 280, after: 140 },
    pageBreakBefore,
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: inlineRuns(text),
    bullet: { level },
    spacing: { before: 60, after: 60, line: 276 },
  });
}

function numbered(text) {
  return new Paragraph({
    children: inlineRuns(text),
    numbering: { reference: 'steps', level: 0 },
    spacing: { before: 80, after: 80, line: 276 },
  });
}

function cell(text, widthPct, opts = {}) {
  const header = !!opts.header;
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    shading: header
      ? { type: ShadingType.CLEAR, fill: HEADER_BG }
      : opts.alt ? { type: ShadingType.CLEAR, fill: ALT_ROW } : undefined,
    margins: { top: 80, bottom: 80, left: 90, right: 90 },
    borders: thinBorder,
    children: [new Paragraph({
      children: inlineRuns(text, {
        bold: header || opts.bold,
        color: header ? HEADER_TEXT : undefined,
        size: header ? 18 : TABLE_SIZE,
      }),
      spacing: { before: 40, after: 40, line: 260 },
    })],
  });
}

function colWidths(n) {
  if (n === 2) return [32, 68];
  if (n === 3) return [22, 39, 39];
  if (n === 4) return [10, 22, 18, 50];
  if (n === 5) return [8, 18, 16, 12, 46];
  const even = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? 100 - even * (n - 1) : even));
}

function tableFromRows(rows) {
  if (!rows.length) return [];
  const n = Math.max(...rows.map((r) => r.length));
  const widths = colWidths(n);
  const normalize = (row) => {
    const copy = row.slice();
    while (copy.length < n) copy.push('');
    return copy.slice(0, n);
  };
  const header = normalize(rows[0]);
  const body = rows.slice(1).map(normalize);
  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map((h, i) => cell(h, widths[i], { header: true })),
  });
  const bodyRows = body.map((row, ri) => new TableRow({
    children: row.map((v, i) => cell(String(v), widths[i], { alt: ri % 2 === 1 })),
  }));
  return [
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

function parseTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, '')));
}

function extractMermaidNodes(code) {
  const nodes = [];
  const seen = new Set();
  const patterns = [
    /\w+\["([^"]+)"\]/g,
    /\w+\['([^']+)'\]/g,
    /\w+\(\[([^\]]+)\]\)/g,
    /\w+\[([^\]]+)\]/g,
    /\w+\(\(([^)]+)\)\)/g,
    /\w+\(([^)]+)\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const label = m[1].replace(/\\n/g, ' — ').replace(/\s+/g, ' ').trim();
      if (label && !seen.has(label) && !/^(flowchart|TB|LR|style)$/i.test(label)) {
        seen.add(label);
        nodes.push(label);
      }
    }
  }
  return nodes;
}

function mermaidBlocks(code) {
  const nodes = extractMermaidNodes(code);
  const blocks = [
    p('*Process flow (diagram rendered as numbered steps in Word):*', { italics: true, color: MUTED, size: 20 }),
  ];
  if (!nodes.length) {
    blocks.push(p(code.replace(/\s+/g, ' ').slice(0, 500)));
    return blocks;
  }
  nodes.forEach((n, i) => blocks.push(numbered(`${i + 1}. ${n}`)));
  return blocks;
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let skipToc = false;
  let firstH1Done = false;
  let chapterH1Count = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      i += 1;
      continue;
    }

    if (line.startsWith('# ') && !firstH1Done) {
      firstH1Done = true;
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/`/g, '').trim();
      if (level === 2 && /^table of contents$/i.test(text)) {
        skipToc = true;
        i += 1;
        continue;
      }
      if (skipToc && level === 2) skipToc = false;
      if (skipToc) {
        i += 1;
        continue;
      }
      const isChapter = level === 2;
      if (isChapter) chapterH1Count += 1;
      out.push(heading(text, Math.min(level, 5), isChapter && chapterH1Count > 1));
      i += 1;
      continue;
    }

    if (skipToc) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const fence = [];
      const lang = line.slice(3).trim();
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        fence.push(lines[i]);
        i += 1;
      }
      i += 1;
      const code = fence.join('\n');
      if (lang === 'mermaid') out.push(...mermaidBlocks(code));
      else {
        code.split('\n').forEach((cl) => {
          out.push(new Paragraph({
            children: [new TextRun({ text: cl || ' ', font: 'Consolas', size: 18, color: '1C2833' })],
            spacing: { before: 20, after: 20 },
            shading: { type: ShadingType.CLEAR, fill: 'F4F7F8' },
          }));
        });
      }
      continue;
    }

    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = parseTableRow(lines[i]);
        if (cells && !isSeparatorRow(cells)) rows.push(cells);
        i += 1;
      }
      if (rows.length) out.push(...tableFromRows(rows));
      continue;
    }

    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, '').replace(/\s+$/, ''));
        i += 1;
      }
      quote.filter(Boolean).forEach((q) => {
        out.push(new Paragraph({
          children: inlineRuns(q, { italics: true, color: MUTED, size: 22 }),
          spacing: { before: 60, after: 60, line: 276 },
          indent: { left: 200 },
        }));
      });
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      const level = bulletMatch[1].length >= 2 ? 1 : 0;
      out.push(bullet(bulletMatch[2], level));
      i += 1;
      continue;
    }

    const numMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numMatch) {
      out.push(numbered(numMatch[1]));
      i += 1;
      continue;
    }

    out.push(p(line));
    i += 1;
  }
  return out;
}

function coverPage(meta) {
  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      children: [new TextRun({ text: 'Zuari Industries', size: 24, color: MUTED, font: 'Calibri', bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'DigiLog', size: 72, bold: true, color: BLUE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Comprehensive Functional and Business Document', size: 32, color: '1C2833', font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'Every screen, button, form field, click action, and business rule — written so anyone can understand the application.',
        size: 22,
        italics: true,
        color: MUTED,
        font: 'Calibri',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    ...tableFromRows([
      ['Item', 'Detail'],
      ...meta,
    ]),
    pageBreak(),
  ];
}

function tocPage(md) {
  const items = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{2,4})\s+(.*)$/);
    if (!m) continue;
    const text = m[2].replace(/`/g, '').trim();
    if (/^table of contents$/i.test(text)) continue;
    const level = m[1].length - 2;
    items.push(new Paragraph({
      children: [new TextRun({ text, size: 22, font: 'Calibri', bold: level === 0, color: level === 0 ? BLUE : '1C2833' })],
      indent: { left: level * 360 },
      spacing: { before: level === 0 ? 140 : 60, after: 40, line: 276 },
    }));
  }
  return [
    heading('Table of Contents', 1, false),
    p('This Word file is generated from the full markdown source. Heading styles are applied so you can also use Word’s Navigation pane (View → Navigation Pane).'),
    ...items,
  ];
}

async function main() {
  const mdPath = path.join(__dirname, '../docs/BUSINESS_FUNCTIONAL_DOCUMENT.md');
  const md = fs.readFileSync(mdPath, 'utf8');

  const meta = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^>\s*\*\*([^*]+):\*\*\s+(.*)/);
    if (m) meta.push([m[1].trim(), m[2].replace(/`/g, '').replace(/\s+$/, '').trim()]);
    if (line.startsWith('## ')) break;
  }
  meta.push(['Source', 'docs/BUSINESS_FUNCTIONAL_DOCUMENT.md (full text, not a summary)']);
  meta.push(['Generated', new Date().toISOString().slice(0, 10)]);

  const children = [
    ...coverPage(meta),
    ...tocPage(md),
    ...parseMarkdown(md),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: BODY },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickStyle: true,
          paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
          run: { size: 36, bold: true, font: 'Calibri', color: BLUE },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickStyle: true,
          paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
          run: { size: 28, bold: true, font: 'Calibri', color: '1C2833' },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickStyle: true,
          paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 },
          run: { size: 24, bold: true, font: 'Calibri', color: '2471A3' },
        },
        {
          id: 'Heading4',
          name: 'Heading 4',
          basedOn: 'Normal',
          next: 'Normal',
          quickStyle: true,
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 3 },
          run: { size: 22, bold: true, font: 'Calibri', color: '2C3E50' },
        },
        {
          id: 'Heading5',
          name: 'Heading 5',
          basedOn: 'Normal',
          next: 'Normal',
          quickStyle: true,
          paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 4 },
          run: { size: 22, bold: true, italics: true, font: 'Calibri', color: '34495E' },
        },
      ],
    },
    numbering: {
      config: [{
        reference: 'steps',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 420, hanging: 280 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({
              text: 'DigiLog — Comprehensive Functional and Business Document',
              size: 16,
              color: MUTED,
              italics: true,
              font: 'Calibri',
            })],
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR, space: 4 } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'Page ', size: 16, color: MUTED, font: 'Calibri' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: 'Calibri' }),
              new TextRun({ text: ' of ', size: 16, color: MUTED, font: 'Calibri' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font: 'Calibri' }),
              new TextRun({ text: '  |  Zuari Industries — Internal', size: 16, color: MUTED, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  const docsDir = path.join(__dirname, '../docs');
  const candidates = [
    path.join(docsDir, 'DigiLog_Business_Functional_Document.docx'),
    path.join(docsDir, 'DigiLog_Business_Functional_Document_full.docx'),
    path.join(docsDir, 'DigiLog_Business_Functional_Document_v3.docx'),
  ];
  let written = null;
  for (const candidate of candidates) {
    try {
      fs.writeFileSync(candidate, buf);
      written = candidate;
      break;
    } catch { /* locked */ }
  }
  if (!written) {
    console.error('Could not write any output file — close the Word document and retry.');
    process.exit(1);
  }
  console.log(`Wrote ${written} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
