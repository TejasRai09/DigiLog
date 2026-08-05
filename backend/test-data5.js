require('dotenv').config();
const { poolPromise } = require('./utils/sqlServer');
async function run() {
  try {
    const pool = await poolPromise;

    const queries = [
      { name: 'Weighment Date', col: '[Weighment Date (Purchy)]' },
      { name: 'Purchy Issue Date', col: '[Purchy Issue Date (SMS Date)]' },
      { name: 'Token Date Time', col: 'M_TokenDate_Time' },
      { name: 'TT_DATE', col: 'TT_DATE' },
      { name: 'Gross Weighment', col: '[Gross Weighment @ Centre (Grower) (Date/Time)\r\n]' },
      { name: 'CH_DEP_DATE', col: 'CH_DEP_DATE' }
    ];

    for (const q of queries) {
      try {
        const r = await pool.request().query(`
          SELECT COUNT(DISTINCT CHALLAN) as trips, COUNT(*) as vehicles, SUM([Purchased Quantity (Qtl.)]) as cane
          FROM CntPerformance
          WHERE CAST(${q.col} AS DATE) >= '2025-10-24' AND CAST(${q.col} AS DATE) <= '2025-11-30'
            AND [C.Code] > 0
        `);
        console.log(`${q.name}:`, r.recordset[0]);
      } catch (e) {
        console.log(`${q.name}: Error`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
