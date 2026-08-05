require('dotenv').config();
const { poolPromise } = require('./utils/sqlServer');
async function run() {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query(`
      SELECT 
        SUM(
          CAST(DATEDIFF(MINUTE, CentreArr, M_TokenDate_Time) AS FLOAT) / 60.0
          * [Purchased Quantity (Qtl.)]
        ) as Numerator,
        SUM([Purchased Quantity (Qtl.)]) as TotalCane,
        SUM(CASE WHEN CentreArr IS NOT NULL AND M_TokenDate_Time IS NOT NULL THEN [Purchased Quantity (Qtl.)] ELSE 0 END) as ValidCane
      FROM CntPerformance
      WHERE [Purchased Quantity (Qtl.)] > 0
        AND CAST([Weighment Date (Purchy)] AS DATE) >= '2025-10-24'
        AND CAST([Weighment Date (Purchy)] AS DATE) <= '2025-11-30'
    `);
    const rec = r.recordset[0];
    console.log('Numerator:', rec.Numerator);
    console.log('Valid Cane:', rec.ValidCane, ' => My WA:', rec.Numerator / rec.ValidCane);
    console.log('Total Cane:', rec.TotalCane, ' => DAX WA:', rec.Numerator / rec.TotalCane);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
