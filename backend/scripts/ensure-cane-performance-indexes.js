/**
 * Ensure indexes used by cane performance dashboard date/mode filters.
 * Safe to re-run (checks information_schema first).
 *
 *   node scripts/ensure-cane-performance-indexes.js
 */
const { pool } = require('../config/mysql');

const INDEXES = [
  {
    table: 'cnt_performance',
    name: 'idx_report_date',
    sql: 'ALTER TABLE `cnt_performance` ADD INDEX `idx_report_date` (`report_date`)',
  },
  {
    table: 'cnt_performance',
    name: 'idx_report_center',
    sql: 'ALTER TABLE `cnt_performance` ADD INDEX `idx_report_center` (`report_date`, `center`)',
  },
  {
    table: 'cnt_performance',
    name: 'idx_report_mode',
    sql: 'ALTER TABLE `cnt_performance` ADD INDEX `idx_report_mode` (`report_date`, `transport_mode`)',
  },
  {
    table: 'g_ctc',
    name: 'idx_mdate_vcode',
    sql: 'ALTER TABLE `g_ctc` ADD INDEX `idx_mdate_vcode` (`m_date`, `v_code`)',
  },
  {
    table: 'g_ctc',
    name: 'idx_mdate_mod',
    sql: 'ALTER TABLE `g_ctc` ADD INDEX `idx_mdate_mod` (`m_date`, `sup_mod`)',
  },
];

async function hasIndex(table, name) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
     LIMIT 1`,
    [table, name]
  );
  return rows.length > 0;
}

(async () => {
  for (const idx of INDEXES) {
    if (await hasIndex(idx.table, idx.name)) {
      console.log(`skip ${idx.table}.${idx.name} (exists)`);
      continue;
    }
    const t0 = Date.now();
    console.log(`creating ${idx.table}.${idx.name}...`);
    await pool.execute(idx.sql);
    console.log(`  done in ${Date.now() - t0}ms`);
  }
  console.log('indexes ready');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
