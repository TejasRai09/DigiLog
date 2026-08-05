require('dotenv').config();
const { poolPromise } = require('./utils/sqlServer');
async function run() {
  try {
    const pool = await poolPromise;
    const dates = [
      '[Weighment Date (Purchy)]',
      '[Purchy Issue Date (SMS Date)]',
      'M_TokenDate_Time',
      'TT_DATE'
    ];
    for (const d of dates) {
      const r = await pool.request().query(`
        SELECT 
          SUM(
            CAST(DATEDIFF(MINUTE, CentreArr, M_TokenDate_Time) AS FLOAT) / 60.0
            * [Purchased Quantity (Qtl.)]
          ) as Numerator,
          SUM([Purchased Quantity (Qtl.)]) as TotalCane
        FROM CntPerformance
        WHERE [Purchased Quantity (Qtl.)] > 0
          AND CAST(${d} AS DATE) >= '2025-10-24'
          AND CAST(${d} AS DATE) <= '2025-11-30'
      `);
      const num = r.recordset[0].Numerator || 0;
      const den = r.recordset[0].TotalCane || 1;
      console.log(`${d}: DAX WA = ${num / den}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
