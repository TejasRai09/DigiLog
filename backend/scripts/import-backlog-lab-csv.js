/**
 * Import GSMA backlog CSVs from backlog-data/ subfolders into MySQL.
 *
 * Layout (under DigiLog/backend/backlog-data):
 *   lab data/        → Lab logbook tables (6 CSVs)
 *   mill data/       → Mill logbook tables (4 CSVs)
 *   power data/      → Power house tables (3 CSVs)
 *   distillary data/ → Distillery operations (comma MS Forms export → distillery_operations)
 *
 * Default: semicolon + DB column headers. Distillery file: comma delimiter + human-readable
 * headers mapped in code. Quoted fields may contain newlines.
 *
 * Usage (from DigiLog/backend):
 *   node scripts/import-backlog-lab-csv.js
 *   node scripts/import-backlog-lab-csv.js --truncate
 *   node scripts/import-backlog-lab-csv.js --dry-run
 *
 * npm: backlog:import-lab | backlog:import | backlog:import-lab:truncate
 *
 * Requires DATABASE_URL in .env (same as the API).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/mysql');

const BACKLOG_DIR = path.join(__dirname, '..', 'backlog-data');

/**
 * @typedef {{ subdir: string, file: string, table: string }} BacklogFile
 * @type {BacklogFile[]}
 */
const FILES = [
  // App 2 – Lab (`lab data/`)
  { subdir: 'lab data', file: 'ds_logbook.csv', table: 'ds_logbook' },
  { subdir: 'lab data', file: 'rs_logbook.csv', table: 'rs_logbook' },
  { subdir: 'lab data', file: 'ops_logbook.csv', table: 'ops_logbook' },
  { subdir: 'lab data', file: 'sa_logbook.csv', table: 'sa_logbook' },
  { subdir: 'lab data', file: 'syrp_logbook.csv', table: 'syrp_logbook' },
  { subdir: 'lab data', file: 'stoppage_logbook.csv', table: 'stoppage_logbook' },

  // App 1 – Mill (`mill data/`)
  { subdir: 'mill data', file: 'equipment_temperature.csv', table: 'mill_logbook1' },
  { subdir: 'mill data', file: 'shreddar and otg.csv', table: 'mill_logbook2' },
  { subdir: 'mill data', file: 'lube_presure and roller.csv', table: 'mill_logbook3' },
  { subdir: 'mill data', file: 'mill_stopapages.csv', table: 'mill_stoppages' },

  // App 3 – Power (`power data/`)
  { subdir: 'power data', file: 'power_details.csv', table: 'ph_power' },
  { subdir: 'power data', file: 'steam_details.csv', table: 'ph_steam' },
  { subdir: 'power data', file: 'stoppage_details.csv', table: 'ph_stoppage' },

  // App 4 – Distillery (`distillary data/`) — comma CSV, Microsoft Forms column titles
  {
    subdir: 'distillary data',
    file: 'GSMA Distillery Operations Data 23-24(Sheet1).csv',
    table: 'distillery_operations',
    delimiter: ',',
    mapStyle: 'distillery_forms',
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    truncate: args.includes('--truncate'),
    dryRun: args.includes('--dry-run'),
  };
}

function stripBom(text) {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function normalizeHeader(h) {
  return h.trim().replace(/^"|"$/g, '').trim();
}

/**
 * Delimited CSV (`;` or `,`): quotes, `""`, newlines inside quoted fields.
 * @param {string} delimiter single separator character
 * @returns {string[][]}
 */
function parseDelimitedCsvRecords(text, delimiter = ';') {
  const d = delimiter.length === 1 ? delimiter : ';';
  const s = stripBom(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  function pushRow() {
    row.push(field);
    field = '';
    const meaningful = row.some((cell) => String(cell).trim() !== '');
    if (meaningful || row.length > 1) rows.push(row);
    row = [];
  }

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === d) {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      if (s[i + 1] === '\n') i += 1;
      pushRow();
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }

  if (inQuotes) {
    console.warn('CSV warning: file ended inside a quoted field');
  }
  /* Unterminated last line (no final newline): flush accumulated field onto row */
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    const meaningful = row.some((cell) => String(cell).trim() !== '');
    if (meaningful || row.length > 1) rows.push(row);
  }

  return rows;
}

/** MS Forms / Excel export: NBSP, outer quotes, collapse spaces */
function normalizeFormsTitle(raw) {
  return String(raw || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/^"|"$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Target column order for distillery_operations inserts (matches mysql/init.sql). */
const DISTILLERY_DB_COLUMN_ORDER = [
  'Date',
  'operation_mode',
  'syrup_molasses_qtls',
  'wash_distilled',
  'trs',
  'ufs',
  'alcohol_pct',
  'actual_ethanol_bl',
  'al_bl_ratio_pct',
  'total_bh_molasses_qtls',
  'total_ch_molasses_qtls',
  'ethanol_storage_bl',
  'fs',
  'fs_quantity',
  'theoretical_yield',
  'alcohol_prod_fermentation',
  'fe',
  'actual_prod_al',
  'de',
  'oe',
  'rec_bl',
  'rec_al',
  'trs_qty',
  'ufs_qty',
];

/** Normalized Microsoft Forms header → DB column (distillery_operations). */
const DISTILLERY_FORMS_TITLE_TO_DB = (() => {
  const pairs = [
    ['Operation Date', 'Date'],
    ['Operation Mode', 'operation_mode'],
    ['Syrup or Molasses Used (Qtls)', 'syrup_molasses_qtls'],
    ['Wash Distilled', 'wash_distilled'],
    ['TRS', 'trs'],
    ['UFS', 'ufs'],
    ['Alcohol %', 'alcohol_pct'],
    ['Actual Ethanol Production (BL)', 'actual_ethanol_bl'],
    ['AL to BL Ratio (%)', 'al_bl_ratio_pct'],
    ['Total BH Molasses in Storage (Distillery) - Qtls', 'total_bh_molasses_qtls'],
    ['Total CH Molasses in Storage (Distillery) - Qtls', 'total_ch_molasses_qtls'],
    ['Ethanol in Storage (BL)', 'ethanol_storage_bl'],
    ['FS', 'fs'],
    ['FS QTY', 'fs_quantity'],
    ['Theoretical Yield', 'theoretical_yield'],
    ['Alchol Prod In Fermentation', 'alcohol_prod_fermentation'],
    ['FE', 'fe'],
    ['Actual Prod. AL', 'actual_prod_al'],
    ['DE', 'de'],
    ['OE', 'oe'],
    ['REC BL', 'rec_bl'],
    ['REC AL', 'rec_al'],
    ['TRS QTY', 'trs_qty'],
    ['UFS QTY', 'ufs_qty'],
  ];
  const o = {};
  for (const [title, db] of pairs) {
    o[normalizeFormsTitle(title)] = db;
  }
  return o;
})();

const DISTILLERY_IGNORED_HEADERS = new Set(
  ['ID', 'Start time', 'Completion time', 'Email', 'Name', 'Last modified time'].map((t) =>
    normalizeFormsTitle(t),
  ),
);

function resolveDistilleryDbColumn(csvTitle) {
  const k = normalizeFormsTitle(csvTitle);
  if (!k) return null;
  const direct = DISTILLERY_FORMS_TITLE_TO_DB[k];
  if (direct) return direct;
  if (k.startsWith('Alcohol %')) return 'alcohol_pct';
  return null;
}

/**
 * Comma-separated Microsoft Forms export for GSMA Distillery Operations.
 * @param {string} label for warnings
 */
function parseDistilleryFormsCsv(content, label) {
  const records = parseDelimitedCsvRecords(content, ',');
  if (records.length < 2) return { headers: [], rows: [] };

  const headerTitles = records[0].map((c) => normalizeFormsTitle(c));
  const indexToDb = [];
  const unmappedTitles = [];

  headerTitles.forEach((title, idx) => {
    if (!title) return;
    const db = resolveDistilleryDbColumn(title);
    if (db) indexToDb.push({ idx, db });
    else if (!DISTILLERY_IGNORED_HEADERS.has(title)) {
      unmappedTitles.push(title);
    }
  });

  if (unmappedTitles.length) {
    console.warn(`   ${label}: unmapped distillery CSV headers: ${[...new Set(unmappedTitles)].join(', ')}`);
  }

  const mappedSet = new Set(indexToDb.map((x) => x.db));
  const headers = DISTILLERY_DB_COLUMN_ORDER.filter((c) => mappedSet.has(c));

  const rows = [];
  for (let ri = 1; ri < records.length; ri += 1) {
    const cells = records[ri];
    const row = {};
    for (const { idx, db } of indexToDb) {
      row[db] = cells[idx] !== undefined ? String(cells[idx]).trim() : '';
    }
    const any = Object.values(row).some((v) => v !== '');
    if (!any) continue;
    rows.push(row);
  }

  return { headers, rows };
}

function parseCsv(content, delimiter = ';') {
  const records = parseDelimitedCsvRecords(content, delimiter);
  if (records.length < 2) return { headers: [], rows: [] };

  const headers = records[0].map((h) => normalizeHeader(h));
  const rows = [];

  for (let ri = 1; ri < records.length; ri += 1) {
    const cells = records[ri];
    if (cells.length === 1 && String(cells[0]).trim() === '') continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined ? String(cells[idx]).trim() : '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function resolveEntryPath(entry) {
  return path.join(BACKLOG_DIR, entry.subdir, entry.file);
}

function entryLabel(entry) {
  return path.join(entry.subdir, entry.file);
}

function mysqlTypeCategory(type) {
  const t = String(type).toLowerCase();
  if (t.includes('int') || t.includes('decimal') || t.includes('float') || t.includes('double')) {
    return 'number';
  }
  if (t.includes('date') || t.includes('time')) return 'datetime';
  return 'string';
}

async function getTableColumnMeta(conn, tableName) {
  const [cols] = await conn.query(`DESCRIBE \`${tableName}\``);
  const order = [];
  const meta = {};
  for (const c of cols) {
    order.push(c.Field);
    meta[c.Field] = { type: c.Type, nullable: c.Null === 'YES' };
  }
  return { order, meta };
}

function coerceCell(field, raw, meta) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  const cat = mysqlTypeCategory(meta[field].type);

  if (cat === 'number') {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (cat === 'datetime') {
    const t = meta[field].type.toLowerCase();
    if (t.includes('date') && !t.includes('time')) {
      const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (md) {
        const mo = md[1].padStart(2, '0');
        const da = md[2].padStart(2, '0');
        return `${md[3]}-${mo}-${da}`;
      }
    }
    return s;
  }
  return s;
}

function pickInsertColumns(csvHeaders, tableOrderSet) {
  const seen = new Set();
  const insertCols = [];
  for (const h of csvHeaders) {
    if (!h || seen.has(h)) continue;
    if (tableOrderSet.has(h)) {
      insertCols.push(h);
      seen.add(h);
    }
  }
  return insertCols;
}

async function insertBatch(conn, table, columns, batch) {
  if (batch.length === 0) return;
  const colSql = columns.map((c) => `\`${c}\``).join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT INTO \`${table}\` (${colSql}) VALUES ${batch.map(() => rowPlaceholder).join(', ')}`;
  const flat = batch.flatMap((obj) => columns.map((c) => obj[c]));
  await conn.execute(sql, flat);
}

async function importFile(conn, entry, opts, columnCache) {
  const fp = resolveEntryPath(entry);
  const label = entryLabel(entry);

  if (!fs.existsSync(fp)) {
    console.warn(`⚠️  Missing file: ${label}`);
    return { inserted: 0 };
  }

  let metaMap = columnCache.get(entry.table);
  if (!metaMap) {
    metaMap = await getTableColumnMeta(conn, entry.table);
    columnCache.set(entry.table, metaMap);
  }
  const { order, meta } = metaMap;
  const tableSet = new Set(order);

  const raw = fs.readFileSync(fp, 'utf8');
  let headers;
  let rows;
  if (entry.mapStyle === 'distillery_forms') {
    ({ headers, rows } = parseDistilleryFormsCsv(raw, label));
  } else {
    ({ headers, rows } = parseCsv(raw, entry.delimiter || ';'));
  }
  if (!headers.length) {
    console.warn(`⚠️  No data in ${label}`);
    return { inserted: 0 };
  }

  const unknownCsv = headers.filter((h) => h && !tableSet.has(h));
  if (unknownCsv.length) {
    console.warn(`   ${label}: CSV columns not in \`${entry.table}\`: ${unknownCsv.join(', ')}`);
  }

  const insertCols = pickInsertColumns(headers, tableSet);
  if (insertCols.length === 0) {
    console.warn(`⚠️  No matching columns for ${label}`);
    return { inserted: 0 };
  }

  const prepared = [];
  for (const row of rows) {
    const obj = {};
    for (const c of insertCols) {
      obj[c] = coerceCell(c, row[c], meta);
    }
    prepared.push(obj);
  }

  if (opts.dryRun) {
    console.log(`   ${label} → \`${entry.table}\`: would insert ${prepared.length} rows`);
    return { inserted: prepared.length };
  }

  if (opts.truncate) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query(`TRUNCATE TABLE \`${entry.table}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const BATCH = 150;
  let inserted = 0;
  for (let i = 0; i < prepared.length; i += BATCH) {
    const batch = prepared.slice(i, i + BATCH);
    await insertBatch(conn, entry.table, insertCols, batch);
    inserted += batch.length;
  }

  console.log(`   ${label} → \`${entry.table}\`: inserted ${inserted}`);
  return { inserted };
}

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to backend/.env');
    process.exit(1);
  }

  if (!fs.existsSync(BACKLOG_DIR)) {
    console.error(`Backlog folder not found: ${BACKLOG_DIR}`);
    process.exit(1);
  }

  console.log(`Backlog import (Lab + Mill + Power + Distillery) — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.truncate ? ', TRUNCATE first' : ''}`);
  console.log(`Source: ${BACKLOG_DIR}\n`);

  const conn = await pool.getConnection();
  const columnCache = new Map();
  try {
    let totalIn = 0;
    for (const entry of FILES) {
      const r = await importFile(conn, entry, opts, columnCache);
      totalIn += r.inserted;
    }
    if (opts.dryRun) {
      console.log(`\nDry run only (no DB writes). Total rows would insert: ${totalIn}`);
    } else {
      console.log(`\nDone. Total rows inserted: ${totalIn}`);
    }
  } catch (e) {
    console.error('Import failed:', e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
