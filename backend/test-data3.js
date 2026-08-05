require('dotenv').config();
const { poolPromise } = require('./utils/sqlServer');

async function run() {
  try {
    const pool = await poolPromise;
    if (!pool) {
      console.log('No pool');
      process.exit(1);
    }
    const r1 = await pool.request().query(`
      SELECT COUNT(DISTINCT CHALLAN) as trips, COUNT(*) as vehicles, SUM([Purchased Quantity (Qtl.)]) as cane
      FROM CntPerformance
      WHERE CAST([Weighment Date (Purchy)] AS DATE) >= '2025-10-24' AND CAST([Weighment Date (Purchy)] AS DATE) <= '2025-11-30'
        AND [C.Code] > 0
    `);
    console.log('Center:', r1.recordset[0]);

    const r2 = await pool.request().query(`
      SELECT COUNT(purchyno) as vehicles, SUM(Purchase_QTL) as cane
      FROM G_CTC
      WHERE CAST(m_date AS DATE) >= '2025-10-24' AND CAST(m_date AS DATE) <= '2025-11-30'
    `);
    console.log('Gate:', r2.recordset[0]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
