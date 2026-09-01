/**
 * Import Power Plant Equipment History (new) feed data into ppn_* tables.
 *
 * Place JSON feed files in:
 *   scripts/data_feed_power_history/feed-data/
 *     - power_plant_feed.json   (recommended single file)
 *     - or multiple *.json files
 *
 * Each equipment record supports:
 *   name, equip_no, tag_name, category, subcategory, location, commissioned, drive,
 *   specs[], schedule[], history[]
 *
 * Spec rows may include section (mechanical | civil | instrument | electrical) and
 * sub_section. If section is omitted, specs default to mechanical.
 *
 * Usage (from backend/):
 *   npm run db:import-ppn-feed
 *   npm run db:import-ppn-feed -- --dry-run
 *   npm run db:import-ppn-feed -- --replace
 *   npm run db:import-ppn-feed -- --file scripts/data_feed_power_history/feed-data/my_feed.json
 *   npm run db:import-ppn-feed -- --file ../../../power_data.json --legacy
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../../config/mysql');
const { flattenFeedPayload, importPpnRecord } = require('./ppnFeedLib');

const FEED_DIR = path.join(__dirname, 'feed-data');
const DEFAULT_FEED = path.join(FEED_DIR, 'power_plant_feed.json');

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    replace: false,
    file: null,
    legacy: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--replace') opts.replace = true;
    else if (a === '--legacy') opts.legacy = true;
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/data_feed_power_history/import-ppn-feed.js [options]

Imports equipment into ppn_equipment, ppn_specs, ppn_oem_schedule, ppn_history.
All equipment uses dept = 'plant'.

Options:
  --file <path>   JSON feed file (default: feed-data/power_plant_feed.json or all *.json in feed-data/)
  --legacy        Input is legacy power_data.json shape { electrical: [...], instrument: [...] }
  --replace       Replace existing equipment (matched by equip_no / tag_name / name)
  --dry-run       Parse and count only; no database writes
`);
      process.exit(0);
    }
  }

  return opts;
}

function resolveFeedFiles(opts) {
  if (opts.file) {
    const filePath = path.isAbsolute(opts.file)
      ? opts.file
      : path.resolve(process.cwd(), opts.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Feed file not found: ${filePath}`);
    }
    return [filePath];
  }

  if (!fs.existsSync(FEED_DIR)) {
    throw new Error(`Feed directory missing: ${FEED_DIR}`);
  }

  if (fs.existsSync(DEFAULT_FEED)) return [DEFAULT_FEED];

  const jsonFiles = fs.readdirSync(FEED_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(FEED_DIR, f));

  if (!jsonFiles.length) {
    throw new Error(
      `No feed JSON found. Add feed-data/power_plant_feed.json or pass --file <path>`,
    );
  }

  return jsonFiles.sort();
}

function loadFeedFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function logFeedLocation(result) {
  if (!result.hierarchyPath) return;
  console.log(`    Hierarchy: ${result.hierarchyPath}`);
  if (result.imageName) {
    console.log(`    Image name:  ${result.imageName}`);
  }
  if (result.equipNo) {
    console.log(`    Equip no:    ${result.equipNo}`);
  }
  if (result.uiPath) {
    console.log(`    Open in app: ${result.uiPath}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  const files = resolveFeedFiles(opts);

  const summary = {
    files: files.length,
    imported: 0,
    skipped: 0,
    dryRun: 0,
    errors: 0,
    specs: 0,
    schedule: 0,
    history: 0,
    locations: [],
  };

  console.log(`PPN feed import — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.replace ? ' (replace)' : ''}`);
  console.log(`Files: ${files.map((f) => path.basename(f)).join(', ')}\n`);

  let globalIndex = 0;

  for (const filePath of files) {
    console.log(`--- ${path.basename(filePath)} ---`);
    const payload = loadFeedFile(filePath);
    const records = flattenFeedPayload(payload);
    console.log(`  ${records.length} equipment record(s)`);

    for (const record of records) {
      try {
        const result = await importPpnRecord(pool, record, globalIndex, opts);

        if (result.status === 'imported') {
          summary.imported += 1;
          summary.specs += result.specs;
          summary.schedule += result.schedule;
          summary.history += result.history;
          summary.locations.push(result);
          console.log(
            `  + ${result.name} (id=${result.equipId}) specs=${result.specs} schedule=${result.schedule} history=${result.history}`,
          );
          logFeedLocation(result);
        } else if (result.status === 'dry-run') {
          summary.dryRun += 1;
          summary.specs += result.specs;
          summary.schedule += result.schedule;
          summary.history += result.history;
          summary.locations.push(result);
          const sect = Object.entries(result.specSections || {})
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
          console.log(
            `  ~ ${result.name} specs=${result.specs} [${sect}] schedule=${result.schedule} history=${result.history}`,
          );
          logFeedLocation(result);
        } else {
          summary.skipped += 1;
          console.log(`  - ${result.name || result.reason}: ${result.reason}`);
          if (result.hierarchyPath) logFeedLocation(result);
        }
      } catch (err) {
        summary.errors += 1;
        const label = record?.name || `record #${globalIndex}`;
        console.error(`  ! ${label}: ${err.message}`);
      }

      globalIndex += 1;
    }
  }

  console.log('\nSummary');
  console.log(`  imported: ${summary.imported}`);
  console.log(`  skipped:  ${summary.skipped}`);
  if (opts.dryRun) console.log(`  dry-run:  ${summary.dryRun}`);
  console.log(`  errors:   ${summary.errors}`);
  console.log(`  specs:    ${summary.specs}`);
  console.log(`  schedule: ${summary.schedule}`);
  console.log(`  history:  ${summary.history}`);

  if (summary.locations.length) {
    console.log('\nHierarchy locations');
    for (const loc of summary.locations) {
      const idPart = loc.equipId != null ? ` [ppn id=${loc.equipId}]` : '';
      console.log(`  • ${loc.hierarchyPath}${idPart}`);
      if (loc.imageName) console.log(`      image: ${loc.imageName}`);
      if (loc.uiPath) console.log(`      app:   ${loc.uiPath}`);
    }
  }

  if (summary.errors > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
