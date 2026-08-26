/**
 * Shift the discipline "section" of the 5 Turbine tags from 'instrument' to
 * 'mechanical' in shn_specs / shn_oem_schedule / shn_history.
 *
 * These tags are steam turbines (mechanical equipment), but their spec /
 * schedule / history rows were imported with section = 'instrument' (or
 * NULL). This updates the section column for every row belonging to these
 * tags' shn_equipment record(s).
 *
 * IMPORTANT: shn_oem_schedule rows also carry a JSON `equipment_refs` column
 * ([{section, sub_section}, ...]) that the app's discipline-tab filter
 * (scheduleRowMatchesSection in powerEquipmentControllerFactory.js) checks
 * BEFORE falling back to the plain `section` column. If that JSON still says
 * "instrument", the row keeps showing under the Instrument tab even after
 * the `section` column itself is updated — so this script rewrites the
 * `section` value inside equipment_refs too.
 *
 * Usage (from backend/):
 *   npm run db:shift-turbine-tags-mechanical -- --dry-run
 *   npm run db:shift-turbine-tags-mechanical
 *
 * Optional flags:
 *   --tags ZIL/SUG/01,ZIL/SUG/02   (default: the 5 turbine tags below)
 *   --to mechanical                (default target section)
 */
require('../config/env');
const { pool } = require('../config/mysql');

const DEFAULT_TAGS = [
  'ZIL/SUG/01',
  'ZIL/SUG/02',
  'ZIL/SUG/03',
  'ZIL/SUG/04',
  'ZIL/SUG/05',
];

function parseArgs(argv) {
  const args = { dryRun: false, tags: null, to: 'mechanical' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--tags' && argv[i + 1]) {
      args.tags = argv[i + 1].split(',').map((t) => t.trim()).filter(Boolean);
      i += 1;
    } else if (argv[i] === '--to' && argv[i + 1]) {
      args.to = argv[i + 1].trim();
      i += 1;
    }
  }
  if (!args.tags || !args.tags.length) args.tags = DEFAULT_TAGS;
  return args;
}

async function main() {
  const { dryRun, tags, to } = parseArgs(process.argv);
  const conn = await pool.getConnection();

  try {
    console.log(`Tags: ${tags.join(', ')}`);
    console.log(`Target section: ${to}`);
    console.log(dryRun ? '(dry-run — no changes will be made)\n' : '\n');

    const placeholders = tags.map(() => '?').join(',');
    const [equips] = await conn.query(
      `SELECT id, equip_no, tag_name, name, location
       FROM shn_equipment
       WHERE equip_no IN (${placeholders}) OR tag_name IN (${placeholders})`,
      [...tags, ...tags],
    );

    if (!equips.length) {
      console.log('No shn_equipment rows found for these tags. Nothing to do.');
      return;
    }

    const equipIds = equips.map((e) => e.id);
    console.log(`Matched ${equips.length} shn_equipment row(s):`);
    for (const e of equips) {
      console.log(`  id=${e.id}  ${e.equip_no || e.tag_name}  "${e.name}"  (${e.location})`);
    }

    const idPlaceholders = equipIds.map(() => '?').join(',');
    const tables = [
      { name: 'shn_specs', label: 'Specification rows' },
      { name: 'shn_oem_schedule', label: 'Maintenance schedule rows' },
      { name: 'shn_history', label: 'Maintenance history rows' },
    ];

    console.log('\nCurrent section breakdown:');
    for (const t of tables) {
      const [rows] = await conn.query(
        `SELECT section, COUNT(*) AS n FROM ${t.name}
         WHERE equip_id IN (${idPlaceholders})
         GROUP BY section`,
        equipIds,
      );
      const breakdown = rows.map((r) => `${r.section ?? 'NULL'}=${r.n}`).join(', ') || '(none)';
      console.log(`  ${t.label}: ${breakdown}`);
    }

    if (dryRun) {
      console.log('\nDry run only — no rows updated.');
      return;
    }

    console.log('\nUpdating...');
    let totalUpdated = 0;
    for (const t of tables) {
      const [result] = await conn.query(
        `UPDATE ${t.name} SET section = ? WHERE equip_id IN (${idPlaceholders})`,
        [to, ...equipIds],
      );
      console.log(`  ${t.label}: ${result.affectedRows} row(s) set to '${to}'`);
      totalUpdated += result.affectedRows;
    }

    // shn_oem_schedule: also rewrite the JSON equipment_refs column — the
    // frontend's discipline-tab filter reads section from equipment_refs
    // first and only falls back to the plain `section` column if it's empty.
    const [scheduleRows] = await conn.query(
      `SELECT id, equipment_refs FROM shn_oem_schedule WHERE equip_id IN (${idPlaceholders})`,
      equipIds,
    );
    let refsUpdated = 0;
    for (const row of scheduleRows) {
      if (!row.equipment_refs) continue;
      let refs;
      try {
        refs = typeof row.equipment_refs === 'string'
          ? JSON.parse(row.equipment_refs)
          : row.equipment_refs;
      } catch {
        continue;
      }
      if (!Array.isArray(refs) || !refs.length) continue;
      const rewritten = refs.map((ref) => ({ ...ref, section: to }));
      await conn.query('UPDATE shn_oem_schedule SET equipment_refs = ? WHERE id = ?', [
        JSON.stringify(rewritten),
        row.id,
      ]);
      refsUpdated += 1;
    }
    console.log(`  shn_oem_schedule.equipment_refs rewritten: ${refsUpdated} row(s)`);

    console.log(`\nDone. Total rows updated: ${totalUpdated} (+ ${refsUpdated} equipment_refs JSON rewrites)`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
