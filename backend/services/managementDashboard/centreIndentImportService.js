const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../../config/mysql');
const { excelDateToISO, minMaxDates } = require('../../utils/excelDateUtils');
const { validateRequiredHeaders, headersFromSheet } = require('../../utils/excelColumnValidation');
const {
  pickStr,
  seasonLabelForDate,
  loadSeasonMappings,
} = require('./centreIndentPurchaseMeta');

const BATCH_SIZE = 1000;

/** Headers from cane_indent_2023-2025.xlsx / PBI Cane Indent. Extra columns are optional. */
const EXPECTED_HEADERS = [
  'Code',
  'Center Name',
  'Indent Date',
  'No of Purchy',
  'Qty in Qtls',
  'Category',
];

async function loadExistingDates(conn, dateCol) {
  const [rows] = await conn.query(
    `SELECT DISTINCT \`${dateCol}\` AS d FROM centre_indent_data WHERE \`${dateCol}\` IS NOT NULL`,
  );
  return new Set(rows.map((r) => String(r.d).slice(0, 10)));
}

function str(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

function num(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function mapIndentRow(r, seasonMappings = []) {
  const indent_date = excelDateToISO(r['Indent Date']);
  return {
    code: str(r['Code']),
    center_name: str(r['Center Name']),
    indent_date,
    no_of_purchy: r['No of Purchy'] != null && r['No of Purchy'] !== '' ? parseInt(r['No of Purchy'], 10) || 0 : 0,
    indent_qty: num(r['Qty in Qtls']),
    category: str(r['Category']),
    unique_id: pickStr(r, ['Unique ID', 'UniqueID', 'unique_id']),
    bonding_id: pickStr(r, ['Bonding Id', 'Bonding ID', 'bonding_id']),
    season_label:
      pickStr(r, ['SeasonLabelIndent', 'Season Label', 'SeasonLabel', 'season_label'])
      || seasonLabelForDate(indent_date, seasonMappings),
  };
}

/**
 * Import centre indent Excel with append-by-date dedup (skip rows whose indent_date already exists).
 */
async function runCentreIndentImport({ filePath, workbook, sheetIndex = 0, sheetName, onProgress }) {
  if (!workbook && (!filePath || !fs.existsSync(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }

  const log = (stage, message, detail = {}) => {
    if (onProgress) onProgress(stage, detail, message);
  };

  log('read', 'Reading indent sheet…');
  const wb = workbook || xlsx.readFile(filePath);
  const resolvedSheet = sheetName || wb.SheetNames[sheetIndex];
  if (!resolvedSheet) {
    throw new Error('Workbook has no indent sheet (1st sheet).');
  }

  log('validate', `Validating indent columns on sheet "${resolvedSheet}"…`);
  validateRequiredHeaders(headersFromSheet(wb, resolvedSheet), EXPECTED_HEADERS, 'indent sheet (1st sheet)');

  const rows = xlsx.utils.sheet_to_json(wb.Sheets[resolvedSheet]);
  log('parse', `Parsed ${rows.length} indent rows from sheet "${resolvedSheet}".`);

  const conn = await pool.getConnection();
  let imported = 0;
  let skipped = 0;
  const fileDates = [];

  try {
    const existingDates = await loadExistingDates(conn, 'indent_date');
    const seasonMappings = await loadSeasonMappings(conn);
    log('dedup', `Found ${existingDates.size} existing indent dates in DB.`);

    let batch = [];
    for (let i = 0; i < rows.length; i += 1) {
      const mapped = mapIndentRow(rows[i], seasonMappings);
      if (!mapped.indent_date) {
        skipped += 1;
        continue;
      }
      fileDates.push(mapped.indent_date);
      if (existingDates.has(mapped.indent_date)) {
        skipped += 1;
        continue;
      }

      batch.push([
        mapped.code,
        mapped.center_name,
        mapped.indent_date,
        mapped.no_of_purchy,
        mapped.indent_qty,
        mapped.category,
        mapped.unique_id,
        mapped.bonding_id,
        mapped.season_label,
      ]);

      if (batch.length >= BATCH_SIZE) {
        await conn.query(
          `INSERT INTO centre_indent_data
           (code, center_name, indent_date, no_of_purchy, indent_qty, category, unique_id, bonding_id, season_label)
           VALUES ?`,
          [batch],
        );
        imported += batch.length;
        batch = [];
        if (i % 5000 === 0) log('insert', `Inserted ${imported} rows…`);
      }
    }

    if (batch.length) {
      await conn.query(
        `INSERT INTO centre_indent_data
         (code, center_name, indent_date, no_of_purchy, indent_qty, category, unique_id, bonding_id, season_label)
         VALUES ?`,
        [batch],
      );
      imported += batch.length;
    }

    const { min, max } = minMaxDates(fileDates);
    log('complete', `Imported ${imported} rows, skipped ${skipped}.`, { imported, skipped, dateMin: min, dateMax: max });

    return { imported, skipped, dateMin: min, dateMax: max, totalRows: rows.length };
  } finally {
    conn.release();
  }
}

module.exports = { runCentreIndentImport };
