/**
 * Remove Power Plant Equipment History data from MySQL.
 *
 * Default: pp_* tables (legacy /api/power).
 * With --new: ppn_* tables (new hub /api/power-new).
 *
 * Usage (from backend/):
 *   npm run db:clear-power-equipment
 *   npm run db:clear-power-equipment-new
 *   npm run db:clear-power-equipment -- --dry-run
 *   npm run db:clear-power-equipment -- --history-only
 *
 * Options:
 *   --new            Target ppn_* tables instead of pp_*
 *   --dry-run        Show row counts only; no deletes
 *   --history-only   Delete only history table maintenance records
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/mysql');

const TABLE_SETS = {
  pp: {
    label: 'Power Plant Equipment History (pp_*)',
    equipment: 'pp_equipment',
    specs: 'pp_specs',
    schedule: 'pp_oem_schedule',
    history: 'pp_history',
  },
  ppn: {
    label: 'Power Plant Equipment History (new) (ppn_*)',
    equipment: 'ppn_equipment',
    specs: 'ppn_specs',
    schedule: 'ppn_oem_schedule',
    history: 'ppn_history',
  },
};

function parseArgs(argv) {
  const opts = { dryRun: false, historyOnly: false, target: 'pp' };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--history-only') opts.historyOnly = true;
    else if (a === '--new') opts.target = 'ppn';
    else if (a === '--all') {
      // Legacy flag — full clear is now the default.
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/clear-power-equipment-data.js [options]

Removes Power Plant equipment data from MySQL.

Options:
  --new            Clear ppn_* (new hub) instead of pp_*
  --dry-run        Count rows only; do not delete
  --history-only   Delete only the history table
`);
      process.exit(0);
    }
  }

  return opts;
}

async function countTable(conn, table) {
  const [[row]] = await conn.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(row.total) || 0;
}

async function main() {
  const opts = parseArgs(process.argv);
  const tables = TABLE_SETS[opts.target];
  const conn = await pool.getConnection();

  try {
    const counts = {
      equipment: await countTable(conn, tables.equipment),
      specs: await countTable(conn, tables.specs),
      schedule: await countTable(conn, tables.schedule),
      history: await countTable(conn, tables.history),
    };

    console.log(`${tables.label} — current row counts:`);
    console.log(`  ${tables.equipment}:     ${counts.equipment}`);
    console.log(`  ${tables.specs}:         ${counts.specs}`);
    console.log(`  ${tables.schedule}:  ${counts.schedule}`);
    console.log(`  ${tables.history}:       ${counts.history}`);

    if (opts.dryRun) {
      console.log('\n(dry-run — no data deleted)');
      return;
    }

    await conn.beginTransaction();

    if (opts.historyOnly) {
      await conn.query(`DELETE FROM \`${tables.history}\``);
      console.log(`\nDeleted ${counts.history} ${tables.history} rows.`);
    } else {
      await conn.query(`DELETE FROM \`${tables.history}\``);
      await conn.query(`DELETE FROM \`${tables.schedule}\``);
      await conn.query(`DELETE FROM \`${tables.specs}\``);
      await conn.query(`DELETE FROM \`${tables.equipment}\``);
      console.log(`\nDeleted all ${opts.target === 'ppn' ? 'ppn' : 'pp'} equipment data:`);
      console.log(`  ${tables.history}:       ${counts.history}`);
      console.log(`  ${tables.schedule}:  ${counts.schedule}`);
      console.log(`  ${tables.specs}:         ${counts.specs}`);
      console.log(`  ${tables.equipment}:     ${counts.equipment}`);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('Clear failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
