const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function run() {
  const pool = await sql.connect(dbConfig);
  const r1 = await pool.request().query(`
    SELECT COUNT(DISTINCT CHALLAN) as trips, COUNT(*) as vehicles, SUM([Purchased Quantity (Qtl.)]) as cane
    FROM CntPerformance
    WHERE CAST([Weighment Date (Purchy)] AS DATE) >= '2025-10-24' AND CAST([Weighment Date (Purchy)] AS DATE) <= '2025-11-30'
      AND [C.Code] > 0
  `);
  console.log('Center (CntPerformance):', r1.recordset[0]);

  const r2 = await pool.request().query(`
    SELECT COUNT(purchyno) as vehicles, SUM(Purchase_QTL) as cane
    FROM G_CTC
    WHERE CAST(m_date AS DATE) >= '2025-10-24' AND CAST(m_date AS DATE) <= '2025-11-30'
  `);
  console.log('Gate (G_CTC):', r2.recordset[0]);
  process.exit(0);
}
run();
