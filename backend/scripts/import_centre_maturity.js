/**
 * Centre Maturity indent + purchase Excel → MySQL (append-by-date dedup)
 *
 *   node scripts/import_centre_maturity.js
 *   node scripts/import_centre_maturity.js --file=/path/indent-purchase.xlsx
 *   node scripts/import_centre_maturity.js --indent=/path/indent.xlsx --purchase=/path/purchase.xlsx
 *
 * Combined file: 1st sheet = indent, 2nd sheet = purchase.
 */

const fs = require('fs');
const path = require('path');
const { runCentreIndentImport } = require('../services/managementDashboard/centreIndentImportService');
const { runCentrePurchaseImport } = require('../services/managementDashboard/centrePurchaseImportService');
const { runCentreIndentPurchaseImport } = require('../services/managementDashboard/centreIndentPurchaseImportService');

const DATA_DIR = path.join(__dirname, '..', 'backlog-data', 'Center maturity');

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function resolveDataFile(relOrAbs) {
  if (!relOrAbs) return null;
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.resolve(__dirname, '..', relOrAbs);
}

function requireFile(filePath, label) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} not found: ${filePath}\n` +
        'Place a two-sheet workbook under backlog-data/Center maturity/ or pass --file= / --indent= / --purchase=.',
    );
  }
  return filePath;
}

async function runImport() {
  const combinedPath =
    resolveDataFile(argValue('--file=')) ||
    (fs.existsSync(path.join(DATA_DIR, 'indent-purchase.xlsx'))
      ? path.join(DATA_DIR, 'indent-purchase.xlsx')
      : null);

  const indentArg = argValue('--indent=');
  const purchaseArg = argValue('--purchase=');

  console.log('Starting Centre Maturity import (append-by-date, skip existing dates)…');

  if (combinedPath && !indentArg && !purchaseArg) {
    const filePath = requireFile(combinedPath, 'indent-purchase.xlsx');
    console.log(`   file: ${filePath} (1st sheet indent, 2nd sheet purchase)`);
    const r = await runCentreIndentPurchaseImport({
      filePath,
      onProgress: (_stage, _detail, msg) => console.log(`   ${msg}`),
    });
    console.log(`   indent   → imported ${r.indent.imported}, skipped ${r.indent.skipped}`);
    console.log(`   purchase → imported ${r.purchase.imported}, skipped ${r.purchase.skipped}`);
    console.log('Done.');
    process.exit(0);
    return;
  }

  const indentPath = requireFile(
    resolveDataFile(indentArg) || path.join(DATA_DIR, 'indent1.xlsx'),
    'indent1.xlsx',
  );
  const purchasePath = requireFile(
    resolveDataFile(purchaseArg) || path.join(DATA_DIR, 'purchase2.xlsx'),
    'purchase2.xlsx',
  );

  if (indentPath) {
    console.log(`   indent:   ${indentPath}`);
    const r = await runCentreIndentImport({
      filePath: indentPath,
      onProgress: (_stage, _detail, msg) => console.log(`   ${msg}`),
    });
    console.log(`   indent → imported ${r.imported}, skipped ${r.skipped}`);
  }

  if (purchasePath) {
    console.log(`   purchase: ${purchasePath}`);
    const r = await runCentrePurchaseImport({
      filePath: purchasePath,
      onProgress: (_stage, _detail, msg) => console.log(`   ${msg}`),
    });
    console.log(`   purchase → imported ${r.imported}, skipped ${r.skipped}`);
  }

  console.log('Done.');
  process.exit(0);
}

runImport().catch((err) => {
  console.error('Import error:', err);
  process.exit(1);
});
