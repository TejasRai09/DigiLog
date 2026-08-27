/**
 * DigiLog BI — single formula reference workbook for every dashboard.
 *
 * One sheet per dashboard: section -> sub-section -> element (KPI / chart /
 * table column / comparison label) with the calculation, the source
 * table.columns and a short description for every number on screen.
 *
 * Row data lives in docs/bi/_formula-data/*.json so the spec can be edited
 * without touching the layout code.
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-all-dashboards-formulas-excel.js
 *   node scripts/generate-all-dashboards-formulas-excel.js --out ../docs/bi/My-File.xlsx
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DATA_DIR = path.resolve(__dirname, '../../docs/bi/_formula-data');
const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.resolve(__dirname, '../../docs/bi/DigiLog-BI-All-Dashboards-Formulas.xlsx');

const NAVY = '1F3864';
const TEAL = '0F7173';
const SLATE = '334155';
const WHITE = 'FFFFFF';
const LIGHT = 'EBF5FB';

/** Sheet order + short sheet names (Excel caps sheet names at 31 chars). */
const DASHBOARD_ORDER = [
  ['cane-performance', 'Cane Performance'],
  ['centre-maturity', 'Centre Maturity'],
  ['brix-sampling', 'Brix Sampling'],
  ['milling-operations', 'Milling Operations'],
  ['power-house', 'Power House'],
  ['distillery-analytics', 'Distillery Analytics'],
  ['management-dashboard', 'Management Dashboard'],
  ['purchy-analysis', 'Purchy Analysis'],
];

const COLUMNS = [
  { header: 'Section', key: 'section', width: 26 },
  { header: 'Sub-section', key: 'subSection', width: 28 },
  { header: 'Element', key: 'element', width: 16 },
  { header: 'Number / Metric (as shown)', key: 'name', width: 34 },
  { header: 'Unit', key: 'unit', width: 12 },
  { header: 'Short description', key: 'description', width: 58 },
  { header: 'Formula / calculation (measure)', key: 'formula', width: 86 },
  { header: 'Source table.columns', key: 'source', width: 52 },
  { header: 'Comparison label / % change', key: 'comparison', width: 58 },
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
  row.height = 30;
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

function loadSpecs() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error('Missing spec folder:', DATA_DIR);
    process.exit(1);
  }
  const specs = [];
  for (const [slug, title] of DASHBOARD_ORDER) {
    const file = path.join(DATA_DIR, `${slug}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`! skipped (no spec file): ${slug}.json`);
      continue;
    }
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`! invalid JSON in ${slug}.json:`, err.message);
      process.exit(1);
    }
    specs.push({
      slug,
      sheet: title.slice(0, 31),
      dashboard: spec.dashboard || title,
      route: spec.route || '',
      apiEndpoints: spec.apiEndpoints || [],
      tables: spec.tables || [],
      rows: spec.rows || [],
    });
  }
  if (!specs.length) {
    console.error('No dashboard spec files found in', DATA_DIR);
    process.exit(1);
  }
  return specs;
}

function addDataSheet(wb, spec) {
  const ws = wb.addWorksheet(spec.sheet, {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 4 }],
  });

  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${spec.dashboard} — every number, its formula and its source`;
  titleCell.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Calibri' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const metaCell = ws.getCell(2, 1);
  const api = spec.apiEndpoints.length ? spec.apiEndpoints.join('  |  ') : 'n/a';
  metaCell.value = `Route: ${spec.route || 'n/a'}      API: ${api}      Numbers documented: ${spec.rows.length}`;
  metaCell.font = { size: 10, italic: true, color: { argb: SLATE }, name: 'Calibri' };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  ws.getRow(2).height = 22;

  COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
    ws.getCell(3, i + 1).value = col.header;
  });
  styleHeader(ws.getRow(3));

  spec.rows.forEach((row, i) => {
    const added = ws.addRow(COLUMNS.map((c) => row[c.key] || ''));
    added.height = 46;
    added.eachCell((c) => styleBody(c, i % 2 === 1));
    added.getCell(4).font = { name: 'Calibri', size: 10, bold: true };
  });

  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + spec.rows.length, column: COLUMNS.length },
  };
  return ws;
}

function addIndexSheet(wb, specs) {
  const ws = wb.addWorksheet('Index', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Sheet', key: 'sheet', width: 26 },
    { header: 'Dashboard', key: 'dash', width: 26 },
    { header: 'Route in app', key: 'route', width: 30 },
    { header: 'Numbers documented', key: 'count', width: 20 },
    { header: 'Sections covered', key: 'sections', width: 62 },
    { header: 'API endpoints', key: 'api', width: 62 },
  ];
  styleHeader(ws.getRow(1), NAVY);
  specs.forEach((spec, i) => {
    const sections = [...new Set(spec.rows.map((r) => r.section).filter(Boolean))];
    const added = ws.addRow({
      sheet: spec.sheet,
      dash: spec.dashboard,
      route: spec.route,
      count: spec.rows.length,
      sections: sections.join(', '),
      api: spec.apiEndpoints.join('\n'),
    });
    added.height = 42;
    added.eachCell((c) => styleBody(c, i % 2 === 1));
    added.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
  });
  const total = specs.reduce((sum, s) => sum + s.rows.length, 0);
  const totalRow = ws.addRow({ sheet: 'TOTAL', dash: '', route: '', count: total, sections: '', api: '' });
  totalRow.eachCell((c) => {
    styleBody(c, false);
    c.font = { name: 'Calibri', size: 10, bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  });
  return total;
}

function addCombinedSheet(wb, specs) {
  const ws = wb.addWorksheet('All numbers (flat)', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }],
  });
  const cols = [{ header: 'Dashboard', key: 'dashboard', width: 22 }, ...COLUMNS];
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(ws.getRow(1));
  let i = 0;
  let count = 0;
  for (const spec of specs) {
    for (const row of spec.rows) {
      const added = ws.addRow({
        dashboard: spec.dashboard,
        ...Object.fromEntries(COLUMNS.map((c) => [c.key, row[c.key] || ''])),
      });
      added.height = 44;
      added.eachCell((c) => styleBody(c, i % 2 === 1));
      i += 1;
      count += 1;
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return count;
}

function addTablesSheet(wb, specs) {
  const ws = wb.addWorksheet('Tables & Columns', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Dashboard', key: 'dashboard', width: 22 },
    { header: 'Table', key: 'table', width: 34 },
    { header: 'Columns used', key: 'columns', width: 96 },
    { header: 'What it holds / why the dashboard reads it', key: 'purpose', width: 62 },
  ];
  styleHeader(ws.getRow(1), SLATE);
  let i = 0;
  let count = 0;
  for (const spec of specs) {
    for (const t of spec.tables) {
      const added = ws.addRow({
        dashboard: spec.dashboard,
        table: t.table || '',
        columns: Array.isArray(t.columns) ? t.columns.join(', ') : String(t.columns || ''),
        purpose: t.purpose || '',
      });
      added.height = 44;
      added.eachCell((c) => styleBody(c, i % 2 === 1));
      added.getCell(2).font = { name: 'Calibri', size: 10, bold: true };
      i += 1;
      count += 1;
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  return count;
}

function addHowToReadSheet(wb, specs) {
  const ws = wb.addWorksheet('How to read', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Topic', key: 'topic', width: 30 },
    { header: 'Explanation', key: 'rule', width: 140 },
  ];
  styleHeader(ws.getRow(1), NAVY);
  const sheetList = specs.map((s) => s.sheet).join('  |  ');
  [
    ['What this file is', 'Every number shown on every DigiLog BI dashboard, with the calculation behind it, the database table and columns it reads, and a one-line description. Generated from the application source code, so it matches what the app actually computes.'],
    ['One sheet per dashboard', sheetList],
    ['Reading order in a sheet', 'Section (dashboard tab) -> Sub-section (panel or card group) -> Element (what kind of thing it is) -> the number itself.'],
    ['Element column', 'KPI card = a headline number. Chart / Chart series = a plotted line, bar, pie slice or area. Table column = a column in an on-screen table. Label = a caption or comparison chip. Filter = a control that changes the numbers. Derived = an intermediate value used by other numbers.'],
    ['Formula column', 'The actual calculation: SQL expression, aggregation (SUM / AVG / COUNT / MAX), ratio or percentage math, unit conversion, rounding, and how blanks or zeros are handled.'],
    ['Source table.columns', 'The database table(s) and column(s) the number is built from. Cross-reference the "Tables & Columns" sheet for what each table holds.'],
    ['Comparison label / % change', 'How the change chip next to the number is calculated and worded. Standard form: % change = (Current - Compare) / Compare x 100, shown as "vs {compare window} {preset}". Some numbers are inverse (a rise is bad and shown red).'],
    ['Date window', 'Every number is filtered to the selected From-To range. Presets: MTD (month to date), STD (season to date), YTD (year to date), Custom (user picked).'],
    ['Compare window', 'Prev. Period / Prev. Month / Prev. Season / Prev. Year shift the window back by one equivalent period. Season comparisons (2024-2025, 2023-2024, ...) come from the season_mapping table, so the options in the app follow whatever seasons are configured there.'],
    ['Configurable constants', 'Some numbers use values an admin can change in Config, stored in portal_settings: brix_threshold (default 18) for Brix ripeness, distillery_theoretical_yield (default 64.4), power_tariff_rate (default 4.85). Those numbers are flagged in the Formula column.'],
    ['All numbers (flat)', 'Every row from every dashboard in one filterable list - use this to search for a metric when you do not know which dashboard it sits on.'],
    ['Regenerating this file', 'cd DigiLog/backend then: npm run db:generate-all-dashboard-formulas'],
  ].forEach((pair, i) => {
    const row = ws.addRow({ topic: pair[0], rule: pair[1] });
    row.height = 46;
    row.eachCell((c) => styleBody(c, i % 2 === 1));
    row.getCell(1).font = { bold: true, name: 'Calibri', size: 10 };
  });
}

async function main() {
  const specs = loadSpecs();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();
  wb.title = 'DigiLog BI - dashboard formula reference';

  addHowToReadSheet(wb, specs);
  const total = addIndexSheet(wb, specs);
  specs.forEach((spec) => addDataSheet(wb, spec));
  const flat = addCombinedSheet(wb, specs);
  const tableCount = addTablesSheet(wb, specs);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  console.log('Wrote', OUT);
  console.log(`Dashboards: ${specs.length}   Numbers documented: ${total}   Flat rows: ${flat}   Table entries: ${tableCount}`);
  specs.forEach((s) => console.log(`  - ${s.sheet}: ${s.rows.length} numbers, ${s.tables.length} tables`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
