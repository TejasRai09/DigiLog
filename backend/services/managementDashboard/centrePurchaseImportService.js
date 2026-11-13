const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../../config/mysql');
const { minMaxDates } = require('../../utils/excelDateUtils');
const {
  PURCHASE_FIELD_DEFS,
  findHeaderAndColumnMap,
  mapPurchaseRowFromMatrix,
} = require('./centreIndentPurchaseParser');
const { loadSeasonMappings } = require('./centreIndentPurchaseMeta');
const { loadGateCodeSet } = require('./gateCenterCodes');

const BATCH_SIZE = 1000;

async function loadExistingDates(conn) {
  const [rows] = await conn.query(
    'SELECT DISTINCT purchase_date AS d FROM centre_purchase_data WHERE purchase_date IS NOT NULL',
  );
  return new Set(rows.map((r) => String(r.d).slice(0, 10)));
}

/**
 * Import centre purchase Excel with append-by-date dedup (skip rows whose purchase_date already exists).
 * Dynamically resolves columns by name/alias regardless of shuffled column order.
 */
async function runCentrePurchaseImport({
  filePath,
  workbook,
  sheetIndex = 0,
  sheetName,
  onProgress,
  fileUploadId = null,
}) {
  if (!workbook && (!filePath || !fs.existsSync(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }

  const log = (stage, message, detail = {}) => {
    if (onProgress) onProgress(stage, detail, message);
  };

  log('read', 'Reading purchase sheet…');
  const wb = workbook || xlsx.readFile(filePath);
  const resolvedSheet = sheetName || wb.SheetNames[sheetIndex];
  if (!resolvedSheet || !wb.Sheets[resolvedSheet]) {
    throw new Error(`Workbook has no purchase sheet ("${sheetName || sheetIndex}").`);
  }

  const sheet = wb.Sheets[resolvedSheet];
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  log('validate', `Detecting and mapping columns for purchase sheet "${resolvedSheet}"…`);

  const { headerRowIndex, colMap } = findHeaderAndColumnMap(
    matrix,
    PURCHASE_FIELD_DEFS,
    `purchase sheet "${resolvedSheet}"`,
  );

  const totalDataRows = Math.max(0, matrix.length - (headerRowIndex + 1));
  log('parse', `Parsed ${totalDataRows} rows from purchase sheet "${resolvedSheet}" (header at row ${headerRowIndex + 1}).`);

  const conn = await pool.getConnection();
  let imported = 0;
  let skipped = 0;
  const fileDates = [];

  try {
    const existingDates = await loadExistingDates(conn);
    const seasonMappings = await loadSeasonMappings(conn);
    const gateCodes = await loadGateCodeSet(conn);
    log('dedup', `Found ${existingDates.size} existing purchase dates in DB.`);

    let batch = [];
    for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
      const row = matrix[i];
      if (!row || !row.some((c) => c != null && String(c).trim() !== '')) {
        continue;
      }

      const mapped = mapPurchaseRowFromMatrix(row, colMap, seasonMappings, gateCodes);
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
        fileUploadId || null,
      ]);

      if (batch.length >= BATCH_SIZE) {
        await conn.query(
          `INSERT INTO centre_purchase_data
           (code, center_name, purchase_date, indent_date, no_of_purchy, purchase_qty, category, unique_id, season_label, file_upload_id)
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
        `INSERT INTO centre_purchase_data
         (code, center_name, purchase_date, indent_date, no_of_purchy, purchase_qty, category, unique_id, season_label, file_upload_id)
         VALUES ?`,
        [batch],
      );
      imported += batch.length;
    }

    const { min, max } = minMaxDates(fileDates);
    log('complete', `Imported ${imported} rows, skipped ${skipped}.`, {
      imported,
      skipped,
      dateMin: min,
      dateMax: max,
    });

    return { imported, skipped, dateMin: min, dateMax: max, totalRows: totalDataRows };
  } finally {
    conn.release();
  }
}

module.exports = { runCentrePurchaseImport };
