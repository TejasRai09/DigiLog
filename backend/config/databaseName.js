/**
 * Resolve MySQL database name and connection URL from env.
 * Source of truth: MYSQL_DATABASE (if set), else database segment of DATABASE_URL.
 * DATABASE_URL passed to the pool is normalized so its path matches MYSQL_DATABASE when both are set.
 */

const PLACEHOLDER = '__MYSQL_DATABASE__';

function parseMysqlUrl(databaseUrl) {
  const trimmed = (databaseUrl || '').trim();
  if (!trimmed) {
    return { host: 'localhost', port: 3306, user: 'root', password: '', database: '' };
  }
  const normalized = trimmed.replace(/^mysql:\/\//i, 'http://');
  const u = new URL(normalized);
  return {
    host: u.hostname || 'localhost',
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username || 'root'),
    password: u.password !== '' ? decodeURIComponent(u.password) : '',
    database: (u.pathname || '').replace(/^\//, '').split('?')[0].trim(),
  };
}

function buildMysqlUrl({ host, port, user, password, database }) {
  const encUser = encodeURIComponent(user || 'root');
  const encPass = encodeURIComponent(password || '');
  const hostPart = host || 'localhost';
  const portPart = port ? `:${port}` : '';
  const dbPart = database ? `/${database}` : '';
  return `mysql://${encUser}:${encPass}@${hostPart}${portPart}${dbPart}`;
}

function resolveDatabaseName(env = process.env) {
  const fromEnv = (env.MYSQL_DATABASE || '').trim();
  if (fromEnv) return fromEnv;
  const url = (env.DATABASE_URL || '').trim();
  if (!url) return '';
  return parseMysqlUrl(url).database || '';
}

function assertSafeDatabaseName(name) {
  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(
      `Invalid database name "${name}". Set MYSQL_DATABASE or DATABASE_URL with a safe name (letters, digits, underscore).`,
    );
  }
  return name;
}

function getRequiredDatabaseName(env = process.env) {
  const name = resolveDatabaseName(env);
  if (!name) {
    throw new Error(
      'Database name not found. Set MYSQL_DATABASE or include it in DATABASE_URL (e.g. mysql://user:pass@host:3306/your_db).',
    );
  }
  return assertSafeDatabaseName(name);
}

/**
 * Connection URL for mysql2 pool / createConnection (includes database).
 */
function resolveDatabaseUrl(env = process.env) {
  const database = resolveDatabaseName(env);
  const rawUrl = (env.DATABASE_URL || '').trim();

  if (rawUrl) {
    const parsed = parseMysqlUrl(rawUrl);
    const db = database || parsed.database;
    if (!db) return rawUrl;
    return buildMysqlUrl({ ...parsed, database: db });
  }

  if (!database) return '';

  const host = (env.MYSQL_HOST || 'localhost').trim();
  const port = parseInt(env.MYSQL_PORT || '3306', 10) || 3306;
  const user = (env.MYSQL_USER || 'root').trim();
  const password = env.MYSQL_PASSWORD != null ? String(env.MYSQL_PASSWORD) : '';

  return buildMysqlUrl({ host, port, user, password, database });
}

function substituteDatabaseInSql(rawSql, databaseName) {
  return String(rawSql).replace(new RegExp(PLACEHOLDER, 'g'), databaseName);
}

function readSqlFileWithDatabase(filePath, databaseName) {
  const fs = require('fs');
  const raw = fs.readFileSync(filePath, 'utf8');
  return substituteDatabaseInSql(raw, databaseName);
}

/** mysql2 options without default database (for CREATE DATABASE in init.sql). */
function getServerConnectionOptions(env = process.env) {
  const url = resolveDatabaseUrl(env);
  if (!url) {
    throw new Error('DATABASE_URL or MYSQL_* + MYSQL_DATABASE must be set in backend/.env');
  }
  const parsed = parseMysqlUrl(url);
  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password || undefined,
    multipleStatements: true,
  };
}

module.exports = {
  PLACEHOLDER,
  parseMysqlUrl,
  buildMysqlUrl,
  resolveDatabaseName,
  assertSafeDatabaseName,
  getRequiredDatabaseName,
  resolveDatabaseUrl,
  substituteDatabaseInSql,
  readSqlFileWithDatabase,
  getServerConnectionOptions,
};
