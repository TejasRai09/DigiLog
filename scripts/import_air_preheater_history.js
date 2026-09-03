#!/usr/bin/env node
/**
 * Import Air Pre Heater maintenance history from Excel into ppn_history.
 * Only sets equip_id — no section, sub_section, or equipment_refs (map later in UI).
 *
 * Input (default):  PLANT/folder/air preheater data.xlsx
 *
 * Usage (from DigiLog/backend):
 *   npm run db:import-air-preheater-xlsx
 *   npm run db:import-air-preheater-xlsx -- --dry-run
 *   npm run db:import-air-preheater-xlsx -- --replace
 *   npm run db:import-air-preheater-xlsx -- --equip-id 228
 *   npm run db:import-air-preheater-xlsx -- --input "../../folder/air preheater data.xlsx"
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const BACKEND_ROOT = path.join(__dirname, '..', 'backend');
const BACKEND_NODE_MODULES = path.join(BACKEND_ROOT, 'node_modules');

// Resolve npm packages from DigiLog/backend when this script lives in DigiLog/scripts.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveDigiLogBackend(request, parent, isMain, options) {
  if (!request.startsWith('.') && !path.isAbsolute(request)) {
    const backendPath = path.join(BACKEND_NODE_MODULES, request);
    if (fs.existsSync(backendPath) || fs.existsSync(`${backendPath}.js`)) {
      return originalResolve.call(this, backendPath, parent, isMain, options);
    }
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });

const xlsx = require('xlsx');
const { pool } = require(path.join(BACKEND_ROOT, 'config', 'mysql'));

const PLANT_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_INPUT = path.join(PLANT_ROOT, 'folder', 'air preheater data.xlsx');

const EQUIP_NAMES = ['Air Preheater', 'Air Pre Heater'];
const SECTION_HISTORY = 'EQUIPMENT MAINTENANCE HISTORY';

function parseArgs(argv) {
  const opts = {
    input: DEFAULT_INPUT,
    equipId: null,
    replace: false,
    dryRun: false,
    createEquipment: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') opts.input = path.resolve(argv[++i]);
    else if (a === '--equip-id') opts.equipId = Number(argv[++i]);
    else if (a === '--replace') opts.replace = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-create-equipment') opts.createEquipment = false;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/import_air_preheater_history.js [options]

Options:
  --input <path>           Excel file (default: folder/air preheater data.xlsx)
  --equip-id <id>          Use this ppn_equipment.id (skip name lookup)
  --replace                Delete existing ppn_history for this equipment first
  --no-create-equipment    Fail if equipment row is missing
  --dry-run                Parse only, no DB writes
`);
      process.exit(0);
    }
  }
  return opts;
}

function norm(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function cellText(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  return String(value).trim();
}

function getCell(ws, row, col) {
  const ref = xlsx.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[ref];
  if (!cell || cell.v == null) return '';
  if (cell.t === 'd' && cell.v instanceof Date) return cellText(cell.v);
  return cellText(cell.v);
}

function rowCells(ws, rowIdx, maxCol) {
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  const lastCol = maxCol || range.e.c + 1;
  const cells = [];
  for (let c = 1; c <= lastCol; c++) cells.push(getCell(ws, rowIdx, c));
  return cells;
}

function normalizeSeason(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const u = norm(s);
  if (u.includes('OFF') && u.includes('SEASON')) return 'Off-Season';
  if (u === 'SEASON') return 'Season';
  return s;
}

function emptyToNull(v) {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
}

/** Keep year as text; only store DATE columns when YYYY-MM-DD. */
function parseOptionalDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function findHistorySectionRow(ws) {
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = 1; r <= range.e.r + 1; r++) {
    const joined = norm(rowCells(ws, r).join(' '));
    if (joined.includes(SECTION_HISTORY)) return r;
  }
  return null;
}

function isHistoryHeaderRow(row) {
  const joined = norm(row.join(' '));
  return joined.includes('SEASON') && (joined.includes('YEAR') || joined.includes('OUTAGE') || joined.includes('OBSERVATION'));
}

function mapHistoryColumns(ws, headerRow) {
  const mapping = {};
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let c = 1; c <= range.e.c + 1; c++) {
    const h = norm(getCell(ws, headerRow, c));
    if (!h) continue;
    if (h.includes('SEASON') && h.includes('OFF')) mapping.season = c;
    else if (h.startsWith('YEAR')) mapping.year = c;
    else if (h.includes('DATE OF START')) mapping.date_start = c;
    else if (h.includes('DATE OF FINISH')) mapping.date_finish = c;
    else if (h.includes('OUTAGE') || h.includes('OBSERVATION')) mapping.obs = c;
    else if (h.includes('ACTION TAKEN')) mapping.act = c;
    else if (h.includes('REPAIR COST')) mapping.cost = c;
    else if (h.includes('SERVICE')) mapping.svc = c;
    else if (h.includes('RESPONSIBILITY')) mapping.resp = c;
    else if (h.includes('REMARKS')) mapping.rem = c;
  }
  return mapping;
}

function readRowValues(ws, rowIdx, cols) {
  const val = (key) => {
    const col = cols[key];
    return col ? getCell(ws, rowIdx, col) : '';
  };
  let year = val('year');
  const dateStartRaw = val('date_start');
  if (!year && dateStartRaw && dateStartRaw.length >= 4 && /^\d{4}/.test(dateStartRaw)) {
    year = dateStartRaw.slice(0, 4);
  }
  return {
    season: normalizeSeason(val('season')),
    year: emptyToNull(year),
    date_start: parseOptionalDate(dateStartRaw),
    date_finish: parseOptionalDate(val('date_finish')),
    obs: emptyToNull(val('obs')),
    act: emptyToNull(val('act')),
    cost: emptyToNull(val('cost')),
    svc: emptyToNull(val('svc')),
    resp: emptyToNull(val('resp')),
    rem: emptyToNull(val('rem')),
  };
}

function isDataRow(record) {
  return record.season || record.year || record.date_start || record.date_finish || record.obs || record.act;
}

function extractHistoryFromBlrSheet(ws) {
  const historyRow = findHistorySectionRow(ws);
  if (!historyRow) return [];

  let headerRow = null;
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = historyRow + 1; r <= Math.min(historyRow + 7, range.e.r + 1); r++) {
    if (isHistoryHeaderRow(rowCells(ws, r))) {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) return [];

  const cols = mapHistoryColumns(ws, headerRow);
  const records = [];

  for (let r = headerRow + 1; r <= range.e.r + 1; r++) {
    const row = rowCells(ws, r);
    if (!row.some(Boolean)) continue;
    if (isHistoryHeaderRow(row)) continue;
    const joined = norm(row.join(' '));
    if (joined.includes(SECTION_HISTORY) || joined.includes('EQUIPMENT LIFE HISTORY')) break;

    const record = readRowValues(ws, r, cols);
    if (!isDataRow(record)) continue;
    if (['SEASON / OFF SEASON', 'SR.NO.', 'SR NO'].includes(norm(record.season || ''))) continue;
    records.push(record);
  }

  return records;
}

function extractHistoryFlatSheet(ws) {
  const header = rowCells(ws, 1);
  if (!isHistoryHeaderRow(header)) return [];

  const cols = mapHistoryColumns(ws, 1);
  const records = [];
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');

  for (let r = 2; r <= range.e.r + 1; r++) {
    if (!rowCells(ws, r).some(Boolean)) continue;
    const record = readRowValues(ws, r, cols);
    if (isDataRow(record)) records.push(record);
  }

  return records;
}

function extractAllHistory(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const all = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const blr = extractHistoryFromBlrSheet(ws);
    const flat = blr.length ? [] : extractHistoryFlatSheet(ws);
    all.push(...(blr.length ? blr : flat));
  }

  return all;
}

async function findAirPreheaterEquipment(conn) {
  for (const name of EQUIP_NAMES) {
    const [rows] = await conn.execute(
      'SELECT id, name FROM ppn_equipment WHERE dept = ? AND name = ? LIMIT 1',
      ['plant', name],
    );
    if (rows[0]) return rows[0];
  }

  const [rows] = await conn.execute(
    `SELECT id, name FROM ppn_equipment
     WHERE dept = 'plant' AND category = '150TPH BLR' AND subcategory = 'Auxiliary Equipment'
       AND (name LIKE '%Preheater%' OR name LIKE '%Pre Heater%')
     ORDER BY id LIMIT 1`,
  );
  return rows[0] || null;
}

async function createAirPreheaterEquipment(conn) {
  const [result] = await conn.execute(
    `INSERT INTO ppn_equipment (dept, category, subcategory, name, sort_order)
     VALUES ('plant', '150TPH BLR', 'Auxiliary Equipment', 'Air Preheater', 0)`,
  );
  return { id: result.insertId, name: 'Air Preheater' };
}

async function resolveEquipId(conn, opts) {
  if (opts.equipId) {
    const [rows] = await conn.execute('SELECT id, name FROM ppn_equipment WHERE id = ? LIMIT 1', [opts.equipId]);
    if (!rows[0]) throw new Error(`ppn_equipment id ${opts.equipId} not found`);
    return rows[0];
  }

  let eq = await findAirPreheaterEquipment(conn);
  if (!eq && opts.createEquipment) {
    eq = await createAirPreheaterEquipment(conn);
    console.log(`Created ppn_equipment: ${eq.name} (id=${eq.id})`);
  }
  if (!eq) {
    throw new Error('Air Preheater not found in ppn_equipment. Use --equip-id or open the card in the app first.');
  }
  return eq;
}

async function insertHistory(conn, equipId, rows) {
  for (const row of rows) {
    await conn.execute(
      `INSERT INTO ppn_history
         (equip_id, season, year, date_start, date_finish, obs, act, cost, svc, provider, resp, rem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId,
        row.season, row.year, row.date_start, row.date_finish,
        row.obs, row.act, row.cost, row.svc, null, row.resp, row.rem,
      ],
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!fs.existsSync(opts.input)) {
    throw new Error(`Input not found: ${opts.input}\nPlace the file at: folder/air preheater data.xlsx`);
  }

  const rows = extractAllHistory(opts.input);
  if (!rows.length) {
    throw new Error(`No maintenance history rows found in ${path.basename(opts.input)}`);
  }

  console.log(`Air Pre Heater history import — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.replace ? ' (replace)' : ''}`);
  console.log(`File: ${opts.input}`);
  console.log(`Parsed: ${rows.length} row(s) (equip_id only — no section/sub_section mapping)\n`);

  const eq = await resolveEquipId(pool, opts);

  if (opts.dryRun) {
    console.log(`Would insert ${rows.length} row(s) for ${eq.name} (equip_id=${eq.id})`);
    console.log('Sample:', JSON.stringify(rows[0], null, 2));
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (opts.replace) {
      const [del] = await conn.execute('DELETE FROM ppn_history WHERE equip_id = ?', [eq.id]);
      console.log(`Cleared ${del.affectedRows} existing history row(s) for equip_id=${eq.id}`);
    }
    await insertHistory(conn, eq.id, rows);
    await conn.commit();
    console.log(`Inserted ${rows.length} row(s) → ppn_history.equip_id = ${eq.id} (${eq.name})`);
    console.log(`Open: /power-plant-equipment-new/${eq.id}`);
    console.log('Map equipment cards later in the UI when ready.');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
