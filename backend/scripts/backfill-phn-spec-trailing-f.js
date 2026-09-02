/**
 * Backfill phn_specs: trailing F → Φ in parameter values.
 * Usage: node scripts/backfill-phn-spec-trailing-f.js
 */
require('../config/env');
const { pool } = require('../config/mysql');
const { formatProductionHouseSpecValue } = require('../utils/productionHouseSpecValue');

(async () => {
  const [rows] = await pool.query(
    `SELECT id, val FROM phn_specs
     WHERE lbl NOT IN ('__subsections__', '__subgroup_meta__')
       AND val IS NOT NULL AND val <> ''`
  );
  let updated = 0;
  for (const row of rows) {
    const next = formatProductionHouseSpecValue(row.val);
    if (next === row.val) continue;
    await pool.execute('UPDATE phn_specs SET val = ? WHERE id = ?', [next, row.id]);
    updated += 1;
  }
  console.log(`Updated ${updated} spec value(s).`);
  await pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
