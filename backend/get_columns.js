const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  port: parseInt(process.env.SQL_PORT || 1433, 10),
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
  }
};

async function getColumns() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected!');
    
    for (const view of ['CntPerformance', 'G_CTC']) {
      const result = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${view}'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log(`\n--- COLUMNS FOR ${view} ---`);
      result.recordset.forEach(row => {
        console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
      });

      // Fetch a sample row
      const sample = await pool.request().query(`SELECT TOP 1 * FROM ${view}`);
      console.log(`\nSample row for ${view}:`, JSON.stringify(sample.recordset[0], null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

getColumns();
