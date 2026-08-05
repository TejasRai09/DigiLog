require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER, database: process.env.SQL_DATABASE,
  port: parseInt(process.env.SQL_PORT || 1433, 10),
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 60000 }
};

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();

  // G_CTC: Check TokenToGross (Yard Holding) and GrossToTare (Unloading) as hours
  const gGateYard = await pool.request()
    .input('fromDate', sql.Date, new Date('2025-10-24'))
    .input('toDate',   sql.Date, new Date('2026-04-06'))
    .query(`
      SELECT 
        ISNULL(SUP_MOD,'Unknown') as mode,
        COUNT(purchyno) as vehicles,
        AVG(CAST(TokenToGross AS FLOAT) / 60.0) as avgYardHoldingHrs,
        SUM(CASE WHEN (CAST(TokenToGross AS FLOAT)/60.0) > 8.0 THEN 1 ELSE 0 END) as devsOver8H,
        AVG(CAST(GrossToTare  AS FLOAT) / 60.0) as avgUnloadingHrs,
        SUM(CASE WHEN (CAST(GrossToTare  AS FLOAT)/60.0) > 0.5 THEN 1 ELSE 0 END) as devsOver05H
      FROM G_CTC
      WHERE CAST(m_date AS DATE) >= @fromDate AND CAST(m_date AS DATE) <= @toDate
      GROUP BY SUP_MOD
      ORDER BY vehicles DESC
    `);
  console.log('G_CTC Gate Yard & Unloading by mode:');
  gGateYard.recordset.forEach(r => console.log(JSON.stringify(r)));

  // Check TruckHoldingTime(Center) column existence in CntPerformance
  const truckHold = await pool.request().query(`
    SELECT TOP 5 
      [WaitingTimeCnt],
      [TravelHrCntYard],
      [WaitingTimeYard],
      [WaitingTimeDonga]
    FROM CntPerformance
    WHERE WaitingTimeCnt IS NOT NULL
  `);
  console.log('\nCntPerformance time fields sample (in minutes):');
  truckHold.recordset.forEach(r => console.log(JSON.stringify(r)));

  // Check if TruckHoldingTime(Center) is a computed/view column
  const checkCol = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CntPerformance' 
      AND COLUMN_NAME LIKE '%Truck%'
  `);
  console.log('\nTruck columns in CntPerformance:', checkCol.recordset);

  pool.close();
  process.exit(0);
}
run().catch(err => { console.error('Error:', err.message); process.exit(1); });
