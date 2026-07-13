/**
 * Import ALL Power Logbook Excel files from a folder in one run.
 *
 * Scans for every .xlsx / .xls / .xlsm and imports each file:
 *   - Single-sheet file → form detected from filename (power / steam / stoppage)
 *   - Multi-sheet workbook → sheets named Power, Steam, Stoppage (etc.)
 *
 * Default folders (in order):
 *   1. backlog-data/power data/   ← primary GSMA backlog location
 *   2. scripts/data_feed_power_logbook/feed-data/
 *
 * Usage (from backend/):
 *   npm run db:import-power-logbook:xlsx-all
 *   npm run db:import-power-logbook:xlsx-all -- --dry-run
 *   npm run db:import-power-logbook:xlsx-all:truncate
 *   npm run db:import-power-logbook:xlsx-all -- --dir "backlog-data/power data"
 *   npm run db:import-power-logbook:xlsx-all -- --scan-uploads
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { DATABASE_URL } = require('../../config/env');
const { pool } = require('../../config/mysql');
const {
  ALL_FORM_KEYS,
  listExcelFilesInDir,
  resolveAllXlsxFiles,
  runPowerLogbookImport,
} = require('./powerLogbookFeedLib');

const FEED_DIR = path.join(__dirname, 'feed-data');
const BACKLOG_DIR = path.join(__dirname, '..', '..', 'backlog-data', 'power data');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'data-ingestion');

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    truncate: false,
    truncateOnce: true,
    skipUnknown: true,
    dir: null,
    scanUploads: false,
    forms: [...ALL_FORM_KEYS],
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--truncate') opts.truncate = true;
    else if (a === '--scan-uploads') opts.scanUploads = true;
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--form') {
      const raw = String(argv[++i] || '').toLowerCase();
      if (raw === 'all') {
        opts.forms = [...ALL_FORM_KEYS];
      } else if (ALL_FORM_KEYS.includes(raw)) {
        opts.forms = [raw];
      } else {
        throw new Error(`Unknown --form "${raw}". Use power, steam, stoppage, or all.`);
      }
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/data_feed_power_logbook/import-power-logbook-xlsx-all.js [options]

Loads every Excel file (.xlsx/.xls/.xlsm) from the power logbook feed folder.

Options:
  --dir <path>                      Folder to scan (default: backlog-data/power data + feed-data)
  --scan-uploads                    Also scan uploads/data-ingestion (power/steam/stoppage filenames)
  --form <power|steam|stoppage|all> Import filter (default: all)
  --truncate                        Truncate target tables once, then import all files
  --dry-run                         Parse and count only; no DB writes

Examples:
  npm run db:import-power-logbook:xlsx-all
  npm run db:import-power-logbook:xlsx-all:truncate
  npm run db:import-power-logbook:xlsx-all -- --scan-uploads
  npm run db:import-power-logbook:xlsx-all -- --dir uploads/data-ingestion
`);
      process.exit(0);
    }
  }

  if (opts.truncate) opts.truncateOnce = true;
  return opts;
}

function resolveSearchDirs(opts) {
  if (opts.dir) {
    const dir = path.isAbsolute(opts.dir) ? opts.dir : path.resolve(process.cwd(), opts.dir);
    if (!fs.existsSync(dir)) {
      throw new Error(`Directory not found: ${dir}`);
    }
    return [{ dir, nameFilter: true }];
  }
  const dirs = [
    { dir: BACKLOG_DIR, nameFilter: true },
    { dir: FEED_DIR, nameFilter: false },
  ];
  if (opts.scanUploads) dirs.push({ dir: UPLOADS_DIR, nameFilter: true });
  return dirs;
}

function resolveFiles(opts) {
  const searchDirs = resolveSearchDirs(opts);
  const seenPaths = new Set();
  const seenBasenames = new Set();
  const files = [];

  for (const { dir, nameFilter } of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fp of resolveAllXlsxFiles([dir], { nameFilter })) {
      const key = path.resolve(fp).toLowerCase();
      if (seenPaths.has(key)) continue;
      const baseKey = path.basename(fp).toLowerCase();
      if (seenBasenames.has(baseKey)) continue;
      seenPaths.add(key);
      seenBasenames.add(baseKey);
      files.push(fp);
    }
  }

  files.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: 'base' }));
  return {
    searchDirs: searchDirs.map((d) => d.dir).filter((dir) => fs.existsSync(dir)),
    files,
  };
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!DATABASE_URL) {
    console.error('DATABASE_URL or MYSQL_* is not set in backend/.env');
    process.exit(1);
  }

  const { searchDirs, files } = resolveFiles(opts);

  if (!files.length) {
    throw new Error(
      `No Excel files found in:\n  ${searchDirs.join('\n  ')}\n`
      + 'Add power_details.xlsx, steam_details.xlsx, stopage_details.xlsx to backlog-data/power data/.',
    );
  }

  const mode = opts.dryRun ? 'DRY RUN' : 'LIVE';
  const truncateNote = opts.truncate ? ', TRUNCATE tables once first' : '';

  console.log(`Power Logbook XLSX batch import — ${mode}${truncateNote}`);
  console.log(`Scan dirs: ${searchDirs.join(', ')}`);
  console.log(`Forms: ${opts.forms.join(', ')}`);
  console.log(`Files (${files.length}): ${files.map((f) => path.basename(f)).join(', ')}\n`);

  const conn = await pool.getConnection();

  try {
    const total = await runPowerLogbookImport(conn, files, {
      ...opts,
      truncate: opts.truncate,
      truncateOnce: opts.truncate,
    });

    if (opts.dryRun) {
      console.log(`\nDry run complete. Total rows would insert: ${total}`);
    } else {
      console.log(`\nDone. Total rows inserted: ${total}`);
    }
  } catch (err) {
    console.error('\nImport failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
