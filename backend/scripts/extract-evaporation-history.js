/**
 * Extract Production House evaporation specs + maintenance actions
 * from DS Evaporation  history record_2.xlsx
 *
 * Usage (from backend/):
 *   node scripts/extract-evaporation-history.js
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const SRC_CANDIDATES = [
  path.join('C:', 'vivek', 'PLANT', 'DS Evaporation  history record_2.xlsx'),
  path.join('C:', 'vivek', 'PLANT', 'production equipments hisotoru files', 'DS Evaporation  history record_2.xlsx'),
];
const OUT_DIR = path.join(__dirname, '..', 'backlog-data', 'production-equipments');
const OUT_XLSX = path.join(OUT_DIR, 'ds-evaporation-equipment-history.xlsx');
const OUT_JSON = path.join(OUT_DIR, 'ds-evaporation-equipment-history.json');
const OUT_AUDIT = path.join(OUT_DIR, 'ds-evaporation-extract-audit.xlsx');

const YEAR_WORK_RE = /^(year|work\s*done)$/i;
const GENERIC_HEADER_RE = /^(particular|details|work\s*done)$/i;
const SN_HEADER_RE = /^(sr\.?\s*n\.?o?|s\.?\s*n\.?o?|sn)$/i;
const SEASON_RE = /^(OFF\s*SE[AS]+ON|SE[AS]+ON)[\s\-.:]*(\d{4}(?:\s*[-–\/]\s*\d{2,4})?)\s*$/i;
const YEAR_RE = /^(\d{4})\s*[-–\/]?\s*(\d{2,4})?\s*$/;
const ACTION_RE = /^(\d+)\s*[\.\)]\s*(.*)$/;
const SN_RE = /^\d+$/;

const FILL_HEADER = 'FF1E293B';
const FILL_YES = 'FFC6EFCE';
const FILL_NO = 'FFFFC7CE';
const FILL_WARN = 'FFFFEB9C';
const FONT_YES = 'FF006100';
const FONT_NO = 'FF9C0006';
const FONT_WARN = 'FF9C5700';

function findSource() {
  for (const p of SRC_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function cellText(cell) {
  if (!cell || cell.value == null || cell.value === '') return '';
  const v = cell.value;
  if (v instanceof Date) {
    const y = v.getFullYear();
    if (y <= 1900) {
      const hh = String(v.getHours()).padStart(2, '0');
      const mm = String(v.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    const dd = String(v.getDate()).padStart(2, '0');
    const mo = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mo}.${y}`;
  }
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((p) => p.text || '').join('');
    if (v.text) return String(v.text);
    if (v.result != null) return cellText({ value: v.result });
    if (v.formula != null) return String(v.formula);
    if (v instanceof Error) return '';
  }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  return String(v);
}

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function uniqueJoin(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const t = norm(p);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.join(' / ');
}

function classifyType(sheetName, equipmentName) {
  const n = `${sheetName} ${equipmentName}`.toLowerCase();
  if (/\bvljh\b/.test(n) || n.includes('vapour line juice')) return 'Vapour line juice heater';
  if (n.includes('condensate juice') || n.includes('condensate heater') || /^con\.jh/i.test(sheetName)) {
    return 'Condensate juice heater';
  }
  if (/\brjh\b/.test(n) || n.includes('raw juice heater')) return 'Raw juice heater';
  if (/\bsjh\b/.test(n) || n.includes('sulphited juice heater')) return 'Sulphited juice heater';
  if (/\bsk\b/.test(n) || n.includes('semi kestner') || n.includes('kestner')) return 'Semi Kestner';
  if (/\bvc\b/.test(n) || n.includes('vapour cell')) return 'Vapour cell';
  if (/\bffe\b/.test(n) || n.includes('falling film')) return 'Falling film evaporator';
  if (n.includes('condensor') || n.includes('condenser')) return 'Condenser';
  if (/\bquad\b/.test(n) || /body/i.test(n) && /set/i.test(n)) return 'Quad body';
  if (/\bdch\b/.test(n) || n.includes('direct contact')) return 'Direct contact heater';
  return 'Equipment';
}

function parseSeason(text) {
  const m = norm(text).match(SEASON_RE);
  if (!m) return null;
  const kind = /off/i.test(m[1]) ? 'Off-Season' : 'Season';
  return { season: kind, year: m[2].replace(/\s+/g, ''), labelled: true };
}

function parseYear(text) {
  const t = norm(text).replace(/\.0$/, '');
  const season = parseSeason(t);
  if (season) return season;
  const m = t.match(YEAR_RE);
  if (!m) return null;
  const y1 = m[1];
  const y2 = m[2] || '';
  const year = y2 && y2.length >= 2 && y2 !== '-' ? `${y1}-${y2}` : y1;
  return { season: 'Off-Season', year, labelled: false };
}

function inferSeasonFromAction(action, fallback) {
  const t = (action || '').toLowerCase();
  if (/\boff[\s-]*se[as]+on\b/.test(t)) return 'Off-Season';
  if (/\bin[\s-]*season\b/.test(t) || /\bduring\s+season\b/.test(t)) return 'Season';
  return fallback;
}

function detectStartCol(ws, headerRow, maxCol) {
  for (let c = 1; c <= Math.min(maxCol, 4); c++) {
    const t = norm(cellText(ws.getRow(headerRow).getCell(c)));
    if (SN_HEADER_RE.test(t)) return c;
  }
  return 1;
}

function findRightTableStartCol(ws, headerRow, startCol, maxCol) {
  for (let r = 1; r <= Math.min(headerRow + 6, ws.rowCount || headerRow); r++) {
    for (let c = startCol + 3; c <= maxCol; c++) {
      if (SN_HEADER_RE.test(norm(cellText(ws.getRow(r).getCell(c))))) return c;
    }
  }
  return null;
}

function findHeaderRow(ws, maxRow, maxCol) {
  for (let r = 1; r <= Math.min(maxRow, 8); r++) {
    const texts = [];
    for (let c = 1; c <= Math.min(maxCol, 10); c++) {
      texts.push(norm(cellText(ws.getRow(r).getCell(c))));
    }
    if (texts.some((t) => SN_HEADER_RE.test(t))) return r;
  }
  return 1;
}

function findHistoryHeaderRow(ws, headerRow, maxRow, maxCol) {
  for (let r = headerRow; r <= maxRow; r++) {
    const texts = [];
    for (let c = 1; c <= Math.min(maxCol, 8); c++) {
      texts.push(norm(cellText(ws.getRow(r).getCell(c))).toLowerCase());
    }
    if (texts.some((t) => t === 'year') && texts.some((t) => t.includes('work done'))) return r;
    const joined = texts.join(' ');
    if (/jobs\s+done\s+during/i.test(joined)) return r;
  }
  return null;
}

function titleFromSheet(ws, headerRow, startCol, maxCol) {
  const headerName = norm(cellText(ws.getRow(headerRow).getCell(startCol + 1)));
  if (headerName && !GENERIC_HEADER_RE.test(headerName) && !SN_HEADER_RE.test(headerName)) {
    return headerName;
  }
  for (let r = 1; r < headerRow; r++) {
    const parts = [];
    for (let c = 1; c <= Math.min(maxCol, 8); c++) {
      parts.push(cellText(ws.getRow(r).getCell(c)));
    }
    const t = uniqueJoin(parts);
    if (t && !SN_HEADER_RE.test(t) && !GENERIC_HEADER_RE.test(t)) return t;
  }
  return ws.name;
}

function rowParts(ws, r, startCol, maxCol) {
  const parts = [];
  for (let c = startCol; c <= Math.min(maxCol, startCol + 2); c++) {
    parts.push(cellText(ws.getRow(r).getCell(c)));
  }
  return parts;
}

function sheetBounds(ws) {
  const rowCount = Math.max(ws.rowCount || 0, ws.actualRowCount || 0);
  const colHint = Math.max(ws.columnCount || 0, ws.actualColumnCount || 0, 8);
  let maxRow = 0;
  let maxCol = 0;
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cellCount = Math.max(row.cellCount || 0, colHint);
    for (let c = 1; c <= Math.min(cellCount, 12); c++) {
      if (!norm(cellText(row.getCell(c)))) continue;
      maxRow = r;
      if (c > maxCol) maxCol = c;
    }
  }
  return { maxRow, maxCol: Math.max(maxCol, 4) };
}

function extractSheet(ws) {
  const { maxRow, maxCol } = sheetBounds(ws);
  const issues = [];
  if (!maxRow) {
    return {
      sheetName: ws.name,
      equipmentName: ws.name,
      type: 'Equipment',
      duty: '',
      capacity: '',
      specCount: 0,
      historyCount: 0,
      emptyValueCount: 0,
      missingSnCount: 0,
      duplicateSnCount: 0,
      shiftedColumns: false,
      yearOnlyHistory: false,
      specs: [],
      history: [],
      years: [],
      issues: ['Empty sheet'],
      sourceRows: maxRow,
      sourceCols: maxCol,
    };
  }

  const headerRow = findHeaderRow(ws, maxRow, maxCol);
  const startCol = detectStartCol(ws, headerRow, maxCol);
  const rightTableCol = findRightTableStartCol(ws, headerRow, startCol, maxCol);
  const shiftedColumns = startCol > 1;
  const equipmentName = titleFromSheet(ws, headerRow, startCol, maxCol) || ws.name;
  const type = classifyType(ws.name, equipmentName);
  const historyHeaderRow = findHistoryHeaderRow(ws, headerRow, maxRow, maxCol);
  const specEnd = historyHeaderRow ? historyHeaderRow - 1 : maxRow;

  if (shiftedColumns) issues.push(`Spec table starts at column ${startCol}`);
  if (rightTableCol) issues.push(`Right-hand table from column ${rightTableCol} ignored (calc / diagram)`);
  if (headerRow > 2) issues.push(`Header row is ${headerRow}`);
  if (!historyHeaderRow) issues.push('No YEAR / WORK DONE block');

  const nameHint = equipmentName.replace(/[-_\s]/g, '').toUpperCase();
  if (/CONDENSOR-C/i.test(ws.name) && /SET-A/.test(equipmentName)) {
    issues.push('Title says SET-A condenser but sheet is CONDENSOR-C');
  } else if (/CONDENSOR-[ABC]/i.test(ws.name)) {
    const set = ws.name.match(/CONDENSOR-([ABC])/i)[1];
    if (!new RegExp(`SET-${set}`, 'i').test(equipmentName) && !nameHint.includes(`SET${set}`)) {
      issues.push(`Title may not match sheet (${ws.name} vs ${equipmentName})`);
    }
  }

  const specs = [];
  for (let r = headerRow + 1; r <= specEnd; r++) {
    const c1 = norm(cellText(ws.getRow(r).getCell(startCol)));
    const c2 = norm(cellText(ws.getRow(r).getCell(startCol + 1)));
    const c3 = norm(cellText(ws.getRow(r).getCell(startCol + 2)));
    const valueText = c3;
    const line = uniqueJoin([c1, c2, valueText]);
    if (!line) continue;
    if (YEAR_WORK_RE.test(c1) || YEAR_WORK_RE.test(c2)) break;
    if (parseYear(c1) && !c2 && !valueText) continue;

    let sn = '';
    let parameter = '';
    let value = '';

    if (SN_RE.test(c1) && c2) {
      sn = c1;
      parameter = c2;
      value = valueText;
    } else if (!c1 && c2 && !SN_RE.test(c2)) {
      parameter = c2;
      value = valueText;
    } else if (c1 && !SN_RE.test(c1) && !YEAR_WORK_RE.test(c1) && !parseYear(c1)) {
      if (c2 && c1.toLowerCase() !== c2.toLowerCase()) {
        parameter = 'Notes';
        value = uniqueJoin([c1, c2, valueText]);
      } else {
        parameter = c2 && uniqueJoin([c1]) === uniqueJoin([c2]) ? 'Notes' : (c2 || 'Notes');
        value = valueText || (parameter === 'Notes' ? c1 : '');
        if (parameter === 'Notes' && !value) value = uniqueJoin([c1, c2, valueText]);
      }
    } else {
      continue;
    }

    if (!parameter) continue;
    if (!sn && !value && parameter.length > 40) {
      value = parameter;
      parameter = 'Notes';
    }
    specs.push({
      equipmentName,
      sn,
      parameter,
      uom: '',
      value,
      isSection: !sn && !value,
      sourceRow: r,
    });
  }

  const snCounts = {};
  for (const s of specs) {
    if (!s.sn) continue;
    snCounts[s.sn] = (snCounts[s.sn] || 0) + 1;
  }
  const duplicateSnCount = Object.values(snCounts).filter((n) => n > 1).length;
  const missingSnCount = specs.filter((s) => !s.sn && !s.isSection).length;
  const emptyValueCount = specs.filter((s) => !s.value && !s.isSection).length;
  if (duplicateSnCount) issues.push(`${duplicateSnCount} SN value(s) used on more than one spec row`);
  if (missingSnCount) issues.push(`${missingSnCount} spec row(s) without SN`);
  if (emptyValueCount) issues.push(`${emptyValueCount} spec row(s) with empty value`);

  const history = [];
  let yearOnlyHistory = false;
  if (historyHeaderRow) {
    let current = null;
    for (let r = historyHeaderRow + 1; r <= maxRow; r++) {
      const parts = rowParts(ws, r, startCol, maxCol);
      const c1 = norm(parts[0]);
      const text = uniqueJoin(parts);
      if (!text) continue;

      const yearHit = parseYear(c1) || (!SN_RE.test(c1) && parseYear(text.split(' / ')[0]));
      if (yearHit && (parseYear(c1) || YEAR_RE.test(c1) || parseSeason(c1))) {
        current = yearHit;
        if (!yearHit.labelled) yearOnlyHistory = true;
        const rest = uniqueJoin(parts.slice(1));
        if (!rest) continue;
        const actionMatch = rest.match(ACTION_RE);
        const action = actionMatch ? (norm(actionMatch[2]) || rest) : rest;
        history.push({
          equipmentName,
          season: inferSeasonFromAction(action, current.season),
          year: current.year,
          actionNo: actionMatch ? Number(actionMatch[1]) : history.filter((h) => h.year === current.year).length + 1,
          action,
          labelledSeason: current.labelled,
          sourceRow: r,
        });
        continue;
      }

      if (!current) continue;
      const actionText = uniqueJoin(c1 && !parseYear(c1) ? parts : parts.slice(c1 && SN_RE.test(c1) ? 1 : 0));
      const work = uniqueJoin(parts.filter((p, i) => !(i === 0 && parseYear(norm(p)))));
      const lineText = work || actionText || text;
      const actionMatch = lineText.match(ACTION_RE);
      if (actionMatch) {
        history.push({
          equipmentName,
          season: inferSeasonFromAction(actionMatch[2], current.season),
          year: current.year,
          actionNo: Number(actionMatch[1]),
          action: norm(actionMatch[2]) || lineText,
          labelledSeason: current.labelled,
          sourceRow: r,
        });
        continue;
      }
      if (history.length && history[history.length - 1].year === current.year) {
        const last = history[history.length - 1];
        last.action = `${last.action} ${lineText}`.replace(/\s+/g, ' ').trim();
      } else {
        history.push({
          equipmentName,
          season: inferSeasonFromAction(lineText, current.season),
          year: current.year,
          actionNo: 1,
          action: lineText,
          labelledSeason: current.labelled,
          sourceRow: r,
        });
      }
    }
  }

  if (historyHeaderRow && !history.length) issues.push('YEAR / WORK DONE header found but no actions parsed');
  if (yearOnlyHistory) issues.push('History is year-only (no Off-Season / Season heading); recorded as Off-Season');

  const duty = specs.find((s) => /^duty$/i.test(s.parameter))?.value || '';
  const hs = specs.find((s) => /^heating surface$/i.test(s.parameter));
  const capacity = hs?.value || specs.find((s) => /^capacity$/i.test(s.parameter))?.value || '';
  const years = [...new Set(history.map((h) => h.year))].sort();

  return {
    sheetName: ws.name,
    equipmentName,
    type,
    duty,
    capacity,
    specCount: specs.filter((s) => !s.isSection).length,
    historyCount: history.length,
    emptyValueCount,
    missingSnCount,
    duplicateSnCount,
    shiftedColumns,
    yearOnlyHistory,
    specs,
    history,
    years,
    issues,
    sourceRows: maxRow,
    sourceCols: maxCol,
    headerRow,
    startCol,
    historyHeaderRow,
  };
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HEADER } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
}

function ynCell(row, key, yes) {
  row.getCell(key).value = yes ? 'Yes' : 'No';
  row.getCell(key).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: yes ? FILL_YES : FILL_NO } };
  row.getCell(key).font = { color: { argb: yes ? FONT_YES : FONT_NO }, bold: true };
  row.getCell(key).alignment = { horizontal: 'center' };
}

function warnCell(row, key, text) {
  row.getCell(key).value = text;
  if (!text) return;
  row.getCell(key).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_WARN } };
  row.getCell(key).font = { color: { argb: FONT_WARN } };
}

async function writeExtract(cards) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog extract';
  wb.created = new Date();

  const eqSheet = wb.addWorksheet('Equipment', { views: [{ state: 'frozen', ySplit: 1 }] });
  eqSheet.columns = [
    { header: 'Sr', key: 'sr', width: 8 },
    { header: 'Sheet name', key: 'sheetName', width: 22 },
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Type', key: 'type', width: 28 },
    { header: 'Duty', key: 'duty', width: 28 },
    { header: 'Heating surface / capacity', key: 'capacity', width: 24 },
    { header: 'Spec rows', key: 'specCount', width: 12 },
    { header: 'History actions', key: 'historyCount', width: 16 },
  ];
  cards.forEach((c, i) => {
    eqSheet.addRow({
      sr: i + 1,
      sheetName: c.sheetName,
      equipmentName: c.equipmentName,
      type: c.type,
      duty: c.duty,
      capacity: c.capacity,
      specCount: c.specCount,
      historyCount: c.historyCount,
    });
  });
  styleHeader(eqSheet.getRow(1));

  const specSheet = wb.addWorksheet('Equipment Specification', { views: [{ state: 'frozen', ySplit: 1 }] });
  specSheet.columns = [
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Type', key: 'type', width: 28 },
    { header: 'SN', key: 'sn', width: 8 },
    { header: 'Parameter', key: 'parameter', width: 52 },
    { header: 'UOM', key: 'uom', width: 10 },
    { header: 'Value', key: 'value', width: 42 },
    { header: 'Section header', key: 'isSection', width: 16 },
  ];
  for (const c of cards) {
    for (const s of c.specs) {
      specSheet.addRow({
        equipmentName: s.equipmentName,
        type: c.type,
        sn: s.sn,
        parameter: s.parameter,
        uom: s.uom,
        value: s.value,
        isSection: s.isSection ? 'Yes' : '',
      });
    }
  }
  styleHeader(specSheet.getRow(1));

  const histSheet = wb.addWorksheet('Equipment Maintenance History', { views: [{ state: 'frozen', ySplit: 1 }] });
  histSheet.columns = [
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Type', key: 'type', width: 28 },
    { header: 'Season', key: 'season', width: 14 },
    { header: 'Year', key: 'year', width: 12 },
    { header: 'Action no.', key: 'actionNo', width: 12 },
    { header: 'Action taken', key: 'action', width: 90 },
  ];
  for (const c of cards) {
    for (const h of c.history) {
      histSheet.addRow({
        equipmentName: h.equipmentName,
        type: c.type,
        season: h.season,
        year: h.year,
        actionNo: h.actionNo,
        action: h.action,
      });
    }
  }
  styleHeader(histSheet.getRow(1));

  await wb.xlsx.writeFile(OUT_XLSX);
}

async function writeAudit(cards, src) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog extract audit';
  wb.created = new Date();

  const specRows = cards.reduce((n, c) => n + c.specs.length, 0);
  const histRows = cards.reduce((n, c) => n + c.historyCount, 0);
  const withHist = cards.filter((c) => c.historyCount > 0).length;
  const emptyVal = cards.reduce((n, c) => n + c.emptyValueCount, 0);

  const summary = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  summary.columns = [
    { header: 'Item', key: 'item', width: 42 },
    { header: 'Value', key: 'value', width: 70 },
  ];
  styleHeader(summary.getRow(1));
  const summaryRows = [
    ['Source file', path.basename(src)],
    ['Source path', src],
    ['Extracted at', new Date().toISOString()],
    ['Sheets / equipment cards', String(cards.length)],
    ['Spec rows', String(specRows)],
    ['History actions', String(histRows)],
    ['Equipment with history', String(withHist)],
    ['Equipment specs-only', String(cards.length - withHist)],
    ['Spec rows with empty value', String(emptyVal)],
    ['Season labelling', 'Source uses YEAR / WORK DONE only. Actions recorded as Off-Season unless the text says in-season.'],
    ['Extract workbook', path.basename(OUT_XLSX)],
  ];
  summaryRows.forEach(([item, value]) => summary.addRow({ item, value }));

  const inv = wb.addWorksheet('Sheet inventory', { views: [{ state: 'frozen', ySplit: 1 }] });
  inv.columns = [
    { header: 'Sr', key: 'sr', width: 6 },
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Type', key: 'type', width: 28 },
    { header: 'Specs extracted', key: 'specsYes', width: 16 },
    { header: 'Spec rows', key: 'specCount', width: 12 },
    { header: 'Empty values', key: 'emptyValueCount', width: 14 },
    { header: 'History extracted', key: 'histYes', width: 18 },
    { header: 'History actions', key: 'historyCount', width: 16 },
    { header: 'Years', key: 'years', width: 28 },
    { header: 'Shifted columns', key: 'shifted', width: 16 },
    { header: 'Issues', key: 'issues', width: 70 },
  ];
  styleHeader(inv.getRow(1));
  cards.forEach((c, i) => {
    const row = inv.addRow({
      sr: i + 1,
      sheetName: c.sheetName,
      equipmentName: c.equipmentName,
      type: c.type,
      specCount: c.specCount,
      emptyValueCount: c.emptyValueCount,
      historyCount: c.historyCount,
      years: c.years.join(', '),
      issues: c.issues.join('; '),
    });
    ynCell(row, 'specsYes', c.specCount > 0);
    ynCell(row, 'histYes', c.historyCount > 0);
    row.getCell('shifted').value = c.shiftedColumns ? 'Yes' : 'No';
    row.getCell('shifted').alignment = { horizontal: 'center' };
    if (c.shiftedColumns) {
      row.getCell('shifted').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_WARN } };
      row.getCell('shifted').font = { color: { argb: FONT_WARN }, bold: true };
    } else {
      row.getCell('shifted').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_YES } };
      row.getCell('shifted').font = { color: { argb: FONT_YES }, bold: true };
    }
    if (c.issues.length) warnCell(row, 'issues', c.issues.join('; '));
    if (c.emptyValueCount) {
      row.getCell('emptyValueCount').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_NO } };
      row.getCell('emptyValueCount').font = { color: { argb: FONT_NO }, bold: true };
    }
  });

  const empty = wb.addWorksheet('Empty spec values', { views: [{ state: 'frozen', ySplit: 1 }] });
  empty.columns = [
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Source row', key: 'sourceRow', width: 12 },
    { header: 'SN', key: 'sn', width: 8 },
    { header: 'Parameter', key: 'parameter', width: 52 },
  ];
  styleHeader(empty.getRow(1));
  for (const c of cards) {
    for (const s of c.specs) {
      if (s.value || s.isSection) continue;
      empty.addRow({
        sheetName: c.sheetName,
        equipmentName: c.equipmentName,
        sourceRow: s.sourceRow,
        sn: s.sn,
        parameter: s.parameter,
      });
    }
  }

  const dup = wb.addWorksheet('Duplicate SN', { views: [{ state: 'frozen', ySplit: 1 }] });
  dup.columns = [
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'SN', key: 'sn', width: 8 },
    { header: 'Times used', key: 'times', width: 12 },
    { header: 'Parameters', key: 'parameters', width: 80 },
  ];
  styleHeader(dup.getRow(1));
  for (const c of cards) {
    const map = {};
    for (const s of c.specs) {
      if (!s.sn) continue;
      if (!map[s.sn]) map[s.sn] = [];
      map[s.sn].push(s.parameter);
    }
    for (const [sn, parameters] of Object.entries(map)) {
      if (parameters.length < 2) continue;
      dup.addRow({
        sheetName: c.sheetName,
        equipmentName: c.equipmentName,
        sn,
        times: parameters.length,
        parameters: parameters.join(' | '),
      });
    }
  }

  const missing = wb.addWorksheet('Specs without SN', { views: [{ state: 'frozen', ySplit: 1 }] });
  missing.columns = [
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Source row', key: 'sourceRow', width: 12 },
    { header: 'Parameter', key: 'parameter', width: 44 },
    { header: 'Value', key: 'value', width: 36 },
  ];
  styleHeader(missing.getRow(1));
  for (const c of cards) {
    for (const s of c.specs) {
      if (s.sn) continue;
      missing.addRow({
        sheetName: c.sheetName,
        equipmentName: c.equipmentName,
        sourceRow: s.sourceRow,
        parameter: s.parameter,
        value: s.value,
      });
    }
  }

  const hist = wb.addWorksheet('History by year', { views: [{ state: 'frozen', ySplit: 1 }] });
  hist.columns = [
    { header: 'Year', key: 'year', width: 12 },
    { header: 'Season', key: 'season', width: 14 },
    { header: 'Actions', key: 'actions', width: 12 },
    { header: 'Equipment count', key: 'eq', width: 18 },
  ];
  styleHeader(hist.getRow(1));
  const byYear = {};
  for (const c of cards) {
    for (const h of c.history) {
      const k = `${h.year}|${h.season}`;
      if (!byYear[k]) byYear[k] = { year: h.year, season: h.season, actions: 0, eq: new Set() };
      byYear[k].actions += 1;
      byYear[k].eq.add(c.equipmentName);
    }
  }
  Object.values(byYear)
    .sort((a, b) => String(a.year).localeCompare(String(b.year)) || a.season.localeCompare(b.season))
    .forEach((x) => hist.addRow({ year: x.year, season: x.season, actions: x.actions, eq: x.eq.size }));

  const issuesSheet = wb.addWorksheet('Issues', { views: [{ state: 'frozen', ySplit: 1 }] });
  issuesSheet.columns = [
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 44 },
    { header: 'Issue', key: 'issue', width: 80 },
  ];
  styleHeader(issuesSheet.getRow(1));
  for (const c of cards) {
    for (const issue of c.issues) {
      const row = issuesSheet.addRow({
        sheetName: c.sheetName,
        equipmentName: c.equipmentName,
        issue,
      });
      warnCell(row, 'issue', issue);
    }
  }

  await wb.xlsx.writeFile(OUT_AUDIT);
}

(async () => {
  const SRC = findSource();
  if (!SRC) {
    console.error('Source not found. Tried:');
    SRC_CANDIDATES.forEach((p) => console.error(' ', p));
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const cards = wb.worksheets.map(extractSheet).filter(Boolean);

  await writeExtract(cards);
  await writeAudit(cards, SRC);
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    source: path.basename(SRC),
    sourcePath: SRC,
    extractedAt: new Date().toISOString(),
    equipmentCount: cards.length,
    specCount: cards.reduce((n, c) => n + c.specCount, 0),
    historyCount: cards.reduce((n, c) => n + c.historyCount, 0),
    equipment: cards.map((c) => ({
      sheetName: c.sheetName,
      equipmentName: c.equipmentName,
      type: c.type,
      duty: c.duty,
      capacity: c.capacity,
      specCount: c.specCount,
      historyCount: c.historyCount,
      years: c.years,
      issues: c.issues,
      specs: c.specs.map(({ sourceRow, ...s }) => s),
      history: c.history.map(({ sourceRow, labelledSeason, ...h }) => h),
    })),
  }, null, 2));

  const withHist = cards.filter((c) => c.historyCount > 0).length;
  const seasons = {};
  for (const c of cards) {
    for (const h of c.history) {
      const k = `${h.season} ${h.year}`;
      seasons[k] = (seasons[k] || 0) + 1;
    }
  }
  console.log('Source:', SRC);
  console.log(`Equipment cards: ${cards.length}`);
  console.log(`Spec rows: ${cards.reduce((n, c) => n + c.specs.length, 0)} (parameters ${cards.reduce((n, c) => n + c.specCount, 0)})`);
  console.log(`History actions: ${cards.reduce((n, c) => n + c.historyCount, 0)} across ${withHist} equipment`);
  console.log('By season/year:');
  Object.keys(seasons).sort().forEach((k) => console.log(`  ${k}: ${seasons[k]}`));
  console.log('Wrote', OUT_XLSX);
  console.log('Wrote', OUT_JSON);
  console.log('Wrote', OUT_AUDIT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
