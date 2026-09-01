/**
 * Import all feed-data/*.json except sample-equipment.json
 * Usage: npm run db:import-ppn-feed-all -- [--replace] [--dry-run]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FEED_DIR = path.join(__dirname, 'feed-data');
const IMPORT_SCRIPT = path.join(__dirname, 'import-ppn-feed.js');
const SKIP = new Set(['sample-equipment.json']);

const extraArgs = process.argv.slice(2);
const files = fs.readdirSync(FEED_DIR)
  .filter((f) => f.endsWith('.json') && !SKIP.has(f))
  .sort();

if (!files.length) {
  console.error('No feed JSON files found.');
  process.exit(1);
}

console.log(`Importing ${files.length} feed file(s)...`);
let failures = 0;

for (const file of files) {
  const rel = path.join('scripts/data_feed_power_history/feed-data', file);
  const result = spawnSync(
    process.execPath,
    [IMPORT_SCRIPT, '--file', rel, ...extraArgs],
    { cwd: path.join(__dirname, '../..'), stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) failures += 1;
}

if (failures) {
  console.error(`\n${failures} file(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${files.length} feed file(s) processed.`);
