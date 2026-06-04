/**
 * Apply a mysql/*.sql file with __MYSQL_DATABASE__ substituted from env.
 *
 * Usage (from backend/):
 *   node scripts/apply-sql-file.js ../mysql/migrate_add_power_tables.sql
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

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error('Usage: node scripts/apply-sql-file.js <path-to.sql>');
    process.exit(1);
  }

  const sqlPath = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  if (!fs.existsSync(sqlPath)) {
    console.error('Missing file:', sqlPath);
    process.exit(1);
  }

  let databaseName;
  let serverOpts;
  try {
    databaseName = getRequiredDatabaseName();
    serverOpts = getServerConnectionOptions();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const sql = readSqlFileWithDatabase(sqlPath, databaseName);
  console.log(`Applying ${path.basename(sqlPath)} → database "${databaseName}"...`);

  let conn;
  try {
    conn = await mysql.createConnection(serverOpts);
    await conn.query(sql);
    console.log('Done.');
  } catch (err) {
    console.error('Apply failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
