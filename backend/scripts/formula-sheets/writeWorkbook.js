/**
 * Same workbook layout as generate-cane-performance-dashboard-formulas-excel.js.
 * Plain-language formulas, one sheet per dashboard tab, status dropdown.
 */
const ExcelJS = require('exceljs');

const NAVY = '1F3864';
const TEAL = '0F7173';
const WHITE = 'FFFFFF';
const LIGHT = 'EBF5FB';
const YELLOW = 'FEF3C7';
const BLUE = 'DBEAFE';

const STATUS_OPTIONS = ['Verified', 'Need to discuss', 'Mistake', 'Pending'];
const STATUS_FILLS = {
  Verified: 'C6EFCE',
  'Need to discuss': 'FDE68A',
  Mistake: 'FECACA',
  Pending: 'DBEAFE',
};

const METRIC_HEADERS = [
  { header: 'What you see on screen', key: 'name', width: 36 },
  { header: 'Type', key: 'type', width: 14 },
  { header: 'Source sheet', key: 'sheet', width: 28 },
  { header: 'Main column(s) used', key: 'mainCols', width: 38 },
  { header: 'Other columns used', key: 'otherCols', width: 36 },
  { header: 'Simple formula', key: 'formula', width: 78 },
  { header: 'What it means', key: 'meaning', width: 62 },
  { header: 'Example', key: 'example', width: 48 },
  { header: 'Status', key: 'status', width: 22 },
];

const COMMON_HEADERS = [
  { header: 'Area', key: 'area', width: 22 },
  { header: 'Feature', key: 'feature', width: 28 },
  { header: 'What it does', key: 'does', width: 64 },
  { header: 'Example', key: 'example', width: 52 },
];

function styleHeader(row, fill = TEAL) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    c.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });
  row.height = 32;
}

function styleBody(cell, stripe) {
  cell.alignment = { vertical: 'top', wrapText: true };
  cell.font = { name: 'Calibri', size: 10 };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  if (stripe) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
}

function addTitle(ws, text, colCount) {
  ws.mergeCells(1, 1, 1, colCount);
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Calibri' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;
}

function writeSheet(wb, name, title, headers, rows, { status = false } = {}) {
  const ws = wb.addWorksheet(String(name).slice(0, 31));
  addTitle(ws, title, headers.length);
  const headerRow = ws.addRow(headers.map((h) => h.header));
  styleHeader(headerRow);
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width;
  });
  const statusCol = status ? headers.findIndex((h) => h.key === 'status') + 1 : 0;
  rows.forEach((row, idx) => {
    const values = headers.map((h) => (h.key === 'status' ? 'Pending' : (row[h.key] ?? '')));
    const r = ws.addRow(values);
    r.eachCell((c) => styleBody(c, idx % 2 === 1));
    const bulk = String(row.formula || row.does || row.meaning || '');
    r.height = Math.min(160, 28 + Math.ceil(bulk.length / 70) * 12);
    if (statusCol) {
      const cell = r.getCell(statusCol);
      cell.value = 'Pending';
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILLS.Pending } };
      cell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${STATUS_OPTIONS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Status',
        error: 'Choose Verified, Need to discuss, Mistake, or Pending.',
      };
    }
  });
  if (statusCol && rows.length) {
    const letter = ws.getColumn(statusCol).letter;
    const ref = `${letter}3:${letter}${rows.length + 2}`;
    ws.addConditionalFormatting({
      ref,
      rules: Object.entries(STATUS_FILLS).map(([label, argb]) => ({
        type: 'cellIs',
        operator: 'equal',
        formulae: [`"${label}"`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } },
          font: { name: 'Calibri', size: 10, bold: true },
        },
      })),
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return ws;
}

function metric(name, type, sheet, mainCols, otherCols, formula, meaning, example) {
  return { name, type, sheet, mainCols, otherCols, formula, meaning, example };
}

/**
 * @param {import('exceljs').Workbook} unused
 * @param {{
 *   outPath: string,
 *   title: string,
 *   howToRead: [string, string][],
 *   commonRows: [string, string, string, string][],
 *   columns: { sheet: string, name: string, kind: 'blue'|'yellow', meaning: string }[],
 *   tabs: Record<string, ReturnType<typeof metric>[]>,
 * }} spec
 */
async function writeFormulaWorkbook(spec) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  {
    const ws = wb.addWorksheet('How to read');
    addTitle(ws, spec.title, 2);
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 96;
    const hr = ws.addRow(['Topic', 'Guidance']);
    styleHeader(hr, TEAL);
    spec.howToRead.forEach((pair, i) => {
      const r = ws.addRow(pair);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
      r.height = 40;
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }

  writeSheet(
    wb,
    'Common Filters & Controls',
    'Shared filters, date presets, and compare — with examples',
    COMMON_HEADERS,
    spec.commonRows.map((r) => ({
      area: r[0],
      feature: r[1],
      does: r[2],
      example: r[3],
    })),
  );

  {
    const ws = wb.addWorksheet('Source column names');
    addTitle(ws, 'Every column named in Simple formula (same names as the form or upload)', 4);
    const hr = ws.addRow(['Source sheet', 'Column name', 'Header on source', 'Simple meaning']);
    styleHeader(hr, TEAL);
    ws.getColumn(1).width = 32;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 22;
    ws.getColumn(4).width = 88;
    spec.columns.forEach((item, i) => {
      const yellow = item.kind === 'yellow';
      const r = ws.addRow([
        item.sheet,
        item.name,
        yellow ? 'Yellow — calculated' : 'Blue — source',
        item.meaning,
      ]);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: yellow ? YELLOW : BLUE } };
      r.height = Math.min(90, 22 + Math.ceil(String(item.meaning || '').length / 80) * 14);
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }

  const counts = {};
  for (const [tab, metrics] of Object.entries(spec.tabs)) {
    writeSheet(
      wb,
      tab,
      `${tab} — numbers, charts and trends (business formulas)`,
      METRIC_HEADERS,
      metrics,
      { status: true },
    );
    counts[tab] = metrics.length;
  }

  {
    const ws = wb.addWorksheet('Index');
    addTitle(ws, 'Sheet index', 3);
    const hr = ws.addRow(['Sheet', 'Rows', 'Purpose']);
    styleHeader(hr, TEAL);
    ws.getColumn(1).width = 32;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 64;
    const indexRows = [
      ['How to read', '—', 'How business owners should use this file'],
      ['Common Filters & Controls', String(spec.commonRows.length), 'Shared date filters, sync, compare'],
      ['Source column names', String(spec.columns.length), 'Columns used in Simple formula. Yellow = calculated, Blue = entered on the form or upload.'],
      ...Object.entries(counts).map(([k, n]) => [k, String(n), `Formulas for ${k}`]),
    ];
    indexRows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
    });
  }

  await wb.xlsx.writeFile(spec.outPath);
  return counts;
}

module.exports = { writeFormulaWorkbook, metric };
