require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  port: parseInt(process.env.SQL_PORT || 1433, 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 60000
  }
};

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();
  const r = pool.request();

  // Check tables exist
  const tables = await r.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME IN ('G_CTC','CntPerformance') 
    ORDER BY TABLE_NAME
  `);
  console.log('Tables found:', tables.recordset.map(t => t.TABLE_NAME));

  // Sample row counts
  const cnt = await pool.request().query('SELECT COUNT(*) as count FROM CntPerformance');
  console.log('CntPerformance rows:', cnt.recordset[0].count);

  const gctc = await pool.request().query('SELECT COUNT(*) as count FROM G_CTC');
  console.log('G_CTC rows:', gctc.recordset[0].count);

  // Date range in G_CTC
  const dates = await pool.request().query('SELECT MIN(m_date) as minDate, MAX(m_date) as maxDate FROM G_CTC');
  console.log('G_CTC date range:', dates.recordset[0]);

  pool.close();
  process.exit(0);
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
