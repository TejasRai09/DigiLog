const fs = require('fs');
const xlsx = require('xlsx');
const { runCentreIndentImport } = require('./centreIndentImportService');
const { runCentrePurchaseImport } = require('./centrePurchaseImportService');

function combineDateRange(a = {}, b = {}) {
  const mins = [a.dateMin, b.dateMin].filter(Boolean).sort();
  const maxs = [a.dateMax, b.dateMax].filter(Boolean).sort();
  return {
    dateMin: mins[0] || null,
    dateMax: maxs.length ? maxs[maxs.length - 1] : null,
  };
}

/**
 * One workbook: 1st sheet = centre indent, 2nd sheet = centre purchase.
 */
async function runCentreIndentPurchaseImport({ filePath, onProgress }) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const log = (stage, message, detail = {}) => {
    if (onProgress) onProgress(stage, detail, message);
  };

  log('read', 'Reading indent + purchase workbook…');
  const wb = xlsx.readFile(filePath);
  if (wb.SheetNames.length < 2) {
    throw new Error(
      'Workbook must have 2 sheets: 1st sheet = indent data, 2nd sheet = purchase data.',
    );
  }

  log('read', `Sheets: 1) "${wb.SheetNames[0]}" (indent), 2) "${wb.SheetNames[1]}" (purchase).`);

  const indent = await runCentreIndentImport({
    filePath,
    workbook: wb,
    sheetIndex: 0,
    onProgress,
  });

  const purchase = await runCentrePurchaseImport({
    filePath,
    workbook: wb,
    sheetIndex: 1,
    onProgress,
  });

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
