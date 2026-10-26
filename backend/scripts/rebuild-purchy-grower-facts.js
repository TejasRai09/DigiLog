/**
 * Rebuild purchy_grower_facts_2025 from the currently loaded Purchy tables.
 * Imports do this automatically; run manually after applying
 * mysql/migrate_purchy_grower_facts.sql on a database that already has data.
 *
 * Usage: cd backend && npm run db:rebuild-purchy-facts
 */
require('dotenv').config();
const { pool } = require('../config/mysql');
const { rebuildGrowerFacts } = require('../services/purchy/purchyGrowerFacts');

async function main() {
  console.log('Rebuilding purchy_grower_facts_2025…');
  const { growers, ms } = await rebuildGrowerFacts();
  console.log(`Done — ${growers.toLocaleString()} growers in ${(ms / 1000).toFixed(1)}s.`);
  console.log('Restart the API server (or run a Purchy import) to clear cached dashboard responses.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
