/**
 * Centre Maturity indent + purchase Excel → MySQL (append-by-date dedup)
 *
 *   node scripts/import_centre_maturity.js
 *   node scripts/import_centre_maturity.js --indent=/path/indent1.xlsx --purchase=/path/purchase2.xlsx
 */

const path = require('path');
const { runCentreIndentImport } = require('../services/managementDashboard/centreIndentImportService');
const { runCentrePurchaseImport } = require('../services/managementDashboard/centrePurchaseImportService');

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
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} not found: ${filePath}\n` +
        'Place files under backlog-data/Center maturity/ or pass --indent= / --purchase=.',
    );
  }
  return filePath;
}

async function runImport() {
  const indentPath = requireFile(
    resolveDataFile(argValue('--indent=')) || path.join(DATA_DIR, 'indent1.xlsx'),
    'indent1.xlsx',
  );
  const purchasePath = requireFile(
    resolveDataFile(argValue('--purchase=')) || path.join(DATA_DIR, 'purchase2.xlsx'),
    'purchase2.xlsx',
  );

  console.log('Starting Centre Maturity import (append-by-date, skip existing dates)…');

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
