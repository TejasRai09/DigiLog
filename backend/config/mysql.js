const mysql = require('mysql2/promise');
const {
  DATABASE_URL,
  DB_POOL_LIMIT,
  DB_POOL_QUEUE_LIMIT,
  DB_CONNECT_TIMEOUT,
} = require('./env');

const pool = mysql.createPool({
  uri: DATABASE_URL,
  waitForConnections: true,
  // Sized for concurrent users + heavy BI queries; keep below MySQL max_connections.
  connectionLimit: DB_POOL_LIMIT,
  // Bounded queue: excess requests fail fast instead of waiting forever.
  queueLimit: DB_POOL_QUEUE_LIMIT,
  // Cap time spent establishing a new connection so a stuck DB doesn't hang requests.
  connectTimeout: DB_CONNECT_TIMEOUT,
  // Recycle idle connections so the pool survives DB-side idle timeouts / NAT drops.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+00:00',
  /* Keep DATE/DATETIME as strings so JSON/API does not emit 2026-03-01T00:00:00.000Z */
  dateStrings: true,
});

const testMysqlConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
  }
};

module.exports = { pool, testMysqlConnection };
