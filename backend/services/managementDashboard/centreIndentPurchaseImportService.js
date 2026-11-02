const fs = require('fs');
const xlsx = require('xlsx');
const { pool } = require('../../config/mysql');
const { runCentreIndentImport } = require('./centreIndentImportService');
const { runCentrePurchaseImport } = require('./centrePurchaseImportService');
const { backfillSeasonLabels } = require('./centreIndentPurchaseMeta');
const { resolveIndentAndPurchaseSheets } = require('./centreIndentPurchaseParser');

function combineDateRange(a = {}, b = {}) {
  const mins = [a.dateMin, b.dateMin].filter(Boolean).sort();
  const maxs = [a.dateMax, b.dateMax].filter(Boolean).sort();
  return {
    dateMin: mins[0] || null,
    dateMax: maxs.length ? maxs[maxs.length - 1] : null,
  };
}

/**
 * One workbook: automatically identifies indent sheet and purchase sheet,
 * handles shuffled columns and sheets, and imports into centre_indent_data and centre_purchase_data.
 */
async function runCentreIndentPurchaseImport({ filePath, onProgress, fileUploadId = null }) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const log = (stage, message, detail = {}) => {
    if (onProgress) onProgress(stage, detail, message);
  };

  log('read', 'Reading indent + purchase workbook…');
  const wb = xlsx.readFile(filePath);

  const { indentSheet, purchaseSheet } = resolveIndentAndPurchaseSheets(wb);
  log('read', `Resolved sheets: indent -> "${indentSheet}", purchase -> "${purchaseSheet}".`);

  const indent = await runCentreIndentImport({
    filePath,
    workbook: wb,
    sheetName: indentSheet,
    onProgress,
    fileUploadId,
  });

  const purchase = await runCentrePurchaseImport({
    filePath,
    workbook: wb,
    sheetName: purchaseSheet,
    onProgress,
    fileUploadId,
  });

  const conn = await pool.getConnection();
  try {
    await backfillSeasonLabels(conn);
  } finally {
    conn.release();
  }

  const { dateMin, dateMax } = combineDateRange(indent, purchase);
  const imported = (indent.imported || 0) + (purchase.imported || 0);
  const skipped = (indent.skipped || 0) + (purchase.skipped || 0);

  log('complete', `Indent + purchase imported ${imported} rows, skipped ${skipped}.`, {
    imported,
    skipped,
    dateMin,
    dateMax,
    indent,
    purchase,
  });

  return {
    imported,
    skipped,
    dateMin,
    dateMax,
    totalRows: (indent.totalRows || 0) + (purchase.totalRows || 0),
    indent,
    purchase,
  };
}

module.exports = { runCentreIndentPurchaseImport };
