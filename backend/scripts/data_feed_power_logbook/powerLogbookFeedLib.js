/**
 * Shared helpers for Power Logbook data feed (ph_power, ph_steam, ph_stoppage).
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const FORM_TARGETS = {
  power: {
    formKey: 'ph_power',
    table: 'ph_power',
    label: 'Power Details',
    defaultFile: 'power_details.csv',
    defaultFiles: ['power_details.csv', 'power_details.xlsx', 'power_details.xls', 'power.xlsx'],
    dedupeKeys: ['Date', 'Time'],
  },
  steam: {
    formKey: 'ph_steam',
    table: 'ph_steam',
    label: 'Steam Details',
    defaultFile: 'steam_details.csv',
    defaultFiles: ['steam_details.csv', 'steam_details.xlsx', 'steam_details.xls', 'steam.xlsx'],
    dedupeKeys: ['Date', 'Time'],
  },
  stoppage: {
    formKey: 'ph_stoppage',
    table: 'ph_stoppage',
    label: 'Stoppage Details',
    defaultFile: 'stoppage_details.csv',
    defaultFiles: ['stoppage_details.csv', 'stoppage_details.xlsx', 'stopage_details.xlsx', 'stoppage_details.xls', 'stoppage.xlsx'],
    dedupeKeys: ['Date', 'start_time', 'end_Time'],
  },
};

const SHEET_FORM_ALIASES = {
  power: ['power', 'power details', 'ph_power', 'power_details', 'power detail'],
  steam: ['steam', 'steam details', 'ph_steam', 'steam_details', 'steam detail'],
  stoppage: ['stoppage', 'stopage', 'stoppage details', 'ph_stoppage', 'stoppage_details', 'stoppage detail', 'stop'],
};

const SHEET_FORM_ORDER = ['steam', 'stoppage', 'power'];

const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm']);

const ALL_FORM_KEYS = Object.keys(FORM_TARGETS);

function stripBom(text) {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function normalizeHeader(h) {
  return String(h || '').trim().replace(/^"|"$/g, '').trim();
}

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

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    const meaningful = row.some((cell) => String(cell).trim() !== '');
    if (meaningful || row.length > 1) rows.push(row);
  }

  return rows;
}

function isExcelDateSerial(n) {
  return Number.isFinite(n) && n >= 30000 && n < 60000;
}

/** Only Date/Time/timestamp columns may treat Excel serials as dates — never metric columns like PowerGen3New (30k–60k kWh). */
function isDateTimeHeader(header = '') {
  const h = String(header || '').trim().toLowerCase();
  if (!h) return false;
  if (h === 'date' || h === 'time' || h === 'timestamp') return true;
  if (h === 'start_time' || h === 'end_time' || h === 'end_time' || h === 'created_at') return true;
  if (/(^|_)(date|time|timestamp)$/.test(h)) return true;
  return false;
}

/**
 * Excel serial (days since 1899-12-30) → date parts.
 * Epoch 1899-12-30 already matches Excel's 1900 leap-year quirk — do NOT subtract 1
 * (that shifted every modern date back by one day, e.g. 2023-11-16 → 2023-11-15).
 */
function excelSerialToParts(serial) {
  const num = Number(serial);
  const days = Math.floor(num);
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + days * 86400000);
  const frac = num - days;
  const timeMs = Math.round(frac * 86400000);
  return { date, timeMs };
}

function formatExcelSerial(serial, header = '') {
  const { date, timeMs } = excelSerialToParts(serial);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateOnlyField = /^date$/i.test(String(header).trim());
  if (dateOnlyField || timeMs === 0) {
    return `${y}-${m}-${d}`;
  }
  const t = new Date(date.getTime() + timeMs);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function formatExcelCell(value, header = '') {
  if (value === null || value === undefined) return '';
  const dateHeader = isDateTimeHeader(header);
  // Only convert Excel serial → date for actual date/time columns.
  // Power metrics in the 30k–60k range were incorrectly turned into dates (then NULL in DB).
  if (dateHeader && typeof value === 'number' && isExcelDateSerial(value)) {
    return formatExcelSerial(value, header);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const hasTime = value.getHours() || value.getMinutes() || value.getSeconds();
    if (hasTime && !/^date$/i.test(String(header).trim())) {
      const hh = String(value.getHours()).padStart(2, '0');
      const mm = String(value.getMinutes()).padStart(2, '0');
      const ss = String(value.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (dateHeader) {
    const asNum = Number(s);
    if (/^\d+(\.\d+)?$/.test(s) && isExcelDateSerial(asNum)) {
      return formatExcelSerial(asNum, header);
    }
  }
  return s;
}

function rowsFromSheetArrays(records) {
  if (records.length < 2) return { headers: [], rows: [] };

  const headers = records[0].map((h) => normalizeHeader(h));
  const rows = [];

  for (let ri = 1; ri < records.length; ri += 1) {
    const cells = records[ri];
    if (!cells?.length) continue;
    const row = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      row[h] = formatExcelCell(cells[idx], h);
    });
    const any = Object.values(row).some((v) => v !== '');
    if (any) rows.push(row);
  }

  return { headers, rows };
}

function parseXlsxSheet(sheet) {
  const records = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    dateNF: 'yyyy-mm-dd',
  });
  return rowsFromSheetArrays(records);
}

function resolveSheetFormKey(sheetName) {
  const n = String(sheetName || '').trim().toLowerCase();
  for (const formKey of SHEET_FORM_ORDER) {
    const aliases = SHEET_FORM_ALIASES[formKey];
    if (aliases.some((alias) => n === alias || n.includes(alias))) {
      return formKey;
    }
  }
  return null;
}

function parseXlsxFile(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheets = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const { headers, rows } = parseXlsxSheet(sheet);
    if (!rows.length) continue;
    sheets.push({
      sheetName,
      formKey: resolveSheetFormKey(sheetName),
      headers,
      rows,
    });
  }

  if (!sheets.length) {
    return { kind: 'xlsx', headers: [], rows: [], sheetName: null, formKey: null };
  }

  if (sheets.length === 1) {
    const only = sheets[0];
    return {
      kind: 'xlsx',
      headers: only.headers,
      rows: only.rows,
      sheetName: only.sheetName,
      formKey: only.formKey,
    };
  }

  const mapped = sheets.filter((s) => s.formKey);
  if (mapped.length > 1) {
    return { kind: 'xlsx-multi', sheets: mapped };
  }

  const dataSheets = sheets.filter((s) => {
    const n = String(s.sheetName || '').trim().toLowerCase();
    return !['instructions', 'readme', 'sheet1'].includes(n) || sheets.length === 1;
  });
  const pick = dataSheets[0] || sheets[0];
  return {
    kind: 'xlsx',
    headers: pick.headers,
    rows: pick.rows,
    sheetName: pick.sheetName,
    formKey: pick.formKey,
  };
}

function parseCsvFile(content, delimiter = ';') {
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
    const any = Object.values(row).some((v) => v !== '');
    if (any) rows.push(row);
  }

  return { headers, rows };
}

function mysqlVarcharMaxLen(type) {
  const m = String(type).toLowerCase().match(/^varchar\((\d+)\)/);
  return m ? Number(m[1]) : null;
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
    const asNum = Number(s.replace(',', '.'));
    if (Number.isFinite(asNum) && isExcelDateSerial(asNum)) {
      return formatExcelSerial(asNum, field);
    }
    const t = meta[field].type.toLowerCase();
    if (t.includes('date') && !t.includes('time')) {
      const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (md) {
        return `${md[3]}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`;
      }
      const md2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (md2) {
        return `${md2[3]}-${md2[2].padStart(2, '0')}-${md2[1].padStart(2, '0')}`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
    return s;
  }
  const maxLen = mysqlVarcharMaxLen(meta[field].type);
  if (maxLen != null && s.length > maxLen) {
    return s.slice(0, maxLen);
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

function prepareRows(rawRows, insertCols, meta) {
  return rawRows.map((row) => {
    const obj = {};
    for (const c of insertCols) {
      obj[c] = coerceCell(c, row[c], meta);
    }
    return obj;
  });
}

async function insertBatch(conn, table, columns, batch) {
  if (batch.length === 0) return;
  const colSql = columns.map((c) => `\`${c}\``).join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT INTO \`${table}\` (${colSql}) VALUES ${batch.map(() => rowPlaceholder).join(', ')}`;
  const flat = batch.flatMap((obj) => columns.map((c) => obj[c]));
  await conn.execute(sql, flat);
}

function rowsFromJsonPayload(payload, formKey) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload[formKey])) return payload[formKey];
    if (payload.forms && Array.isArray(payload.forms[formKey])) return payload.forms[formKey];
    if (Array.isArray(payload.rows)) return payload.rows;
  }
  return [];
}

function headersFromRows(rows) {
  const seen = new Set();
  const headers = [];
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers;
}

function loadFeedFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { kind: 'json', payload: parsed };
  }

  if (EXCEL_EXTENSIONS.has(ext)) {
    return parseXlsxFile(filePath);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const delimiter = ext === '.csv' ? ';' : ';';
  const { headers, rows } = parseCsvFile(raw, delimiter);
  return { kind: 'csv', headers, rows };
}

function resolveFormKeyFromFile(filePath, explicitForm, loaded = null) {
  if (explicitForm && FORM_TARGETS[explicitForm]) return explicitForm;
  const base = path.basename(filePath).toLowerCase();
  if (base.includes('steam')) return 'steam';
  if (base.includes('stoppage') || base.includes('stopage')) return 'stoppage';
  if (base.includes('power')) return 'power';
  if (loaded?.formKey && FORM_TARGETS[loaded.formKey]) return loaded.formKey;
  if (base.includes('stop')) return 'stoppage';
  return null;
}

async function importFormRows(conn, formKey, rawRows, opts, columnCache) {
  const target = FORM_TARGETS[formKey];
  if (!target) throw new Error(`Unknown form: ${formKey}`);

  let metaMap = columnCache.get(target.table);
  if (!metaMap) {
    metaMap = await getTableColumnMeta(conn, target.table);
    columnCache.set(target.table, metaMap);
  }
  const { order, meta } = metaMap;
  const tableSet = new Set(order);

  const headers = headersFromRows(rawRows);
  const unknown = headers.filter((h) => h && !tableSet.has(h));
  if (unknown.length) {
    console.warn(`   ${target.label}: columns not in \`${target.table}\`: ${unknown.join(', ')}`);
  }

  const insertCols = pickInsertColumns(headers, tableSet);
  if (insertCols.length === 0) {
    console.warn(`   ${target.label}: no matching DB columns — skipped`);
    return { inserted: 0, skipped: rawRows.length };
  }

  const prepared = prepareRows(rawRows, insertCols, meta);
  if (prepared.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  if (opts.dryRun) {
    console.log(`   ${target.label} → \`${target.table}\`: would insert ${prepared.length} rows`);
    return { inserted: prepared.length, skipped: 0 };
  }

  if (opts.truncate) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query(`TRUNCATE TABLE \`${target.table}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`   Truncated \`${target.table}\``);
  }

  const BATCH = 150;
  let inserted = 0;
  for (let i = 0; i < prepared.length; i += BATCH) {
    const batch = prepared.slice(i, i + BATCH);
    await insertBatch(conn, target.table, insertCols, batch);
    inserted += batch.length;
  }

  console.log(`   ${target.label} → \`${target.table}\`: inserted ${inserted} rows`);
  return { inserted, skipped: 0 };
}

async function importFeedFile(conn, filePath, opts, columnCache) {
  const loaded = loadFeedFromFile(filePath);
  const label = path.basename(filePath);

  if (loaded.kind === 'json') {
    const formsToRun = opts.forms.filter((f) => {
      const rows = rowsFromJsonPayload(loaded.payload, f);
      return rows.length > 0;
    });
    if (!formsToRun.length) {
      const explicit = opts.forms.length === 1 ? opts.forms[0] : null;
      if (explicit) {
        const rows = rowsFromJsonPayload(loaded.payload, explicit);
        return importFormRows(conn, explicit, rows, opts, columnCache);
      }
      console.warn(`   ${label}: no power/steam/stoppage arrays found in JSON`);
      return { inserted: 0 };
    }

    let total = 0;
    for (const formKey of formsToRun) {
      const rows = rowsFromJsonPayload(loaded.payload, formKey);
      const r = await importFormRows(conn, formKey, rows, {
        ...opts,
        truncate: opts.truncate && opts.forms.includes(formKey),
      }, columnCache);
      total += r.inserted;
    }
    return { inserted: total };
  }

  if (loaded.kind === 'xlsx-multi') {
    let total = 0;
    for (const sheet of loaded.sheets) {
      if (!opts.forms.includes(sheet.formKey)) continue;
      console.log(`   Sheet "${sheet.sheetName}" → ${FORM_TARGETS[sheet.formKey].label}`);
      const r = await importFormRows(conn, sheet.formKey, sheet.rows, opts, columnCache);
      total += r.inserted;
    }
    if (total === 0) {
      console.warn(`   ${label}: no matching sheets for --form filter`);
    }
    return { inserted: total };
  }

  if (loaded.sheetName) {
    console.log(`   Sheet "${loaded.sheetName}"`);
  }

  const formKey = resolveFormKeyFromFile(
    filePath,
    opts.forms.length === 1 ? opts.forms[0] : null,
    loaded,
  );
  if (!formKey) {
    if (opts.skipUnknown) {
      console.warn(`   ${label}: skipped (not a power/steam/stoppage logbook file)`);
      return { inserted: 0 };
    }
    throw new Error(`Cannot detect form for ${label}. Use --form power|steam|stoppage`);
  }
  if (!opts.forms.includes(formKey)) {
    console.log(`   ${label}: skipped (not in --form filter)`);
    return { inserted: 0 };
  }

  return importFormRows(conn, formKey, loaded.rows, opts, columnCache);
}

function findFirstExistingFile(dirs, filenames) {
  for (const dir of dirs) {
    for (const name of filenames) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function resolveDefaultFiles(feedDir, backlogDir, forms) {
  const dirs = [feedDir, backlogDir];
  const files = [];
  for (const formKey of forms) {
    const target = FORM_TARGETS[formKey];
    const found = findFirstExistingFile(dirs, target.defaultFiles);
    if (found) files.push({ formKey, path: found });
    else files.push({ formKey, path: path.join(feedDir, target.defaultFile), missing: true });
  }
  return files;
}

const POWER_LOGBOOK_NAME_RE = /power_details|steam_details|stoppage_details|stopage_details|power|steam|stoppage|stopage/i;

function isPowerLogbookExcelName(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (/^file for /i.test(base)) return false;
  return POWER_LOGBOOK_NAME_RE.test(base);
}

function listExcelFilesInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => EXCEL_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name));
}

/** Collect every .xlsx/.xls/.xlsm in the given directories (first-seen wins). */
function resolveAllXlsxFiles(searchDirs, { nameFilter = false } = {}) {
  const seen = new Set();
  const files = [];
  for (const dir of searchDirs) {
    const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
    for (const fp of listExcelFilesInDir(resolvedDir)) {
      if (nameFilter && !isPowerLogbookExcelName(fp)) continue;
      const key = path.resolve(fp).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      files.push(fp);
    }
  }
  return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: 'base' }));
}

async function truncateFormTables(conn, formKeys, { dryRun = false } = {}) {
  const tables = [...new Set(formKeys.map((f) => FORM_TARGETS[f]?.table).filter(Boolean))];
  if (!tables.length) return;

  if (dryRun) {
    console.log(`Would truncate: ${tables.map((t) => `\`${t}\``).join(', ')}`);
    return;
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await conn.query(`TRUNCATE TABLE \`${table}\``);
    console.log(`Truncated \`${table}\``);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function runPowerLogbookImport(conn, files, opts) {
  const columnCache = new Map();
  let total = 0;

  const importOpts = { ...opts };
  if (opts.truncateOnce) {
    await truncateFormTables(conn, opts.forms, { dryRun: opts.dryRun });
    importOpts.truncate = false;
  }

  for (const filePath of files) {
    console.log(`→ ${filePath}`);
    const result = await importFeedFile(conn, filePath, importOpts, columnCache);
    total += result.inserted || 0;
  }

  return total;
}

module.exports = {
  FORM_TARGETS,
  ALL_FORM_KEYS,
  EXCEL_EXTENSIONS,
  parseCsvFile,
  parseXlsxFile,
  loadFeedFromFile,
  importFeedFile,
  importFormRows,
  resolveDefaultFiles,
  listExcelFilesInDir,
  resolveAllXlsxFiles,
  truncateFormTables,
  runPowerLogbookImport,
};
