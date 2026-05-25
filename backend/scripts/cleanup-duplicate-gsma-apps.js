/**
 * Remove duplicate apps created when seed ran after renaming (GSMA * → * without prefix).
 * Keeps canonical apps (Mill/Lab/Power/Distillery Logbook) and deletes empty GSMA-named rows.
 * Migrates user mappings from old app ids to new ones when both exist.
 *
 * Run: node scripts/cleanup-duplicate-gsma-apps.js
 */

require('../config/env');
const { pool } = require('../config/mysql');

const RENAMES = [
  { oldName: 'GSMA Mill Logbook', newName: 'Mill Logbook' },
  { oldName: 'GSMA Lab Logbook', newName: 'Lab Logbook' },
  { oldName: 'GSMA Power Logbook', newName: 'Power Logbook' },
  { oldName: 'GSMA Distillery Operations', newName: 'Distillery Operations' },
];

async function getAppId(name) {
  const [[row]] = await pool.query('SELECT id FROM apps WHERE name = ? LIMIT 1', [name]);
  return row?.id ?? null;
}

const run = async () => {
  console.log('🧹  Cleaning duplicate GSMA apps...\n');

  for (const { oldName, newName } of RENAMES) {
    const oldId = await getAppId(oldName);
    const newId = await getAppId(newName);

    if (!oldId) {
      console.log(`  ⏭️  No old app: ${oldName}`);
      continue;
    }
    if (!newId) {
      console.log(`  ⚠️  New app missing (${newName}); renaming old app in place`);
      await pool.query('UPDATE apps SET name = ? WHERE id = ?', [newName, oldId]);
      continue;
    }

    const [[{ formCount }]] = await pool.query(
      'SELECT COUNT(*) AS formCount FROM forms WHERE app_id = ?',
      [oldId],
    );
    if (formCount > 0) {
      console.log(`  ⚠️  Skipping delete of ${oldName} (id=${oldId}): still has ${formCount} form(s)`);
      continue;
    }

    // Move mappings: if user already mapped to new app, drop old mapping; else re-point.
    const [oldMappings] = await pool.query(
      'SELECT id, user_id FROM mappings WHERE app_id = ?',
      [oldId],
    );
    for (const m of oldMappings) {
      const [[existing]] = await pool.query(
        'SELECT id FROM mappings WHERE user_id = ? AND app_id = ? LIMIT 1',
        [m.user_id, newId],
      );
      if (existing) {
        await pool.query('DELETE FROM mappings WHERE id = ?', [m.id]);
        console.log(`  🔀  Dropped duplicate mapping user=${m.user_id} ${oldName} → already on ${newName}`);
      } else {
        await pool.query('UPDATE mappings SET app_id = ? WHERE id = ?', [newId, m.id]);
        console.log(`  🔀  Moved mapping user=${m.user_id} from ${oldName} to ${newName}`);
      }
    }

    await pool.query('DELETE FROM apps WHERE id = ?', [oldId]);
    console.log(`  ✅  Deleted empty app: ${oldName} (id=${oldId})`);
  }

  const [remaining] = await pool.query(
    "SELECT id, name FROM apps WHERE name LIKE 'GSMA%' ORDER BY id",
  );
  if (remaining.length) {
    console.log('\n  ℹ️  Remaining GSMA-named apps (not auto-removed):');
    remaining.forEach((a) => console.log(`      id=${a.id}  ${a.name}`));
  }

  console.log('\n🎉  Cleanup complete.');
  await pool.end();
};

run().catch((err) => {
  console.error('❌  Cleanup failed:', err.message);
  process.exit(1);
});
