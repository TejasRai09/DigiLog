/**
 * Applies repo mysql/init.sql using DATABASE_URL from backend/.env.
 * Creates gsmadb, users/apps/mappings, equipment tables, and all form tables.
 *
 * For ongoing DDL on form tables, use Prisma Migrate from this directory:
 *   npm run db:migrate:dev
 *   npm run db:migrate:deploy
 *
 * If the database was first created with this script, record the baseline
 * migration without re-applying SQL:
 *   npm run db:migrate:resolve-baseline
 *
 * Usage: npm run db:schema   (from backend/)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const INIT_SQL = path.join(__dirname, '..', '..', 'mysql', 'init.sql');

/**
 * Connect without selecting a database so CREATE DATABASE in init.sql can run.
 * A URL like mysql://u:p@host:3306/gsmadb otherwise fails with ER_BAD_DB_ERROR if gsmadb does not exist yet.
 */
function connectionOptionsNoDatabase(databaseUrl) {
  const normalized = databaseUrl.trim().replace(/^mysql:\/\//i, 'http://');
  const u = new URL(normalized);
  return {
    host: u.hostname || 'localhost',
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username || 'root'),
    password: u.password !== '' ? decodeURIComponent(u.password) : undefined,
    multipleStatements: true,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }

  if (!fs.existsSync(INIT_SQL)) {
    console.error('Missing file:', INIT_SQL);
    process.exit(1);
  }

  const sql = fs.readFileSync(INIT_SQL, 'utf8');

  console.log('Applying mysql/init.sql (server connection, no default DB)...');
  let conn;
  try {
    conn = await mysql.createConnection(connectionOptionsNoDatabase(databaseUrl));
    await conn.query(sql);
    console.log('Done — schema applied (init.sql creates/uses gsmadb and all tables).');
    console.log('Ensure DATABASE_URL database name matches gsmadb or change init.sql USE line.');
  } catch (err) {
    console.error('Apply failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
