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

  // What are the distinct C.Code values? Min/max
  const cCodes = await pool.request().query(`
    SELECT [C.Code], COUNT(*) as cnt
    FROM CntPerformance
    GROUP BY [C.Code]
    ORDER BY cnt DESC
  `);
  console.log('C.Code distribution:', cCodes.recordset.slice(0, 10));

  // Proc flow with corrected isCenter logic (C.Code > 0 means center)
  const procFlow = await pool.request()
    .input('fromDate', sql.Date, new Date('2025-10-24'))
    .input('toDate',   sql.Date, new Date('2026-04-06'))
    .query(`
      SELECT
        ISNULL([Mode Name of Transport],'Unknown') as mode,
        CASE WHEN [C.Code] > 0 THEN 1 ELSE 0 END as isCenter,
        COUNT(DISTINCT CHALLAN) as trips,
        SUM([Purchased Quantity (Qtl.)]) as cane,
        AVG(CAST(WaitingTimeCnt   AS FLOAT)) / 60.0 as avgCenterWait,
        AVG(CAST(TravelHrCntYard  AS FLOAT)) / 60.0 as avgTravelToYard,
        AVG(CAST(WaitingTimeYard  AS FLOAT)) / 60.0 as avgYardWait,
        MIN(CAST(WaitingTimeYard  AS FLOAT)) / 60.0 as minYardWait,
        MAX(CAST(WaitingTimeYard  AS FLOAT)) / 60.0 as maxYardWait,
        AVG(CAST(WaitingTimeDonga AS FLOAT)) / 60.0 as avgDongaWait,
        SUM(CASE WHEN (CAST(WaitingTimeYard AS FLOAT)/60.0) > 8.0  AND [C.Code] = 0 THEN 1 ELSE 0 END) as devGateYard,
        SUM(CASE WHEN (CAST(WaitingTimeYard AS FLOAT)/60.0) > 14.0 AND [C.Code] > 0 THEN 1 ELSE 0 END) as devCenterYard,
        SUM(CASE WHEN (CAST(WaitingTimeDonga AS FLOAT)/60.0) > 0.5 THEN 1 ELSE 0 END) as devMill
      FROM CntPerformance
      WHERE CAST([Weighment Date (Purchy)] AS DATE) >= @fromDate
        AND CAST([Weighment Date (Purchy)] AS DATE) <= @toDate
      GROUP BY ISNULL([Mode Name of Transport],'Unknown'),
               CASE WHEN [C.Code] > 0 THEN 1 ELSE 0 END
      ORDER BY isCenter DESC, mode
    `);
  console.log('\nProcurement Flow (corrected):');
  procFlow.recordset.forEach(r => console.log(JSON.stringify(r)));

  // Top centers
  const top = await pool.request()
    .input('fromDate', sql.Date, new Date('2025-10-24'))
    .input('toDate',   sql.Date, new Date('2026-04-06'))
    .query(`
      SELECT TOP 10
        ISNULL([C.Name],'Unknown') as c,
        COUNT(DISTINCT CHALLAN) as trips,
        SUM([Purchased Quantity (Qtl.)]) as cane
      FROM CntPerformance
      WHERE CAST([Weighment Date (Purchy)] AS DATE) >= @fromDate
        AND CAST([Weighment Date (Purchy)] AS DATE) <= @toDate
        AND [C.Code] > 0
      GROUP BY [C.Name]
      ORDER BY cane DESC
    `);
  console.log('\nTop 10 centers:', top.recordset);

  pool.close();
  process.exit(0);
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
