const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../../config/mysql');
const { minMaxDates } = require('../../utils/excelDateUtils');
const {
  INDENT_FIELD_DEFS,
  findHeaderAndColumnMap,
  mapIndentRowFromMatrix,
} = require('./centreIndentPurchaseParser');
const { loadSeasonMappings } = require('./centreIndentPurchaseMeta');
const { loadGateCodeSet } = require('./gateCenterCodes');

const BATCH_SIZE = 1000;

async function loadExistingDates(conn, dateCol) {
  const [rows] = await conn.query(
    `SELECT DISTINCT \`${dateCol}\` AS d FROM centre_indent_data WHERE \`${dateCol}\` IS NOT NULL`,
  );
  return new Set(rows.map((r) => String(r.d).slice(0, 10)));
}

/**
 * Import centre indent Excel with append-by-date dedup (skip rows whose indent_date already exists).
 * Dynamically resolves columns by name/alias regardless of shuffled column order.
 */
async function runCentreIndentImport({
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

  log('read', 'Reading indent sheet…');
  const wb = workbook || xlsx.readFile(filePath);
  const resolvedSheet = sheetName || wb.SheetNames[sheetIndex];
  if (!resolvedSheet || !wb.Sheets[resolvedSheet]) {
    throw new Error(`Workbook has no indent sheet ("${sheetName || sheetIndex}").`);
  }

  const sheet = wb.Sheets[resolvedSheet];
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  log('validate', `Detecting and mapping columns for indent sheet "${resolvedSheet}"…`);

  const { headerRowIndex, colMap } = findHeaderAndColumnMap(
    matrix,
    INDENT_FIELD_DEFS,
    `indent sheet "${resolvedSheet}"`,
  );

  const totalDataRows = Math.max(0, matrix.length - (headerRowIndex + 1));
  log('parse', `Parsed ${totalDataRows} rows from indent sheet "${resolvedSheet}" (header at row ${headerRowIndex + 1}).`);

  const conn = await pool.getConnection();
  let imported = 0;
  let skipped = 0;
  const fileDates = [];

  try {
    const existingDates = await loadExistingDates(conn, 'indent_date');
    const seasonMappings = await loadSeasonMappings(conn);
    const gateCodes = await loadGateCodeSet(conn);
    log('dedup', `Found ${existingDates.size} existing indent dates in DB.`);

    let batch = [];
    for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
      const row = matrix[i];
      if (!row || !row.some((c) => c != null && String(c).trim() !== '')) {
        continue;
      }

      const mapped = mapIndentRowFromMatrix(row, colMap, seasonMappings, gateCodes);
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
        fileUploadId || null,
      ]);

      if (batch.length >= BATCH_SIZE) {
        await conn.query(
          `INSERT INTO centre_indent_data
           (code, center_name, indent_date, no_of_purchy, indent_qty, category, unique_id, bonding_id, season_label, file_upload_id)
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
         (code, center_name, indent_date, no_of_purchy, indent_qty, category, unique_id, bonding_id, season_label, file_upload_id)
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

module.exports = { runCentreIndentImport };
