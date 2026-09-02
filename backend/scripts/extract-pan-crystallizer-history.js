/**
 * Extract Production House pan & crystallizer specs + maintenance actions
 * from DS PAN & CRYSTALLIZER HISTORY RECORD_1.xlsx
 *
 * Usage (from backend/):
 *   node scripts/extract-pan-crystallizer-history.js
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const SRC = path.join(
  'C:',
  'vivek',
  'PLANT',
  'production equipments hisotoru files',
  'DS PAN & CRYSTALLIZER HISTORY RECORD_1.xlsx',
);
const OUT_DIR = path.join(__dirname, '..', 'backlog-data', 'production-equipments');
const OUT_XLSX = path.join(OUT_DIR, 'ds-pan-crystallizer-equipment-history.xlsx');
const OUT_JSON = path.join(OUT_DIR, 'ds-pan-crystallizer-equipment-history.json');

const UOM_RE = /^(TON|TON\/HR|MM|M2|M3|M2\/M3|NOS|KW|NB|M3\/HR|M2\/M3)$/i;
const JOBS_HEADER_RE = /JOBS\s+DONE\s+DURING/i;
const SEASON_RE = /^(OFF\s*SE[AS]+ON|SE[AS]+ON)[\s\-.:]*(\d{4}(?:\s*[-–\/]\s*\d{2,4})?)\s*$/i;
const ACTION_RE = /^(\d+)\s*[\.\)]\s*(.*)$/;
const SN_RE = /^\d+$/;

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

function classifyType(name) {
  const n = name.toLowerCase();
  if (n.includes('conditioner')) return 'Molasses conditioner';
  if (n.includes('storage') || n.includes('tank')) return 'Storage tank';
  if (n.includes('crystallizer')) return 'Crystallizer';
  if (n.includes('pan')) return 'Pan';
  return 'Equipment';
}

function detectStartCol(ws, headerRow, maxCol) {
  for (let c = 1; c <= Math.min(maxCol, 4); c++) {
    const t = norm(cellText(ws.getRow(headerRow).getCell(c))).toLowerCase();
    if (t === 'sn' || t === 's.n' || t === 's.no') return c;
  }
  return 1;
}

function findRightTableStartCol(ws, headerRow, startCol, maxCol) {
  const snH = /^(sn|s\.n|s\.no|sr\.?\s*n\.?o?)$/i;
  for (let r = 1; r <= Math.min(headerRow + 6, ws.rowCount || headerRow); r++) {
    for (let c = startCol + 4; c <= maxCol; c++) {
      if (snH.test(norm(cellText(ws.getRow(r).getCell(c))))) return c;
    }
  }
  return null;
}

function findHeaderRow(ws, maxRow, maxCol) {
  for (let r = 1; r <= Math.min(maxRow, 8); r++) {
    const texts = [];
    for (let c = 1; c <= Math.min(maxCol, 10); c++) {
      texts.push(norm(cellText(ws.getRow(r).getCell(c))).toLowerCase());
    }
    const joined = texts.join(' | ');
    if (
      texts.some((t) => t === 'sn') &&
      texts.some((t) => t.includes('particular') || t.includes('equipment name') || t.includes('partricular'))
    ) {
      return r;
    }
    if (texts.some((t) => t.includes('no of tank') || t.includes('dia(mm)') || t.includes('hight'))) {
      return r;
    }
    if (joined.includes('sn') && joined.includes('uom')) return r;
  }
  return 2;
}

function titleFromSheet(ws, headerRow, maxCol) {
  for (let r = 1; r < headerRow; r++) {
    const parts = [];
    for (let c = 1; c <= Math.min(maxCol, 8); c++) {
      parts.push(cellText(ws.getRow(r).getCell(c)));
    }
    const t = uniqueJoin(parts);
    if (t && !/^sn\b/i.test(t)) return t;
  }
  return ws.name;
}

function parseSeason(text) {
  const m = norm(text).match(SEASON_RE);
  if (!m) return null;
  const kind = /off/i.test(m[1]) ? 'Off-Season' : 'Season';
  return { season: kind, year: m[2].replace(/\s+/g, '') };
}

function splitUomValue(c3, c4) {
  const a = norm(c3);
  const b = norm(c4);
  if (!a && !b) return { uom: '', value: '' };
  if (a && b && a.toLowerCase() === b.toLowerCase()) {
    if (UOM_RE.test(a)) return { uom: a, value: '' };
    return { uom: '', value: a };
  }
  if (a && UOM_RE.test(a)) return { uom: a, value: b };
  if (!b) return { uom: '', value: a };
  if (!a) return { uom: '', value: b };
  return { uom: a, value: b };
}

function isWideTable(headerTexts) {
  const h = headerTexts.map((t) => t.toLowerCase()).join(' ');
  return h.includes('no of tank') || h.includes('dia(mm)') || h.includes('hight') || h.includes('capacity(m3)');
}

function extractWideTable(ws, headerRow, startCol, maxRow, maxCol, equipmentName) {
  const headers = [];
  for (let c = startCol; c <= maxCol; c++) {
    headers.push(norm(cellText(ws.getRow(headerRow).getCell(c))));
  }
  const specs = [];
  for (let r = headerRow + 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const vals = headers.map((_, i) => norm(cellText(row.getCell(startCol + i))));
    if (!vals.some(Boolean)) continue;
    const first = vals[0];
    if (JOBS_HEADER_RE.test(first) || parseSeason(first)) break;
    const sn = SN_RE.test(first) ? first : '';
    const itemName = sn ? vals[1] : first;
    if (!itemName) continue;
    for (let i = sn ? 2 : 1; i < headers.length; i++) {
      const label = headers[i];
      if (!label || /^sn$/i.test(label) || /particular/i.test(label)) continue;
      specs.push({
        equipmentName,
        sn,
        parameter: `${itemName} — ${label}`,
        uom: '',
        value: vals[i] || '',
        isSection: false,
      });
    }
  }
  return specs;
}

function extractSheet(ws) {
  const maxRow = ws.actualRowCount || ws.rowCount || 0;
  const maxCol = Math.max(ws.actualColumnCount || ws.columnCount || 4, 4);
  if (!maxRow) return null;

  const headerRow = findHeaderRow(ws, maxRow, maxCol);
  const startCol = detectStartCol(ws, headerRow, maxCol);
  const rightTableCol = findRightTableStartCol(ws, headerRow, startCol, maxCol);
  const specMaxCol = rightTableCol ? rightTableCol - 1 : maxCol;
  const equipmentName = titleFromSheet(ws, headerRow, maxCol) || ws.name;

  const headerTexts = [];
  for (let c = startCol; c <= Math.min(specMaxCol, startCol + 12); c++) {
    headerTexts.push(norm(cellText(ws.getRow(headerRow).getCell(c))));
  }

  const compartments = [];
  const titleRow = ws.getRow(Math.max(1, headerRow - 1));
  for (let c = startCol + 4; c <= specMaxCol; c++) {
    const h = norm(cellText(titleRow.getCell(c)));
    if (/compartment/i.test(h)) compartments.push({ col: c, name: h });
  }

  let specs;
  if (isWideTable(headerTexts)) {
    specs = extractWideTable(ws, headerRow, startCol, maxRow, specMaxCol, equipmentName);
  } else {
    specs = [];
    for (let r = headerRow + 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      const c1 = norm(cellText(row.getCell(startCol)));
      const c2 = norm(cellText(row.getCell(startCol + 1)));
      const c3 = norm(cellText(row.getCell(startCol + 2)));
      const c4 = norm(cellText(row.getCell(startCol + 3)));
      const line = uniqueJoin([c1, c2, c3, c4]);
      if (!line) continue;
      if (JOBS_HEADER_RE.test(line) || JOBS_HEADER_RE.test(c1) || JOBS_HEADER_RE.test(c2)) break;
      if (parseSeason(c1) || parseSeason(c2) || parseSeason(line)) break;

      let sn = '';
      let parameter = '';
      let uom = '';
      let value = '';

      if (SN_RE.test(c1) && c2) {
        sn = c1;
        parameter = c2;
        ({ uom, value } = splitUomValue(c3, c4));
      } else if (!c2 && c1 && !SN_RE.test(c1)) {
        parameter = c1;
        ({ uom, value } = splitUomValue(c2, c3));
        if (!value && c2) value = c2;
        if (!uom && c3 && UOM_RE.test(c3)) uom = c3;
        if (!value && c3 && !UOM_RE.test(c3)) value = c3;
      } else if (c1 && c2 && !SN_RE.test(c1)) {
        parameter = c1;
        ({ uom, value } = splitUomValue(c2, c3));
      } else {
        continue;
      }

      const isSection = Boolean(parameter) && !value && !uom;
      specs.push({ equipmentName, sn, parameter, uom, value, isSection });

      for (const comp of compartments) {
        const cv = norm(cellText(row.getCell(comp.col)));
        if (!cv) continue;
        specs.push({
          equipmentName,
          sn,
          parameter: `${parameter} (${comp.name})`,
          uom,
          value: cv,
          isSection: false,
        });
      }
    }
  }

  const history = [];
  let mode = 'specs';
  let season = null;
  for (let r = headerRow + 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const parts = [];
    for (let c = startCol; c <= Math.min(maxCol, startCol + 4); c++) {
      parts.push(cellText(row.getCell(c)));
    }
    const text = uniqueJoin(parts);
    if (!text) continue;

    if (JOBS_HEADER_RE.test(text)) {
      mode = 'history';
      season = null;
      continue;
    }
    const seasonHit = parseSeason(text);
    if (seasonHit) {
      mode = 'history';
      season = seasonHit;
      continue;
    }
    if (mode !== 'history' || !season) continue;

    const actionMatch = text.match(ACTION_RE);
    if (actionMatch) {
      history.push({
        equipmentName,
        season: season.season,
        year: season.year,
        actionNo: Number(actionMatch[1]),
        action: norm(actionMatch[2]) || norm(text),
      });
      continue;
    }
    if (history.length && history[history.length - 1].year === season.year) {
      const last = history[history.length - 1];
      last.action = `${last.action} ${text}`.replace(/\s+/g, ' ').trim();
    }
  }

  const duty = specs.find((s) => /^duty$/i.test(s.parameter) && !/\(/.test(s.parameter))?.value || '';
  const capacity = specs.find((s) => /^capacity$/i.test(s.parameter) && !/\(/.test(s.parameter));
  const capacityText = capacity ? [capacity.value, capacity.uom].filter(Boolean).join(' ') : '';

  return {
    sheetName: ws.name,
    equipmentName,
    type: classifyType(equipmentName),
    duty,
    capacity: capacityText,
    specCount: specs.filter((s) => !s.isSection).length,
    historyCount: history.length,
    specs,
    history,
  };
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
}

async function writeWorkbook(cards) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog extract';
  wb.created = new Date();

  const eqSheet = wb.addWorksheet('Equipment', { views: [{ state: 'frozen', ySplit: 1 }] });
  eqSheet.columns = [
    { header: 'Sr', key: 'sr', width: 8 },
    { header: 'Sheet name', key: 'sheetName', width: 36 },
    { header: 'Equipment', key: 'equipmentName', width: 40 },
    { header: 'Type', key: 'type', width: 22 },
    { header: 'Duty', key: 'duty', width: 22 },
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
    { header: 'Equipment', key: 'equipmentName', width: 40 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'SN', key: 'sn', width: 8 },
    { header: 'Parameter', key: 'parameter', width: 48 },
    { header: 'UOM', key: 'uom', width: 12 },
    { header: 'Value', key: 'value', width: 36 },
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
    { header: 'Equipment', key: 'equipmentName', width: 40 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Season', key: 'season', width: 14 },
    { header: 'Year', key: 'year', width: 14 },
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

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('Source not found:', SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const cards = wb.worksheets.map(extractSheet).filter(Boolean);

  await writeWorkbook(cards);
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    source: path.basename(SRC),
    extractedAt: new Date().toISOString(),
    equipmentCount: cards.length,
    specCount: cards.reduce((n, c) => n + c.specCount, 0),
    historyCount: cards.reduce((n, c) => n + c.historyCount, 0),
    equipment: cards,
  }, null, 2));

  const withHist = cards.filter((c) => c.historyCount > 0).length;
  const seasons = {};
  for (const c of cards) {
    for (const h of c.history) {
      const k = `${h.season} ${h.year}`;
      seasons[k] = (seasons[k] || 0) + 1;
    }
  }
  console.log(`Equipment cards: ${cards.length}`);
  console.log(`Spec rows: ${cards.reduce((n, c) => n + c.specs.length, 0)} (parameters ${cards.reduce((n, c) => n + c.specCount, 0)})`);
  console.log(`History actions: ${cards.reduce((n, c) => n + c.historyCount, 0)} across ${withHist} equipment`);
  console.log('By season:');
  Object.keys(seasons).sort().forEach((k) => console.log(`  ${k}: ${seasons[k]}`));
  console.log('Wrote', OUT_XLSX);
  console.log('Wrote', OUT_JSON);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
