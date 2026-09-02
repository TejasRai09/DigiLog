/**
 * Extract Production House clarification specs + maintenance actions
 * from DS clarification  history record_4.xlsx
 *
 * Usage (from backend/):
 *   node scripts/extract-clarification-history.js
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const SRC_CANDIDATES = [
  path.join('C:', 'vivek', 'PLANT', 'DS clarification  history record_4.xlsx'),
  path.join('C:', 'vivek', 'PLANT', 'production equipments hisotoru files', 'DS clarification  history record_4.xlsx'),
];
const OUT_DIR = path.join(__dirname, '..', 'backlog-data', 'production-equipments');
const OUT_XLSX = path.join(OUT_DIR, 'ds-clarification-equipment-history.xlsx');
const OUT_JSON = path.join(OUT_DIR, 'ds-clarification-equipment-history.json');
const OUT_AUDIT = path.join(OUT_DIR, 'ds-clarification-extract-audit.xlsx');

const YEAR_WORK_RE = /^(year|work\s*done|work)$/i;
const GENERIC_HEADER_RE = /^(particulars?|details|work\s*done|work)$/i;
const SN_HEADER_RE = /^(sr\.?\s*n\.?o?|s\.?\s*n\.?o?|sn)$/i;
const OFF_SEASON_LABEL_RE = /^off\s*se[as]+on$/i;
const SEASON_WORK_HEADER_RE = /^season$/i;
const SEASON_RE = /^(OFF\s*SE[AS]+ON|SE[AS]+ON)[\s\-.:]*(\d{4}(?:\s*[-–\/]\s*\d{2,4})?)\s*$/i;
const YEAR_RE = /^(\d{4})\s*[-–\/]?\s*(\d{2,4})?\s*$/;
const ACTION_RE = /^(\d+)\s*[\.\)]\s*(.*)$/;
const SN_RE = /^(?:\d{1,2}|[a-d])$/i;
const DIM_RE = /^\d+([.,]\d+)?\s*(mm|mtr|m2|kg|cm|''|"|φ|dia)?$/i;

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
    if (v.getMonth() === 0 && v.getDate() === 1) return String(y);
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
  if (n.includes('air blower') || n.includes('air comp')) return 'Air blower';
  if (n.includes('air drier') || n.includes('air dryer')) return 'Air drier';
  if (n.includes('sulphur furnace') || /^sf\d/i.test(sheetName)) return 'Sulphur furnace';
  if (n.includes('juice sulphiter') || /^js\d/i.test(sheetName)) return 'Juice sulphiter';
  if (n.includes('syrup sulphiter') || /^ss /i.test(sheetName)) return 'Syrup sulphiter';
  if (n.includes('milk of lime') || sheetName === 'MOL') return 'Milk of lime';
  if (n.includes('mud tank')) return 'Mud tank';
  if (n.includes('clarifier') || sheetName === 'Dorr') return 'Clarifier';
  if (/\brvf\b/.test(n) && n.includes('bagacillo')) return 'Bagacillo blower';
  if (/\brvf\b/.test(n) || /^rvf/i.test(sheetName)) return 'Rotary vacuum filter';
  if (n.includes('filtrate')) return 'Filtrate tank';
  if (n.includes('vacuum pump') || n.includes('vac.pump')) return 'Vacuum pump';
  if (n.includes('cake wash')) return 'Cake wash pump';
  if (n.includes('bagacillo')) return 'Bagacillo blower';
  if (n.includes('decanter') || n.includes('mud removal') || sheetName === 'MRS') return 'Decanter';
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
  let m = t.match(YEAR_RE);
  if (!m) m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) m = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!m) return null;
  if (m[3] && m[3].length === 4 && t.match(/[./]/)) {
    const year = m[0].match(/^(\d{4})/) ? m[1] : m[3];
    return { season: 'Off-Season', year, labelled: false };
  }
  const y1 = m[1];
  const y2 = m[2] || '';
  if (y1.length !== 4) return null;
  const year = y2 && y2.length >= 2 && y2 !== '-' && Number(y2) <= 99 ? `${y1}-${y2}` : y1;
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

function titleFromSheet(ws, headerRow, startCol, maxCol) {
  for (let r = 1; r <= headerRow; r++) {
    const parts = [];
    for (let c = startCol; c <= Math.min(maxCol, startCol + 2); c++) {
      parts.push(cellText(ws.getRow(r).getCell(c)));
    }
    const t = uniqueJoin(parts);
    if (!t) continue;
    if (SN_HEADER_RE.test(t) || GENERIC_HEADER_RE.test(t)) continue;
    if (/particular/i.test(t) && /details/i.test(t)) continue;
    return t;
  }
  return ws.name;
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

function isSpecHeader(c1, c2) {
  return SN_HEADER_RE.test(c1) && /particular/i.test(c2);
}

function isHistoryHeader(c1, c2, line) {
  if (OFF_SEASON_LABEL_RE.test(c1) && (!c2 || OFF_SEASON_LABEL_RE.test(c2))) return true;
  if (c1.toLowerCase() === 'year' && /work/i.test(c2 || '')) return true;
  if (SEASON_WORK_HEADER_RE.test(c1) && YEAR_WORK_RE.test(c2)) return true;
  if (/jobs\s+done\s+during/i.test(line)) return true;
  return false;
}

function looksLikeEquipmentTitle(text) {
  const t = norm(text);
  if (!t || t.length < 6 || ACTION_RE.test(t) || DIM_RE.test(t)) return false;
  if (GENERIC_HEADER_RE.test(t) || YEAR_WORK_RE.test(t) || OFF_SEASON_LABEL_RE.test(t)) return false;
  if (/^(make|type|capacity|head|rpm|model|size|dia|length|width|height|volume|bearing|motor hp|effective rpm|chain detail|tyre coupling)\b/i.test(t)) {
    return false;
  }
  if (/\b(pump|tank|drive|boiler|slaker|clarifier|furnace|conveyor|decanter|blower|filter|heater|compressor|drier|stirrer|receiver|whrs?)\b/i.test(t)) {
    return true;
  }
  if (/\bno[.\s-]?\s*\d/i.test(t)) return true;
  if (/^[A-Z0-9][A-Z0-9 /().'\-]{11,}$/.test(t) && /[A-Z]{3,}/.test(t)) return true;
  return false;
}

function isSectionTitle(c1, c2, c3) {
  if (SN_RE.test(c1) || parseYear(c1) || SN_HEADER_RE.test(c1) || YEAR_WORK_RE.test(c1)) return false;
  if (c1 && (OFF_SEASON_LABEL_RE.test(c1) || SEASON_WORK_HEADER_RE.test(c1))) return false;
  const title = c1 && (!c2 || c1.toLowerCase() === c2.toLowerCase()) ? c1 : (!c1 ? c2 : '');
  if (!title) return false;
  if (c3 && c1 && title.toLowerCase() !== c3.toLowerCase()) return false;
  return looksLikeEquipmentTitle(title);
}

function qualify(section, parent, parameter, equipmentName) {
  const bits = [];
  if (section && (!equipmentName || section.toLowerCase() !== equipmentName.toLowerCase())) bits.push(section);
  if (parent && parent.toLowerCase() !== parameter.toLowerCase()) bits.push(parent);
  bits.push(parameter);
  const out = [];
  for (const b of bits) {
    if (!out.length || out[out.length - 1].toLowerCase() !== b.toLowerCase()) out.push(b);
  }
  return out.join(' — ');
}

function emptyCard(ws, extra) {
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
    issues: extra.issues || ['Empty sheet'],
    sourceRows: extra.maxRow || 0,
    sourceCols: extra.maxCol || 0,
  };
}

function extractSheet(ws) {
  const { maxRow, maxCol } = sheetBounds(ws);
  const issues = [];
  if (!maxRow) return emptyCard(ws, { maxRow, maxCol });

  const headerRow = findHeaderRow(ws, maxRow, maxCol);
  const startCol = detectStartCol(ws, headerRow, maxCol);
  const rightTableCol = findRightTableStartCol(ws, headerRow, startCol, maxCol);
  const shiftedColumns = startCol > 1;
  const equipmentName = titleFromSheet(ws, headerRow, startCol, maxCol) || ws.name;
  const type = classifyType(ws.name, equipmentName);
  if (shiftedColumns) issues.push(`Spec table starts at column ${startCol}`);
  if (rightTableCol) issues.push(`Right-hand table from column ${rightTableCol} ignored (calc / diagram)`);
  else if (maxCol > 6) issues.push(`Sheet has extra columns (${maxCol}); diagram / duplicate work cells ignored`);

  const specs = [];
  const history = [];
  let mode = 'specs';
  let currentYear = null;
  let yearOnlyHistory = false;
  let section = '';
  let parent = '';
  let parentSn = '';
  let skippedDiagram = 0;

  const pushHistory = (yearHit, actionText, r) => {
    if (!actionText) return;
    const actionMatch = actionText.match(ACTION_RE);
    const action = actionMatch ? (norm(actionMatch[2]) || actionText) : actionText;
    history.push({
      equipmentName,
      season: inferSeasonFromAction(action, yearHit.season),
      year: yearHit.year,
      actionNo: actionMatch ? Number(actionMatch[1]) : history.filter((h) => h.year === yearHit.year).length + 1,
      action,
      labelledSeason: yearHit.labelled,
      sourceRow: r,
    });
  };

  for (let r = 1; r <= maxRow; r++) {
    const c1 = norm(cellText(ws.getRow(r).getCell(startCol)));
    const c2 = norm(cellText(ws.getRow(r).getCell(startCol + 1)));
    const c3 = norm(cellText(ws.getRow(r).getCell(startCol + 2)));
    const line = uniqueJoin([c1, c2, c3]);
    if (!line) continue;
    if (isSpecHeader(c1, c2)) {
      mode = 'specs';
      continue;
    }
    if (isHistoryHeader(c1, c2, line)) {
      mode = 'history';
      currentYear = null;
      continue;
    }

    const sectionName = c1 || c2;
    const farText = (() => {
      const parts = [];
      for (let c = startCol + 4; c <= Math.min(maxCol, startCol + 9); c++) {
        parts.push(cellText(ws.getRow(r).getCell(c)));
      }
      return uniqueJoin(parts);
    })();

    if (mode === 'history') {
      const yearHit = parseYear(c1);
      if (yearHit) {
        currentYear = yearHit;
        if (!yearHit.labelled) yearOnlyHistory = true;
        pushHistory(currentYear, uniqueJoin([c2, c3]), r);
        continue;
      }
      if (currentYear && (ACTION_RE.test(c2) || ACTION_RE.test(uniqueJoin([c2, c3])))) {
        pushHistory(currentYear, uniqueJoin([c2, c3]), r);
        continue;
      }
      if (isSectionTitle(c1, c2, c3) || (SN_RE.test(c1) && c2) || looksLikeEquipmentTitle(c1 || c2)) {
        mode = 'specs';
      } else {
        if (currentYear && c2 && !SN_RE.test(c1) && !parseYear(c1)) {
          pushHistory(currentYear, uniqueJoin([c2, c3]) || line, r);
          continue;
        }
        continue;
      }
    }

    if (!c1 && !c2 && c3) {
      if (specs.length && !specs[specs.length - 1].isSection && r - specs[specs.length - 1].sourceRow <= 4) {
        const last = specs[specs.length - 1];
        last.value = `${last.value} ${c3}`.replace(/\s+/g, ' ').trim();
      }
      continue;
    }

    if (farText && !c1 && !c2) {
      skippedDiagram += 1;
      continue;
    }

    if (isSectionTitle(c1, c2, c3) || (!c1 && c2 && !c3 && looksLikeEquipmentTitle(c2))) {
      const title = c1 || c2;
      if (title.toLowerCase() === equipmentName.toLowerCase()) continue;
      section = title;
      parent = '';
      parentSn = '';
      specs.push({
        equipmentName,
        sn: '',
        parameter: title,
        uom: '',
        value: '',
        isSection: true,
        sourceRow: r,
      });
      continue;
    }

    if ((!c1 || DIM_RE.test(c1)) && (!c2 || DIM_RE.test(c2)) && c1 && DIM_RE.test(c1)) {
      skippedDiagram += 1;
      continue;
    }
    if (!c1 && !c2) {
      skippedDiagram += 1;
      continue;
    }
    if (!c1 && c2 && DIM_RE.test(c2)) {
      skippedDiagram += 1;
      continue;
    }
    if (SN_RE.test(c1) && !c2 && !c3) continue;

    let parameter = '';
    let value = '';

    if (SN_RE.test(c1) && c2) {
      value = c3;
      if (/^[a-d]$/i.test(c1)) {
        parameter = qualify(section, parent, c2, equipmentName);
      } else {
        parent = c2;
        parentSn = c1;
        parameter = qualify(section, '', c2, equipmentName);
      }
    } else if (!c1 && c2) {
      parameter = qualify(section, parent, c2, equipmentName);
      value = c3;
    } else if (c1 && !SN_RE.test(c1) && !parseYear(c1)) {
      skippedDiagram += 1;
      continue;
    } else {
      continue;
    }

    specs.push({
      equipmentName,
      sn: SN_RE.test(c1) ? c1 : '',
      parameter,
      uom: '',
      value,
      isSection: false,
      sourceRow: r,
    });
  }

  if (skippedDiagram) issues.push(`${skippedDiagram} diagram / stray cell row(s) skipped`);
  if (!history.length) issues.push('No YEAR / WORK DONE / OFF SEASON block');
  if (yearOnlyHistory) issues.push('History is year-only or Off-Season block without per-year season label; recorded as Off-Season');

  const snCounts = {};
  for (const s of specs) {
    if (!s.sn || s.isSection) continue;
    const key = `${section}|${s.sn}`;
    snCounts[s.sn] = (snCounts[s.sn] || 0) + 1;
  }
  const duplicateSnCount = Object.values(snCounts).filter((n) => n > 1).length;
  const missingSnCount = specs.filter((s) => !s.sn && !s.isSection).length;
  const emptyValueCount = specs.filter((s) => !s.value && !s.isSection).length;
  if (duplicateSnCount) issues.push(`${duplicateSnCount} SN value(s) used on more than one spec row`);
  if (missingSnCount) issues.push(`${missingSnCount} spec row(s) without SN`);
  if (emptyValueCount) issues.push(`${emptyValueCount} spec row(s) with empty value`);

  const duty = specs.find((s) => /(^|— )(application|duty)$/i.test(s.parameter))?.value || '';
  const cap = specs.find((s) => /(^|— )capacity( kg\/hr)?$/i.test(s.parameter));
  const capacity = cap?.value || '';
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
    { header: 'Sheet name', key: 'sheetName', width: 20 },
    { header: 'Equipment', key: 'equipmentName', width: 52 },
    { header: 'Type', key: 'type', width: 24 },
    { header: 'Duty / application', key: 'duty', width: 22 },
    { header: 'Capacity', key: 'capacity', width: 16 },
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
    { header: 'Equipment', key: 'equipmentName', width: 52 },
    { header: 'Type', key: 'type', width: 24 },
    { header: 'SN', key: 'sn', width: 8 },
    { header: 'Parameter', key: 'parameter', width: 64 },
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
    { header: 'Equipment', key: 'equipmentName', width: 52 },
    { header: 'Type', key: 'type', width: 24 },
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
    { header: 'Value', key: 'value', width: 80 },
  ];
  styleHeader(summary.getRow(1));
  [
    ['Source file', path.basename(src)],
    ['Source path', src],
    ['Extracted at', new Date().toISOString()],
    ['Sheets / equipment cards', String(cards.length)],
    ['Spec rows', String(specRows)],
    ['History actions', String(histRows)],
    ['Equipment with history', String(withHist)],
    ['Equipment specs-only', String(cards.length - withHist)],
    ['Spec rows with empty value', String(emptyVal)],
    ['Season labelling', 'OFF SEASON / YEAR / WORK DONE blocks. Actions recorded as Off-Season unless the text says in-season.'],
    ['Sub-equipment', 'Section titles (pumps, tanks, drives) prefixed onto parameter names. One card per source sheet.'],
    ['Extract workbook', path.basename(OUT_XLSX)],
  ].forEach(([item, value]) => summary.addRow({ item, value }));

  const inv = wb.addWorksheet('Sheet inventory', { views: [{ state: 'frozen', ySplit: 1 }] });
  inv.columns = [
    { header: 'Sr', key: 'sr', width: 6 },
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 52 },
    { header: 'Type', key: 'type', width: 24 },
    { header: 'Specs extracted', key: 'specsYes', width: 16 },
    { header: 'Spec rows', key: 'specCount', width: 12 },
    { header: 'Empty values', key: 'emptyValueCount', width: 14 },
    { header: 'History extracted', key: 'histYes', width: 18 },
    { header: 'History actions', key: 'historyCount', width: 16 },
    { header: 'Years', key: 'years', width: 28 },
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
    if (c.issues.length) warnCell(row, 'issues', c.issues.join('; '));
    if (c.emptyValueCount) {
      row.getCell('emptyValueCount').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_NO } };
      row.getCell('emptyValueCount').font = { color: { argb: FONT_NO }, bold: true };
    }
  });

  const empty = wb.addWorksheet('Empty spec values', { views: [{ state: 'frozen', ySplit: 1 }] });
  empty.columns = [
    { header: 'Sheet', key: 'sheetName', width: 18 },
    { header: 'Equipment', key: 'equipmentName', width: 52 },
    { header: 'Source row', key: 'sourceRow', width: 12 },
    { header: 'SN', key: 'sn', width: 8 },
    { header: 'Parameter', key: 'parameter', width: 64 },
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
    { header: 'Equipment', key: 'equipmentName', width: 52 },
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
    { header: 'Equipment', key: 'equipmentName', width: 52 },
    { header: 'Source row', key: 'sourceRow', width: 12 },
    { header: 'Parameter', key: 'parameter', width: 64 },
    { header: 'Value', key: 'value', width: 36 },
  ];
  styleHeader(missing.getRow(1));
  for (const c of cards) {
    for (const s of c.specs) {
      if (s.sn || s.isSection) continue;
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
    { header: 'Equipment', key: 'equipmentName', width: 52 },
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
