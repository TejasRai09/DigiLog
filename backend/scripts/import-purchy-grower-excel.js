/**
 * Import Purchy BI data into purchy_* tables (streaming — low memory).
 *
 * Grower workbook sheets (Grower Details Season 2025-2026.xlsx):
 *   - Grower  Wise summary
 *   - Grower Purchy wise Indent
 *   - Grower Indent Purchy wise suppl
 *   - Grower Purchy wise Indent Faile
 *
 * Staff workbook (Staff wise Bonding target.xlsx): Main / Sheet1
 *
 * Usage:
 *   cd backend
 *   npm run db:import-purchy-grower -- --file uploads/data-ingestion/<filename>.xlsx
 *   npm run db:import-purchy-grower -- --staff-only --staff-file staff.xlsx
 *
 * Auto-import on upload: Data Ingestion Center detects grower/staff filenames
 * and runs import in background (see utils/purchyUploadSync.js).
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/mysql');
const { runPurchyGrowerImport } = require('../services/purchy/purchyGrowerImportService');

const startedAt = Date.now();

function elapsed() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function log(msg) {
  console.log(`[${elapsed()}] ${msg}`);
}

function parseArgs(argv) {
  const opts = {
    file: null,
    csvDir: null,
    staffFile: null,
    staffCsv: null,
    staffOnly: false,
    dryRun: false,
    batchSize: 500,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') opts.file = argv[++i];
    else if (a === '--csv-dir') opts.csvDir = argv[++i];
    else if (a === '--staff-file') opts.staffFile = argv[++i];
    else if (a === '--staff-csv') opts.staffCsv = argv[++i];
    else if (a === '--staff-only') opts.staffOnly = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--batch-size') opts.batchSize = Number(argv[++i]) || 500;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.staffOnly) {
    if (!opts.staffFile && !opts.staffCsv) {
      console.error('Usage: node scripts/import-purchy-grower-excel.js --staff-only --staff-file <staff.xlsx>');
      process.exit(1);
    }
  } else if (!opts.file && !opts.csvDir) {
    console.error(`Usage:
  node scripts/import-purchy-grower-excel.js --file <grower.xlsx> [--staff-file staff.xlsx]
  node scripts/import-purchy-grower-excel.js --staff-only --staff-file <staff.xlsx>
  node scripts/import-purchy-grower-excel.js --csv-dir <dir> [--staff-csv staff.csv]
  Options: --batch-size 500`);
    process.exit(1);
  }

  if (opts.file && !fs.existsSync(path.resolve(opts.file))) {
    console.error(`File not found: ${path.resolve(opts.file)}`);
    process.exit(1);
  }

  if (opts.csvDir) {
    console.error('CSV import: use streamGrowerCsvDir via extended CLI or upload xlsx via Data Ingestion.');
    process.exit(1);
  }

  log(opts.staffOnly ? '=== Purchy staff import ===' : '=== Purchy grower import ===');

  try {
    const result = await runPurchyGrowerImport({
      filePath: opts.staffOnly ? undefined : path.resolve(opts.file),
      staffFilePath: opts.staffFile ? path.resolve(opts.staffFile) : undefined,
      staffOnly: opts.staffOnly,
      batchSize: opts.batchSize,
      onProgress: (_stage, _detail, message) => log(message),
    });

    if (opts.staffCsv) {
      log('Parallel staff CSV not combined in this run — import staff xlsx separately.');
    }

    const t = result.totals;
    log(`=== Import complete (${elapsed()}) ===`);
    log([
      `summary=${(t.summary || 0).toLocaleString()}`,
      `indent=${(t.indent || 0).toLocaleString()}`,
      `supply=${(t.supply || 0).toLocaleString()}`,
      `dishonour=${(t.dishonour || 0).toLocaleString()}`,
      `staff=${(t.staff || 0).toLocaleString()}`,
    ].join(', '));

    if (!t.staff && !opts.staffOnly) {
      console.warn('No staff mapping imported — upload staff Excel via Data Ingestion or use --staff-file.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`\n[${elapsed()}] Import failed:`, err.message);
  process.exit(1);
});
