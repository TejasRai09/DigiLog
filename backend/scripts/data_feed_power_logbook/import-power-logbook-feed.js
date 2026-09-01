/**
 * Import Power Logbook data into ph_power, ph_steam, ph_stoppage.
 *
 * Supports semicolon CSV (DB column headers), Excel (.xlsx/.xls), or JSON feed files.
 *
 * Default CSV layout (place in feed-data/ or use backlog-data/power data/):
 *   power_details.csv    → ph_power
 *   steam_details.csv    → ph_steam
 *   stoppage_details.csv → ph_stoppage
 *
 * JSON shape:
 *   { "power": [...], "steam": [...], "stoppage": [...] }
 *   or { "forms": { "power": [...], "steam": [...] } }
 *
 * Usage (from backend/):
 *   npm run db:import-power-logbook
 *   npm run db:import-power-logbook -- --dry-run
 *   npm run db:import-power-logbook -- --truncate
 *   npm run db:import-power-logbook -- --form power --file feed-data/power_details.csv
 *   npm run db:import-power-logbook -- --file path/to/feed.json
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { DATABASE_URL } = require('../../config/env');
const { pool } = require('../../config/mysql');
const {
  ALL_FORM_KEYS,
  importFeedFile,
  resolveDefaultFiles,
} = require('./powerLogbookFeedLib');

const FEED_DIR = path.join(__dirname, 'feed-data');
const BACKLOG_DIR = path.join(__dirname, '..', '..', 'backlog-data', 'power data');

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    truncate: false,
    file: null,
    dir: null,
    forms: [...ALL_FORM_KEYS],
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--truncate') opts.truncate = true;
    else if (a === '--file') opts.file = argv[++i];
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
      console.log(`Usage: node scripts/data_feed_power_logbook/import-power-logbook-feed.js [options]

Imports Power Logbook rows into ph_power, ph_steam, ph_stoppage.

Options:
  --form <power|steam|stoppage|all>   Form(s) to import (default: all)
  --file <path>                       Single CSV, XLSX, or JSON feed file
  --dir <path>                        Directory with default CSV filenames
  --truncate                          Truncate target table(s) before insert
  --dry-run                           Parse and count only; no DB writes

Defaults:
  Feed dir:    scripts/data_feed_power_logbook/feed-data/
  Fallback:    backlog-data/power data/
`);
      process.exit(0);
    }
  }

  return opts;
}

function resolveFiles(opts) {
  if (opts.file) {
    const filePath = path.isAbsolute(opts.file)
      ? opts.file
      : path.resolve(process.cwd(), opts.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Feed file not found: ${filePath}`);
    }
    return [filePath];
  }

  const feedDir = opts.dir
    ? (path.isAbsolute(opts.dir) ? opts.dir : path.resolve(process.cwd(), opts.dir))
    : FEED_DIR;

  const entries = resolveDefaultFiles(feedDir, BACKLOG_DIR, opts.forms);
  const missing = entries.filter((e) => e.missing);
  if (missing.length === entries.length) {
    throw new Error(
      `No feed files found in ${feedDir} or ${BACKLOG_DIR}. `
      + 'Add power_details.csv, steam_details.csv, stoppage_details.csv or pass --file.',
    );
  }

  for (const m of missing) {
    console.warn(`⚠️  Missing: ${m.path}`);
  }

  return entries.filter((e) => !e.missing).map((e) => e.path);
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!DATABASE_URL) {
    console.error('DATABASE_URL or MYSQL_* is not set in backend/.env');
    process.exit(1);
  }

  const files = resolveFiles(opts);
  const mode = opts.dryRun ? 'DRY RUN' : 'LIVE';
  const truncateNote = opts.truncate ? ', TRUNCATE first' : '';

  console.log(`Power Logbook feed — ${mode}${truncateNote}`);
  console.log(`Forms: ${opts.forms.join(', ')}`);
  console.log(`Files: ${files.map((f) => path.basename(f)).join(', ')}\n`);

  const conn = await pool.getConnection();
  const columnCache = new Map();
  let total = 0;

  try {
    for (const filePath of files) {
      console.log(`→ ${filePath}`);
      const result = await importFeedFile(conn, filePath, opts, columnCache);
      total += result.inserted || 0;
    }

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
