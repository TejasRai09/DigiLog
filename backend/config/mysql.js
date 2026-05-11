const mysql = require('mysql2/promise');
const { DATABASE_URL } = require('./env');

const pool = mysql.createPool({
  uri: DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
