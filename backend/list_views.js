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

async function listViews() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected!');
    
    // Query to list all views in the current database
    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.VIEWS
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    console.log('\n--- LIST OF VIEWS ---');
    result.recordset.forEach(row => {
      console.log(`[${row.TABLE_SCHEMA}].[${row.TABLE_NAME}]`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

listViews();
