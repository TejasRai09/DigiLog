/**
 * Import Purchy BI data into purchy_* tables (streaming — low memory).
 *
 * Grower workbook sheets (Grower Details Season 2025-2026.xlsx):
 *   - Grower  Wise summary
 *   - Grower Purchy wise Indent
 *   - Grower Indent Purchy wise suppl
 *   - Grower Purchy wise Indent Faile
 *
 * Staff workbook (Staff wise Bonding target.xlsx): Main
 *
 * Usage:
 *   cd backend
 *   npm run db:import-purchy-grower -- --file uploads/data-ingestion/<filename>.xlsx
 *   npm run db:import-purchy-grower -- --file grower.xlsx --staff-file staff.xlsx
 *   npm run db:import-purchy-grower -- --staff-only --staff-file staff.xlsx
 *   npm run db:import-purchy-grower -- --csv-dir ./exports/
 *   npm run db:import-purchy-grower -- --csv-dir ./exports/ --dry-run
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/mysql');
const {
  streamGrowerWorkbook,
  streamGrowerCsvDir,
  streamStaffWorkbook,
  streamStaffCsv,
  resolveCsvFile,
} = require('../utils/purchyExcelStream');

const BATCH = 500;
const startedAt = Date.now();

const TABLE_MAP = {
  summary: { table: 'purchy_grower_summary', label: 'purchy_grower_summary' },
  indent: { table: 'purchy_indent', label: 'purchy_indent' },
  supply: { table: 'purchy_supply', label: 'purchy_supply' },
  dishonour: { table: 'purchy_dishonour', label: 'purchy_dishonour' },
  staff: { table: 'purchy_field_staff', label: 'purchy_field_staff' },
};

const SUMMARY_COLS = [
  'village_code', 'grower_code', 'grower_name', 'grower_father_name', 'village_name',
  'centre_code', 'centre_name', 'supply_centre_code', 'supply_centre_name',
  'society_code', 'society_name', 'cul_area', 'survey_area', 'bond_area',
  'basic_quota', 'bonding', 'ad_bonding', 'total_bond', 'no_of_purchy_indent',
  'indent_qty', 'no_of_weight_purchy', 'weight_qty_2025',
  'supply_2024', 'supply_2023', 'supply_2022', 'supply_2021', 'supply_2020',
  'no_of_balance_purchy', 'balance_indent_qty', 'no_of_indent_failer_purchy', 'indent_failer_qty',
  'issue24', 'indqty24', 'wt24', 'supp2024', 'bquota2024', 'bond2024',
  'issue23', 'indqty23', 'wt23', 'supp2023', 'bquota2023', 'bond2023',
  'issue22', 'indqty22', 'wt22', 'supp2022', 'bquota2022', 'bond2022',
  'issue21', 'indqty21', 'wt21', 'supp2021', 'bquota2021', 'bond2021', 'standing_bond',
];

const INDENT_COLS = [
  'villagecode', 'growercode', 'growername', 'growerfather', 'villagename', 'societyname',
  'supplycentre', 'supplycentrename', 'societypurchy_no', 'issuedate', 'supplydate',
  'varietytype', 'supllymodeqty', 'supplymodecode', 'supplymodename',
];

const SUPPLY_COLS = [
  'villagecode', 'growercode', 'growername', 'growerfather', 'villagename',
  'purchsecentre', 'purchsecentrename', 'supplycentrecode', 'supplycentrename',
  'societypurchy_no', 'supplydate', 'millpurchy_no', 'purchasedate',
  'purchasemodecode', 'purchasemodename', 'varietytype', 'varietycode', 'varietyname',
  'grossweight', 'tareweight', 'joonaweight', 'netwt', 'societycode', 'societyname', 'purchasemodeqty',
];

const DISHONOUR_COLS = [
  'sl_no', 'village_code', 'grower_code', 'grower_name', 'grower_father_name',
  'society_name', 'center_name', 'village_name', 'mobile_no', 'issue_date', 'purchase_date',
  'society_purchy_no', 'mode_qty', 'purchasemodecode', 'purchasemodename', 'remarks',
];

const STAFF_COLS = [
  'village_code', 'village_name', 'village_staff', 'zonal_incharge', 'zonal_manager',
  'region', 'zone_head', 'sum_of_survey_area', 'bonding_area', 'basic_quota',
  'bonding', 'additinalbond', 'yield_per_ha', 'drwal_per_ha', 'target_estimated_cane_availbility',
];

const COLS_BY_KEY = {
  summary: SUMMARY_COLS,
  indent: INDENT_COLS,
  supply: SUPPLY_COLS,
  dishonour: DISHONOUR_COLS,
  staff: STAFF_COLS,
};

function elapsed() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function log(msg) {
  console.log(`[${elapsed()}] ${msg}`);
}

function createImportProgress() {
  return (stage, detail = {}) => {
    switch (stage) {
      case 'file_start':
        log(`Source: ${detail.path}${detail.sizeMb ? ` (${detail.sizeMb} MB)` : ''}${detail.mode ? ` [${detail.mode}]` : ''}`);
        break;
      case 'workbook_read_start':
        log('Streaming workbook (one sheet at a time)…');
        break;
      case 'workbook_read_done':
        log(`Sheets seen: ${detail.sheets} — ${(detail.names || []).join(', ')}`);
        break;
      case 'sheet_read':
        log(`  Reading "${detail.sheet}"…`);
        break;
      case 'sheet_read_done':
        log(`  "${detail.sheet}" scanned — ${detail.rows.toLocaleString()} data rows`);
        break;
      case 'parse_start':
        log(`  Parsing ${detail.sheet}…`);
        break;
      case 'parse_progress':
        process.stdout.write(
          `\r[${elapsed()}]   ${detail.sheet}: ${detail.processed.toLocaleString()} rows scanned — kept ${detail.kept.toLocaleString()}   `,
        );
        break;
      case 'parse_done':
        process.stdout.write('\n');
        log(`  ${detail.sheet} complete — ${detail.rows.toLocaleString()} rows imported`);
        break;
      case 'workbook_parse_done':
        log(`Stream parse complete — summary=${detail.summary.toLocaleString()}, indent=${detail.indent.toLocaleString()}, supply=${detail.supply.toLocaleString()}, dishonour=${detail.dishonour.toLocaleString()}`);
        break;
      default:
        break;
    }
  };
}

function parseArgs(argv) {
  const opts = {
    file: null,
    csvDir: null,
    staffFile: null,
    staffCsv: null,
    staffOnly: false,
    dryRun: false,
    batchSize: BATCH,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') opts.file = argv[++i];
    else if (a === '--csv-dir') opts.csvDir = argv[++i];
    else if (a === '--staff-file') opts.staffFile = argv[++i];
    else if (a === '--staff-csv') opts.staffCsv = argv[++i];
    else if (a === '--staff-only') opts.staffOnly = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--batch-size') opts.batchSize = Number(argv[++i]) || BATCH;
  }
  return opts;
}

async function truncateStaffTable(conn) {
  log('Truncating purchy_field_staff…');
  await conn.query('TRUNCATE TABLE purchy_field_staff');
  log('Staff table truncated.');
}

async function truncateTables(conn) {
  log('Truncating purchy_* tables…');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE purchy_grower_summary');
  await conn.query('TRUNCATE TABLE purchy_indent');
  await conn.query('TRUNCATE TABLE purchy_supply');
  await conn.query('TRUNCATE TABLE purchy_dishonour');
  await conn.query('TRUNCATE TABLE purchy_field_staff');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  log('Tables truncated.');
}

async function insertChunk(conn, table, columns, rows) {
  if (!rows.length) return 0;
  const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`;
  const params = rows.flatMap((row) => columns.map((c) => row[c] ?? null));
  const [result] = await conn.query(sql, params);
  return result.affectedRows;
}

function createBatchHandler(conn, opts, totals, batchCounters) {
  return async (sheetKey, rows) => {
    if (!rows.length) return;
    const meta = TABLE_MAP[sheetKey];
    const columns = COLS_BY_KEY[sheetKey];
    if (!meta || !columns) throw new Error(`Unknown sheet key: ${sheetKey}`);

    if (opts.dryRun) {
      totals[sheetKey] = (totals[sheetKey] || 0) + rows.length;
      return;
    }

    const inserted = await insertChunk(conn, meta.table, columns, rows);
    totals[sheetKey] = (totals[sheetKey] || 0) + inserted;
    batchCounters[sheetKey] = (batchCounters[sheetKey] || 0) + 1;
    process.stdout.write(
      `\r[${elapsed()}]   ${meta.label}: ${totals[sheetKey].toLocaleString()} rows inserted (batch ${batchCounters[sheetKey]})   `,
    );
  };
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
  Options: --dry-run  --batch-size 500`);
    process.exit(1);
  }

  if (opts.file) {
    const growerPath = path.resolve(opts.file);
    if (!fs.existsSync(growerPath)) {
      console.error(`File not found: ${growerPath}`);
      process.exit(1);
    }
  }

  if (opts.csvDir) {
    const csvDir = path.resolve(opts.csvDir);
    if (!fs.existsSync(csvDir)) {
      console.error(`CSV directory not found: ${csvDir}`);
      process.exit(1);
    }
  }

  log(opts.staffOnly ? '=== Purchy staff import (streaming) ===' : '=== Purchy grower import (streaming) ===');
  if (opts.dryRun) log('Dry run — parse + count only, no database writes.');

  const onProgress = createImportProgress();
  const totals = {};
  const batchCounters = {};

  let conn = null;
  if (!opts.dryRun) {
    conn = await pool.getConnection();
    if (opts.staffOnly) {
      await truncateStaffTable(conn);
    } else {
      await truncateTables(conn);
    }
  }

  const onBatch = createBatchHandler(conn, opts, totals, batchCounters);

  try {
    const streamOpts = {
      batchSize: opts.batchSize,
      onProgress,
      onBatch,
    };

    if (!opts.staffOnly) {
      if (opts.csvDir) {
        await streamGrowerCsvDir(path.resolve(opts.csvDir), streamOpts);
      } else {
        await streamGrowerWorkbook(path.resolve(opts.file), streamOpts);
      }
    }

    if (opts.staffCsv) {
      const staffCsvPath = path.resolve(opts.staffCsv);
      if (!fs.existsSync(staffCsvPath)) {
        throw new Error(`Staff CSV not found: ${staffCsvPath}`);
      }
      await streamStaffCsv(staffCsvPath, streamOpts);
    } else if (opts.staffFile) {
      const staffPath = path.resolve(opts.staffFile);
      if (!fs.existsSync(staffPath)) {
        throw new Error(`Staff file not found: ${staffPath}`);
      }
      await streamStaffWorkbook(staffPath, streamOpts);
    } else if (opts.csvDir && resolveCsvFile(path.resolve(opts.csvDir), 'staff')) {
      await streamStaffCsv(resolveCsvFile(path.resolve(opts.csvDir), 'staff'), streamOpts);
    }

    process.stdout.write('\n');
    log(`=== Import complete (${elapsed()}) ===`);
    log([
      `summary=${(totals.summary || 0).toLocaleString()}`,
      `indent=${(totals.indent || 0).toLocaleString()}`,
      `supply=${(totals.supply || 0).toLocaleString()}`,
      `dishonour=${(totals.dishonour || 0).toLocaleString()}`,
      `staff=${(totals.staff || 0).toLocaleString()}`,
    ].join(', '));

    if (!opts.dryRun && !totals.staff) {
      console.warn('No staff mapping imported — Page 2 staff slicers will be empty until --staff-file or staff CSV is provided.');
    }
  } finally {
    if (conn) {
      conn.release();
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error(`\n[${elapsed()}] Import failed:`, err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
