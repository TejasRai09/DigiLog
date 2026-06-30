/**
 * Add Mill House equipment rows to mh_equipment.
 *
 * Usage (from backend/):
 *   npm run db:add-mill-house-equipment
 *   npm run db:add-mill-house-equipment -- --dry-run
 *
 * Idempotent: skips rows that already exist (matched by name, case-insensitive).
 * equip_no: next sequential ZIL/GSM/MH/XX after the highest existing number.
 */

require('../config/env');
const { pool } = require('../config/mysql');

const EQUIPMENT = [
  'FMG Gear box no.1',
  'FMG Gear box no.2',
  'FMG Gear box no.3',
  'FMG Gear box no.4',
  'Aux. Cane Carrier',
  'Feeder drum',
  'Cane Belt Equalizer',
];

const PLANT = 'Mill House';
const LOCATION = 'Mill House';
const EQUIP_NO_PREFIX = 'ZIL/GSM/MH/';

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

async function maxEquipNoSuffix(conn) {
  const [rows] = await conn.query(
    `SELECT equip_no FROM mh_equipment
     WHERE equip_no LIKE ?
     ORDER BY LENGTH(equip_no) DESC, equip_no DESC`,
    [`${EQUIP_NO_PREFIX}%`],
  );

  let max = 0;
  for (const row of rows) {
    const match = String(row.equip_no || '').match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return max;
}

async function maxSortOrder(conn) {
  const [[row]] = await conn.query('SELECT COALESCE(MAX(sort_order), -1) AS n FROM mh_equipment');
  return Number(row?.n ?? -1);
}

async function findByName(conn, name) {
  const [rows] = await conn.query(
    'SELECT id, equip_no, name FROM mh_equipment WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [name],
  );
  return rows[0] || null;
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  const conn = await pool.getConnection();

  try {
    let nextNo = (await maxEquipNoSuffix(conn)) + 1;
    let sortOrder = (await maxSortOrder(conn)) + 1;

    console.log(dryRun ? '[dry-run] Mill House equipment insert' : 'Adding Mill House equipment…');
    console.log(`Next equip_no suffix: ${nextNo}\n`);

    let inserted = 0;
    let skipped = 0;

    for (const name of EQUIPMENT) {
      const existing = await findByName(conn, name);
      if (existing) {
        console.log(`  [skip] "${name}" already exists (${existing.equip_no}, id=${existing.id})`);
        skipped += 1;
        continue;
      }

      const equipNo = `${EQUIP_NO_PREFIX}${String(nextNo).padStart(2, '0')}`;

      if (dryRun) {
        console.log(`  [would insert] ${equipNo}  "${name}"  sort_order=${sortOrder}`);
      } else {
        await conn.execute(
          `INSERT INTO mh_equipment (equip_no, plant, name, location, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [equipNo, PLANT, name, LOCATION, sortOrder],
        );
        console.log(`  [insert] ${equipNo}  "${name}"  sort_order=${sortOrder}`);
      }

      inserted += 1;
      nextNo += 1;
      sortOrder += 1;
    }

    console.log(`\nDone. ${dryRun ? 'Would insert' : 'Inserted'}: ${inserted}, skipped: ${skipped}.`);
  } catch (err) {
    console.error('add-mill-house-equipment failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
