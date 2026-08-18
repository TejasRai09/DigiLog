const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../../config/mysql');
const { excelDateToISO, minMaxDates } = require('../../utils/excelDateUtils');
const { validateRequiredHeaders, headersFromSheet } = require('../../utils/excelColumnValidation');

const BATCH_SIZE = 1000;

/** Headers from cane_purchase_2023-2025.xlsx / PBI Cane Purchase. Extra columns are optional. */
const EXPECTED_HEADERS = [
  'c_Code',
  'Purchase Date',
  'No of Purchy',
  'Qty in Qtls',
  'Category',
  'Center',
];

async function loadExistingDates(conn) {
  const [rows] = await conn.query(
    'SELECT DISTINCT purchase_date AS d FROM centre_purchase_data WHERE purchase_date IS NOT NULL',
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

function mapPurchaseRow(r) {
  return {
    code: str(r['c_Code']),
    center_name: str(r['Center']),
    purchase_date: excelDateToISO(r['Purchase Date']),
    indent_date: excelDateToISO(r['Indent Date']),
    no_of_purchy: r['No of Purchy'] != null && r['No of Purchy'] !== '' ? parseInt(r['No of Purchy'], 10) || 0 : 0,
    purchase_qty: num(r['Qty in Qtls']),
    category: str(r['Category']),
    unique_id: str(r['Unique ID']),
    season_label: str(r['SeasonLabelPurchase']),
  };
}

async function runCentrePurchaseImport({ filePath, onProgress }) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const log = (stage, message, detail = {}) => {
    if (onProgress) onProgress(stage, detail, message);
  };

  log('read', 'Reading purchase workbook…');
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets.');

  log('validate', 'Validating column headers against purchase template…');
  validateRequiredHeaders(headersFromSheet(wb, sheetName), EXPECTED_HEADERS, 'centre purchase file');

  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
  log('parse', `Parsed ${rows.length} rows from sheet "${sheetName}".`);

  const conn = await pool.getConnection();
  let imported = 0;
  let skipped = 0;
  const fileDates = [];

  try {
    const existingDates = await loadExistingDates(conn);
    log('dedup', `Found ${existingDates.size} existing purchase dates in DB.`);

    let batch = [];
    for (let i = 0; i < rows.length; i += 1) {
      const mapped = mapPurchaseRow(rows[i]);
      if (!mapped.purchase_date) {
        skipped += 1;
        continue;
      }
      fileDates.push(mapped.purchase_date);
      if (existingDates.has(mapped.purchase_date)) {
        skipped += 1;
        continue;
      }

      batch.push([
        mapped.code,
        mapped.center_name,
        mapped.purchase_date,
        mapped.indent_date,
        mapped.no_of_purchy,
        mapped.purchase_qty,
        mapped.category,
        mapped.unique_id,
        mapped.season_label,
      ]);

      if (batch.length >= BATCH_SIZE) {
        await conn.query(
          `INSERT INTO centre_purchase_data
           (code, center_name, purchase_date, indent_date, no_of_purchy, purchase_qty, category, unique_id, season_label)
           VALUES ?`,
          [batch],
        );
        imported += batch.length;
        batch = [];
      }
    }

    if (batch.length) {
      await conn.query(
        `INSERT INTO centre_purchase_data
         (code, center_name, purchase_date, indent_date, no_of_purchy, purchase_qty, category, unique_id, season_label)
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

module.exports = { runCentrePurchaseImport };
