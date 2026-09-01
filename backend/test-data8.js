const { poolPromise, sql } = require('./utils/sqlServer');
async function run() {
  const pool = await poolPromise;
  
  console.time('Sargable Query');
  await pool.request()
    .input('fromDate', sql.Date, new Date('2025-10-24'))
    .input('toDate', sql.Date, new Date('2025-11-30'))
    .query(`
      SELECT COUNT(*) as count 
      FROM CntPerformance 
      WHERE [Weighment Date (Purchy)] >= @fromDate 
        AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
    `);
  console.timeEnd('Sargable Query');

  console.time('Non-Sargable Query (Original)');
  await pool.request()
    .input('fromDate', sql.Date, new Date('2025-10-24'))
    .input('toDate', sql.Date, new Date('2025-11-30'))
    .query(`
      SELECT COUNT(*) as count 
      FROM CntPerformance 
      WHERE CAST([Weighment Date (Purchy)] AS DATE) >= @fromDate 
        AND CAST([Weighment Date (Purchy)] AS DATE) <= @toDate
    `);
  console.timeEnd('Non-Sargable Query (Original)');

  process.exit(0);
}
run();
