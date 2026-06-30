/**
 * Parse legacy Power Plant equipment Excel workbooks (one sheet = one equipment).
 * Expected layout (approximate):
 *   Row 3–5: location, equip_no, commissioned (column E)
 *   Section "EQUIPMENT SPECIFICATION" → label col B, value col E
 *   Section "MAINTENANCE SCHEDULE" → OEM rows
 *   Section "MAINTENANCE HISTORY" / "EQUIPMENT MAINTENANCE" → history rows
 */

const xlsx = require('xlsx');
const { enrichEquipment } = require('./powerEquipmentClassification');

const SPEC_SECTIONS = ['mechanical', 'civil', 'instrument', 'electrical'];
const META_SUBSECTIONS_LBL = '__subsections__';

const DEFAULT_FILES = [
  { file: 'File for Electrical.xlsx', dept: 'electrical' },
  { file: 'File for Instrument.xlsx', dept: 'instrument' },
  { file: 'File for Instrument_2.xlsx', dept: 'instrument2' },
];

function getCell(ws, row, col) {
  const ref = xlsx.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[ref];
  if (!cell || cell.v == null) return '';
  if (cell.t === 'd' && cell.v instanceof Date) {
    const y = cell.v.getFullYear();
    const m = String(cell.v.getMonth() + 1).padStart(2, '0');
    const d = String(cell.v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(cell.v).trim();
}

function findRowContains(ws, text, startRow = 1) {
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  const needle = text.toLowerCase();

  for (let r = Math.max(range.s.r + 1, startRow); r <= range.e.r + 1; r++) {
    for (let c = range.s.c + 1; c <= range.e.c + 1; c++) {
      const val = getCell(ws, r, c);
      if (val && val.toLowerCase().includes(needle)) return r;
    }
  }
  return -1;
}

function normalizeSectionHeader(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t.includes('mechanical') || t === '1. mechanical') return 'mechanical';
  if (t.includes('civil') || t === '2. civil') return 'civil';
  if (t.includes('instrument') || t === '3. instrument') return 'instrument';
  if (t.includes('electrical') || t === '4. electrical') return 'electrical';
  return null;
}

function isValidYmd(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function toIsoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Excel 1900 date serial → YYYY-MM-DD (UTC). */
function excelSerialToIso(serial) {
  const n = Math.round(Number(serial));
  if (!Number.isFinite(n) || n < 1) return null;
  const date = new Date(Math.round((n - 25569) * 86400 * 1000));
  if (Number.isNaN(date.getTime())) return null;
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseExcelDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}$/.test(s)) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return isValidYmd(y, m, d) ? s : null;
  }

  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dot) {
    const y = Number(dot[3]);
    const m = Number(dot[2]);
    const d = Number(dot[1]);
    return isValidYmd(y, m, d) ? toIsoDate(y, m, d) : null;
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const y = Number(slash[3]);
    const m = Number(slash[2]);
    const d = Number(slash[1]);
    return isValidYmd(y, m, d) ? toIsoDate(y, m, d) : null;
  }

  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const n = Math.round(Number(s));
    if (n >= 10000 && n < 100000) return excelSerialToIso(n);
  }

  return null;
}

/** History "Year" column may hold a calendar year, a date, or an Excel serial. */
function parseYearOrDateCell(val) {
  if (!val) return { year: null, date_start: null };
  const s = String(val).trim();

  if (/^\d{4}$/.test(s)) {
    return { year: s, date_start: null };
  }

  const iso = parseExcelDate(s);
  if (iso) {
    return { year: iso.slice(0, 4), date_start: iso };
  }

  if (s.length <= 50) return { year: s, date_start: null };
  return { year: null, date_start: null };
}

function parseCommissionedDate(val) {
  if (!val) return null;
  const iso = parseExcelDate(val);
  return iso || String(val).trim() || null;
}

function normalizeSeason(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/off\s*season/i.test(s)) return 'Off-Season';
  if (/^season$/i.test(s) || (/season/i.test(s) && !/off/i.test(s))) return 'Season';
  return s.length <= 20 ? s : s.slice(0, 20);
}

function normalizeSvc(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (s.length <= 20) return s;
  if (/internal/i.test(s)) return 'Internal';
  if (/external/i.test(s)) return 'External';
  return s.slice(0, 20);
}

/** Life-history header values are usually in column H (8); older sheets use E (5). */
function getLifeHistoryValue(ws, row) {
  return getCell(ws, row, 8) || getCell(ws, row, 5);
}

function parseLifeHistoryMeta(ws) {
  const meta = {
    name: null,
    location: null,
    equip_no: null,
    tag_name: null,
    commissioned: null,
  };

  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  const endRow = Math.min(range.e.r + 1, 30);

  for (let r = 1; r <= endRow; r++) {
    const label = getCell(ws, r, 2).toUpperCase();
    const val = getLifeHistoryValue(ws, r);
    if (!label || !val) continue;

    if (label.includes('NAME OF EQUIPMENT')) meta.name = val;
    else if (label.includes('LOCATION')) meta.location = val;
    else if (label.includes('EQUIPMENT NO') && !label.includes('TAG')) meta.equip_no = val;
    else if (label.includes('EQUIPMENT TAG NAME') || label.startsWith('TAG NO') || label === 'TAG NAME') {
      meta.tag_name = val;
    } else if (label.includes('DATE OF COMMISSIONING')) {
      meta.commissioned = parseCommissionedDate(val);
    }
  }

  if (!meta.equip_no && !meta.tag_name) {
    const row4 = getLifeHistoryValue(ws, 4);
    if (row4) meta.equip_no = row4;
  }

  return meta;
}

function emptyToNull(v) {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
}

function parseSpecs(ws, specStart, specEnd) {
  const specs = [];
  const subSections = {
    mechanical: ['General'],
    civil: [],
    instrument: [],
    electrical: [],
  };
  let currentSection = 'mechanical';
  let currentSub = 'General';

  for (let r = specStart + 1; r < specEnd; r++) {
    const colB = getCell(ws, r, 2);
    const colC = getCell(ws, r, 3);
    const label = getCell(ws, r, 2) || getCell(ws, r, 3);
    const value = getCell(ws, r, 5) || getCell(ws, r, 4);

    const sectionHit = normalizeSectionHeader(colB) || normalizeSectionHeader(colC);
    if (sectionHit && !value) {
      currentSection = sectionHit;
      continue;
    }

    const subCandidate = getCell(ws, r, 3);
    if (!value && subCandidate && !normalizeSectionHeader(subCandidate)) {
      currentSub = subCandidate;
      if (!subSections[currentSection].includes(currentSub)) {
        if (subSections[currentSection].length < 20) {
          subSections[currentSection].push(currentSub);
        }
      }
      continue;
    }

    if (!label && !value) continue;

    if (!subSections[currentSection].includes(currentSub)) {
      if (subSections[currentSection].length < 20) {
        subSections[currentSection].push(currentSub);
      } else {
        currentSub = subSections[currentSection][0] || 'General';
      }
    }

    specs.push({
      section: currentSection,
      sub_section: currentSub,
      lbl: label,
      val: value,
    });
  }

  for (const sec of SPEC_SECTIONS) {
    if (!subSections[sec].length) subSections[sec] = ['General'];
  }

  specs.push({
    section: null,
    sub_section: null,
    lbl: META_SUBSECTIONS_LBL,
    val: JSON.stringify(subSections),
  });

  return specs.filter((s) => s.lbl === META_SUBSECTIONS_LBL || s.lbl || s.val);
}

function parseSchedule(ws, scheduleStart, scheduleEnd) {
  const scheduleRows = [];
  const end = scheduleEnd > 0 ? scheduleEnd : scheduleStart + 80;

  for (let r = scheduleStart + 2; r < end; r++) {
    const no = getCell(ws, r, 2);
    const comp = getCell(ws, r, 3);
    const act = getCell(ws, r, 4);

    if (!no && !comp && !act) {
      if (scheduleRows.length > 0) break;
      continue;
    }

    scheduleRows.push({
      no: Number(no) || scheduleRows.length + 1,
      comp,
      act,
      iv_W: getCell(ws, r, 6) ? '√' : null,
      iv_M: getCell(ws, r, 7) ? '√' : null,
      iv_Q: getCell(ws, r, 8) ? '√' : null,
      iv_H: getCell(ws, r, 9) ? '√' : null,
      iv_Y: getCell(ws, r, 10) ? '√' : null,
      iv_T: getCell(ws, r, 11) ? '√' : null,
      iv_3Y: getCell(ws, r, 12) ? '√' : null,
    });
  }

  return scheduleRows;
}

function parseHistory(ws, historyStart) {
  const historyRows = [];
  if (historyStart === -1) return historyRows;

  const headerRow = historyStart + 1;
  let dataStart = headerRow + 1;
  const h2 = getCell(ws, headerRow, 2).toLowerCase();
  if (h2.includes('season') || h2.includes('year') || h2.includes('observation')) {
    dataStart = headerRow + 1;
  } else {
    dataStart = historyStart + 2;
  }

  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = dataStart; r <= range.e.r + 1; r++) {
    const seasonRaw = getCell(ws, r, 2);
    const yearCell = getCell(ws, r, 4);
    const obs = getCell(ws, r, 5);
    const act = getCell(ws, r, 7);
    const cost = getCell(ws, r, 10);
    const svc = getCell(ws, r, 11);
    const resp = getCell(ws, r, 12);
    const rem = getCell(ws, r, 13);

    if (!seasonRaw && !yearCell && !obs && act && historyRows.length > 0) {
      const prev = historyRows[historyRows.length - 1];
      prev.act = prev.act ? `${prev.act}\n${act}` : act;
      continue;
    }

    if (!seasonRaw && !yearCell && !obs && !act) {
      if (historyRows.length > 0) break;
      continue;
    }

    const { year, date_start: dateStart } = parseYearOrDateCell(yearCell);

    historyRows.push({
      season: normalizeSeason(seasonRaw),
      year: emptyToNull(year),
      date_start: dateStart,
      date_finish: null,
      obs: emptyToNull(obs),
      act: emptyToNull(act),
      cost: emptyToNull(cost),
      svc: normalizeSvc(svc),
      provider: null,
      resp: emptyToNull(resp),
      rem: emptyToNull(rem),
    });
  }

  return historyRows;
}

function parseSheet(ws, sheetName, dept) {
  const meta = parseLifeHistoryMeta(ws);
  const equipment = enrichEquipment({
    dept,
    name: (meta.name || sheetName).trim(),
    equip_no: emptyToNull(meta.equip_no),
    tag_name: emptyToNull(meta.tag_name),
    location: emptyToNull(meta.location),
    commissioned: emptyToNull(meta.commissioned),
  });

  const specStart = findRowContains(ws, 'EQUIPMENT SPECIFICATION');
  const scheduleStart = findRowContains(ws, 'MAINTENANCE SCHEDULE');
  const historyStart =
    findRowContains(ws, 'EQUIPMENT MAINTENANCE HISTORY')
    || findRowContains(ws, 'MAINTENANCE HISTORY')
    || findRowContains(ws, 'EQUIPMENT MAINTENANCE');

  const specEnd = scheduleStart !== -1 ? scheduleStart : (historyStart !== -1 ? historyStart : specStart + 200);
  const scheduleEnd = historyStart !== -1 ? historyStart : scheduleStart + 80;

  const specs = specStart !== -1 ? parseSpecs(ws, specStart, specEnd) : [];
  const scheduleRows = scheduleStart !== -1
    ? parseSchedule(ws, scheduleStart, scheduleEnd)
    : [];
  const historyRows = parseHistory(ws, historyStart);

  return { equipment, specs, scheduleRows, historyRows };
}

function shouldSkipSheet(sheetName) {
  const n = sheetName.toLowerCase();
  return n.includes('index') || n.includes('summary') || n.includes('instruction');
}

function parseWorkbookFile(filePath, dept) {
  const workbook = xlsx.readFile(filePath);
  const sheets = [];

  for (const sheetName of workbook.SheetNames) {
    if (shouldSkipSheet(sheetName)) continue;
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;
    sheets.push({
      sheetName,
      ...parseSheet(ws, sheetName, dept),
    });
  }

  return sheets;
}

module.exports = {
  DEFAULT_FILES,
  META_SUBSECTIONS_LBL,
  parseWorkbookFile,
  parseSheet,
  getCell,
  findRowContains,
};
