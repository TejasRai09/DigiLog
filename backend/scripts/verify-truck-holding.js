require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER, database: process.env.SQL_DATABASE,
  port: parseInt(process.env.SQL_PORT || 1433, 10),
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 60000 }
};

const FROM = '2025-10-24';
const TO   = '2026-04-06';

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();
  const r = () => pool.request()
    .input('from', sql.Date, new Date(FROM))
    .input('to',   sql.Date, new Date(TO));

  // ─── TruckHoldingTime(Center) — DAX formula equivalent ───────────────────
  // CALCULATE(MAX([Truck Holding Time @ Center (Minutes)]), ALLEXCEPT(..., Challan)) / 60
  // = AVG of (MAX WaitingTimeCnt per Challan) / 60
  const truckHold = await r().query(`
    SELECT AVG(CAST(maxPerChallan AS FLOAT)) / 60.0 as truckHoldingCenter_hrs
    FROM (
      SELECT CHALLAN, MAX(WaitingTimeCnt) as maxPerChallan
      FROM CntPerformance
      WHERE CAST([Weighment Date (Purchy)] AS DATE) >= @from
        AND CAST([Weighment Date (Purchy)] AS DATE) <= @to
      GROUP BY CHALLAN
    ) t
  `);
  console.log('TruckHoldingTime(Center) [expect ~3.22]:', truckHold.recordset[0]);

  // ─── G_CTC Gate Yard section: AVG(TokenToGross)/60 by mode ───────────────
  const gateYard = await r().query(`
    SELECT 
      ISNULL(SUP_MOD,'Unknown') as mode,
      COUNT(purchyno) as vehicles,
      AVG(CAST(TokenToGross AS FLOAT)/60.0) as avgYardHrs,
      SUM(CASE WHEN CAST(TokenToGross AS FLOAT)/60.0 > 8.0 THEN 1 ELSE 0 END) as devOver8H
    FROM G_CTC
    WHERE CAST(m_date AS DATE) >= @from AND CAST(m_date AS DATE) <= @to
    GROUP BY SUP_MOD
    ORDER BY vehicles DESC
  `);
  console.log('\nG_CTC Gate Yard [expect 18QCART~9.78, Total avg~8.80 based on PBI]:');
  gateYard.recordset.forEach(r => console.log(JSON.stringify(r)));
  const totalDevGate = gateYard.recordset.reduce((s,r) => s + r.devOver8H, 0);
  console.log('Total devOver8H:', totalDevGate, '[expect ~32121]');

  // ─── G_CTC Mill Premise section: AVG(GrossToTare)/60 by mode ─────────────
  const mill = await r().query(`
    SELECT 
      ISNULL(SUP_MOD,'Unknown') as mode,
      AVG(CAST(GrossToTare AS FLOAT)/60.0) as avgDongaHrs,
      SUM(CASE WHEN CAST(GrossToTare AS FLOAT)/60.0 > 0.5 THEN 1 ELSE 0 END) as devOver05H
    FROM G_CTC
    WHERE CAST(m_date AS DATE) >= @from AND CAST(m_date AS DATE) <= @to
    GROUP BY SUP_MOD
    ORDER BY SUP_MOD
  `);
  console.log('\nG_CTC Mill Premise [expect 18QCART~0.36, Total~0.54, totalDev~42854]:');
  mill.recordset.forEach(r => console.log(JSON.stringify(r)));
  const totalDevMill = mill.recordset.reduce((s,r) => s + r.devOver05H, 0);
  console.log('Total devOver05H:', totalDevMill, '[expect ~42854]');

  pool.close();
  process.exit(0);
}
run().catch(err => { console.error('Error:', err.message); process.exit(1); });
