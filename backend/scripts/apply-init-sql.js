/**
 * Applies mysql/init.sql using DATABASE_URL / MYSQL_DATABASE from backend/.env.
 * Substitutes __MYSQL_DATABASE__ in init.sql with the resolved database name.
 * Ensures that database exists and defines:
 *   system tables (users, apps, forms, mappings, portal_settings), form/logbook tables,
 *   distillery_operations, mh_* Mill House cards, pp_* Power Plant equipment
 *   (pp_equipment, pp_specs, pp_oem_schedule, pp_history — used by /api/power),
 *   and ppn_* Power Plant equipment new hub
 *   (ppn_equipment, ppn_specs, ppn_oem_schedule, ppn_history — used by /api/power-new).
 *
 * Idempotent on an existing DB (CREATE TABLE IF NOT EXISTS): safe to re-run after pull
 * to add new tables (e.g. pp_*) without wiping data.
 * After init.sql, ensures users.department / users.avatar and distillery_operations
 * generated columns `FS%`, total_mol_in_store_qtls exist (idempotent ADD COLUMN;
 * duplicate-column errors ignored for older DBs and re-runs).
 *
 * For ongoing form DDL, use Prisma from this directory:
 *   npm run db:migrate:dev
 *   npm run db:migrate:deploy
 *
 * If the DB was first created with init.sql, record Prisma baseline:
 *   npm run db:migrate:resolve-baseline
 *
 * Optional reference for pp_* DDL only: mysql/migrate_add_power_tables.sql (same DDL is in init.sql).
 *
 * Usage: npm run db:schema   (from backend/)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  getRequiredDatabaseName,
  readSqlFileWithDatabase,
  getServerConnectionOptions,
} = require('../config/databaseName');

const INIT_SQL = path.join(__dirname, '..', '..', 'mysql', 'init.sql');

/** CREATE TABLE IF NOT EXISTS does not add columns; ADD COLUMN on re-run errors if present — ignore 1060. */
async function useDatabase(conn, databaseName) {
  await conn.query(`USE \`${databaseName}\``);
}

async function ensureDistilleryOperationsCalcColumns(conn, databaseName) {
  const fsExpr =
    'DOUBLE AS (IF(`trs` IS NOT NULL AND `trs` <> 0 AND `fs` IS NOT NULL, `fs` / `trs`, NULL)) STORED';
  const molExpr =
    'DOUBLE AS (IF(`total_bh_molasses_qtls` IS NULL AND `total_ch_molasses_qtls` IS NULL, NULL, COALESCE(`total_bh_molasses_qtls`, 0) + COALESCE(`total_ch_molasses_qtls`, 0))) STORED';

  await useDatabase(conn, databaseName);

  try {
    await conn.query(
      `ALTER TABLE \`distillery_operations\` CHANGE COLUMN \`fs_pct\` \`FS%\` ${fsExpr}`,
    );
  } catch (err) {
    if (err.errno !== 1054 && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }

  try {
    await conn.query(
      `ALTER TABLE \`distillery_operations\` CHANGE COLUMN \`fs%\` \`FS%\` ${fsExpr}`,
    );
  } catch (err) {
    if (err.errno !== 1054 && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }

  const alters = [
    `ALTER TABLE \`distillery_operations\` ADD COLUMN \`FS%\` ${fsExpr}`,
    `ALTER TABLE \`distillery_operations\` ADD COLUMN \`total_mol_in_store_qtls\` ${molExpr}`,
  ];
  for (const sql of alters) {
    try {
      await conn.query(sql);
    } catch (err) {
      if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') continue;
      throw err;
    }
  }
}

/** CREATE TABLE IF NOT EXISTS does not add columns; ADD COLUMN on re-run errors if present — ignore 1060. */
async function ensureUserProfileColumns(conn, databaseName) {
  const alters = [
    'ALTER TABLE `users` ADD COLUMN `department` VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE `users` ADD COLUMN `avatar` MEDIUMTEXT DEFAULT NULL',
    'ALTER TABLE `users` ADD COLUMN `google_id` VARCHAR(200) DEFAULT NULL',
  ];
  await useDatabase(conn, databaseName);
  for (const sql of alters) {
    try {
      await conn.query(sql);
    } catch (err) {
      if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') continue;
      throw err;
    }
  }
}

/**
 * Add users.manager_id column and its self-referencing FK idempotently.
 * MySQL does not support ADD CONSTRAINT IF NOT EXISTS, so we check
 * information_schema before attempting the ALTER.
 */
async function ensureManagerColumn(conn, databaseName) {
  await useDatabase(conn, databaseName);

  // 1. Add the column (ignore if already present)
  try {
    await conn.query('ALTER TABLE `users` ADD COLUMN `manager_id` INT NULL DEFAULT NULL');
  } catch (err) {
    if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  // 2. Add the FK only if it doesn't already exist
  const [[row]] = await conn.query(`
    SELECT 1 AS exists_flag
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA    = DATABASE()
      AND TABLE_NAME      = 'users'
      AND CONSTRAINT_NAME = 'users_manager_id_fkey'
    LIMIT 1
  `);
  if (!row) {
    await conn.query(`
      ALTER TABLE \`users\` ADD CONSTRAINT \`users_manager_id_fkey\`
        FOREIGN KEY (\`manager_id\`) REFERENCES \`users\`(\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
}

async function main() {
  let databaseName;
  let serverOpts;
  try {
    databaseName = getRequiredDatabaseName();
    serverOpts = getServerConnectionOptions();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  if (!fs.existsSync(INIT_SQL)) {
    console.error('Missing file:', INIT_SQL);
    process.exit(1);
  }

  const sql = readSqlFileWithDatabase(INIT_SQL, databaseName);

  console.log(`Applying mysql/init.sql → database "${databaseName}" (server connection, no default DB)...`);
  let conn;
  try {
    conn = await mysql.createConnection(serverOpts);
    await conn.query(sql);
    await ensureDistilleryOperationsCalcColumns(conn, databaseName);
    await ensureUserProfileColumns(conn, databaseName);
    await ensureManagerColumn(conn, databaseName);
    console.log(`Done — schema applied on "${databaseName}" (forms + mh_* + pp_* + ppn_* + …).`);
  } catch (err) {
    console.error('Apply failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
