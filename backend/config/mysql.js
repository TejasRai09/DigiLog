const mysql = require('mysql2/promise');
const { DATABASE_URL } = require('./env');

const pool = mysql.createPool({
  uri: DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
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
