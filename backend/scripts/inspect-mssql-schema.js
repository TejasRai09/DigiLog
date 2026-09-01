require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  port: parseInt(process.env.SQL_PORT || 1433, 10),
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 60000 }
};

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();

  // Get CntPerformance columns
  const cntCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CntPerformance' 
    ORDER BY ORDINAL_POSITION
  `);
  console.log('\n=== CntPerformance Columns ===');
  cntCols.recordset.forEach(c => console.log(`  [${c.COLUMN_NAME}] ${c.DATA_TYPE}`));

  // Get G_CTC columns
  const gctcCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'G_CTC' 
    ORDER BY ORDINAL_POSITION
  `);
  console.log('\n=== G_CTC Columns ===');
  gctcCols.recordset.forEach(c => console.log(`  [${c.COLUMN_NAME}] ${c.DATA_TYPE}`));

  // Sample 2 rows from each table to see actual data
  const cntSample = await pool.request().query('SELECT TOP 2 * FROM CntPerformance');
  console.log('\n=== CntPerformance Sample Row ===');
  console.log(JSON.stringify(cntSample.recordset[0], null, 2));

  const gSample = await pool.request().query('SELECT TOP 2 * FROM G_CTC');
  console.log('\n=== G_CTC Sample Row ===');
  console.log(JSON.stringify(gSample.recordset[0], null, 2));

  pool.close();
  process.exit(0);
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
