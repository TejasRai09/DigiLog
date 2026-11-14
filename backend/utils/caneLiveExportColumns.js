const { pool } = require('../config/mysql');

/** Columns the live tables have and the dashboard does not read. Adding them does not change existing values. */
const LIVE_EXPORT_COLUMNS = [
  { table: 'g_ctc', name: 'ctc_minutes', ddl: 'INT NULL' },
  { table: 'cnt_performance', name: 'c_code', ddl: 'INT NULL' },
  { table: 'cnt_performance', name: 'v_code', ddl: 'INT NULL' },
  { table: 'cnt_performance', name: 'g_code', ddl: 'INT NULL' },
  { table: 'cnt_performance', name: 'travel_to_center_minutes', ddl: 'INT NULL' },
  { table: 'cnt_performance', name: 'total_ctc_minutes', ddl: 'INT NULL' },
  { table: 'cnt_performance', name: 'harvest_datetime', ddl: 'DATETIME NULL' },
];

let ensured = null;

async function columnExists(table, name) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, name],
  );
  return rows.length > 0;
}

/** Adds nullable columns only. Never alters a column the dashboard already reads. */
async function ensureCaneLiveExportColumns() {
  if (!ensured) {
    ensured = (async () => {
      for (const col of LIVE_EXPORT_COLUMNS) {
        if (await columnExists(col.table, col.name)) continue;
        await pool.query(
          `ALTER TABLE \`${col.table}\` ADD COLUMN \`${col.name}\` ${col.ddl}`,
        );
      }
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

module.exports = { ensureCaneLiveExportColumns, LIVE_EXPORT_COLUMNS };
