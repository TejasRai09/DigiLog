const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../../config/mysql');
const { excelDateToISO, minMaxDates } = require('../../utils/excelDateUtils');
const {
  HEADER_ROW_INDEX,
  DATA_START_ROW,
  EXPECTED_FILE_HEADERS,
  COLUMNS,
} = require('./dmrDailySchema');
const { validateExactHeaders, ColumnValidationError } = require('../../utils/excelColumnValidation');

const BATCH_SIZE = 200;
const TABLE = 'dmr_daily';

class DmrColumnValidationError extends ColumnValidationError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'DmrColumnValidationError';
  }
}

function findHeaderRowIndex(matrix) {
  for (let i = 0; i < Math.min(15, matrix.length); i += 1) {
    const row = matrix[i] || [];
    const trimmed = row.map((c) => String(c ?? '').trim());
    if (trimmed.includes('Date') && trimmed.includes('Crop Day')) return i;
  }
  return HEADER_ROW_INDEX;
}

function validateHeaders(fileHeaders) {
  try {
    validateExactHeaders(fileHeaders, EXPECTED_FILE_HEADERS, 'DMR Sheet1');
  } catch (err) {
    if (err.name === 'ColumnValidationError') {
      throw new DmrColumnValidationError(err.message, err.details);
    }
    throw err;
  }
}

function coerceValue(fileHeader, raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (fileHeader === 'Date') {
    return excelDateToISO(raw);
  }
  if (fileHeader === 'Crop Day') {
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

async function loadExistingDates(conn) {
  const [rows] = await conn.query(`SELECT DISTINCT \`Date\` AS d FROM \`${TABLE}\` WHERE \`Date\` IS NOT NULL`);
  return new Set(rows.map((r) => String(r.d).slice(0, 10)));
}

async function insertBatch(conn, columns, batch) {
  if (!batch.length) return;
  const colSql = columns.map((c) => `\`${c.replace(/`/g, '')}\``).join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT INTO \`${TABLE}\` (${colSql}) VALUES ${batch.map(() => rowPlaceholder).join(', ')}`;
  const flat = batch.flatMap((obj) => columns.map((c) => obj[c]));
  await conn.execute(sql, flat);
}

async function runDmrLogbookImport({ filePath, onProgress }) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const log = (stage, message, detail = {}) => {
    if (onProgress) onProgress(stage, detail, message);
  };

  log('read', 'Reading DMR workbook (Sheet1)…');
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets.');

  const matrix = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  const headerRowIdx = findHeaderRowIndex(matrix);
  const fileHeaders = matrix[headerRowIdx] || [];

  log('validate', 'Validating column headers against DMR template…');
  validateHeaders(fileHeaders);

  const dbColumnNames = COLUMNS.map((c) => c.dbColumn);
  const dataRows = matrix.slice(headerRowIdx + 1);

  log('parse', `Sheet "${sheetName}": header row ${headerRowIdx + 1}, ${dataRows.length} data rows.`);

  const conn = await pool.getConnection();
  let imported = 0;
  let skipped = 0;
  const dates = [];
  let batch = [];

  try {
    const existingDates = await loadExistingDates(conn);
    log('dedup', `${existingDates.size} dates already in dmr_daily.`);

    for (const row of dataRows) {
      if (!row || row.every((c) => c === '' || c == null)) continue;

      const obj = {};
      for (const col of COLUMNS) {
        const raw = row[col.index];
        obj[col.dbColumn] = coerceValue(col.fileHeader, raw);
      }

      const dateVal = obj.Date;
      if (!dateVal) {
        skipped += 1;
        continue;
      }
      dates.push(dateVal);
      if (existingDates.has(dateVal)) {
        skipped += 1;
        continue;
      }

      batch.push(obj);
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(conn, dbColumnNames, batch);
        imported += batch.length;
        batch = [];
      }
    }

    if (batch.length) {
      await insertBatch(conn, dbColumnNames, batch);
      imported += batch.length;
    }

    const { min, max } = minMaxDates(dates);
    log('complete', `DMR import done: ${imported} imported, ${skipped} skipped.`, {
      imported,
      skipped,
      dateMin: min,
      dateMax: max,
    });

    return { imported, skipped, dateMin: min, dateMax: max, table: TABLE };
  } finally {
    conn.release();
  }
}

module.exports = { runDmrLogbookImport, DmrColumnValidationError };
