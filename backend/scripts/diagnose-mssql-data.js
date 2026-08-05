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

const FROM = '2025-10-24';
const TO   = '2026-04-06';

async function run() {
  const pool = await new sql.ConnectionPool(config).connect();
  const r = () => pool.request()
    .input('fromDate', sql.Date, new Date(FROM))
    .input('toDate',   sql.Date, new Date(TO));

  // ── G_CTC checks ──────────────────────────────────────────────────────────
  const gMode = await r().query(`
    SELECT ISNULL(SUP_MOD,'Unknown') as mode, COUNT(purchyno) as purchy, SUM(Purchase_QTL) as caneQty
    FROM G_CTC
    WHERE CAST(m_date AS DATE) >= @fromDate AND CAST(m_date AS DATE) <= @toDate
    GROUP BY SUP_MOD
  `);
  console.log('G_CTC mode split:', gMode.recordset);

  const gSidebar = await r().query(`
    SELECT SUM(Purchase_QTL) as total, COUNT(purchyno) as purchy
    FROM G_CTC
    WHERE CAST(m_date AS DATE) >= @fromDate AND CAST(m_date AS DATE) <= @toDate
  `);
  console.log('G_CTC sidebar:', gSidebar.recordset[0]);

  // ── CntPerformance checks ─────────────────────────────────────────────────
  // Times are in MINUTES in MSSQL — divide by 60 to get hours
  const kpi = await r().query(`
    SELECT
      COUNT(DISTINCT CHALLAN) as totalChallan,
      AVG(CAST(WaitingTimeYard   AS FLOAT)) / 60.0 as yardWaiting,
      AVG(CAST(WaitingTimeDonga  AS FLOAT)) / 60.0 as waCane,
      AVG(CAST(TravelHrCntYard   AS FLOAT)) / 60.0 as truckTransit,
      AVG(CAST(WaitingTimeCnt    AS FLOAT)) / 60.0 as centerWait
    FROM CntPerformance
    WHERE CAST([Weighment Date (Purchy)] AS DATE) >= @fromDate
      AND CAST([Weighment Date (Purchy)] AS DATE) <= @toDate
  `);
  console.log('\nCntPerformance KPIs:', kpi.recordset[0]);

  // C.Code check — what values does it hold?
  const cCodeSample = await pool.request().query(`
    SELECT TOP 5 [C.Code], [C.Name], [Mode Name of Transport], 
      WaitingTimeYard, WaitingTimeCnt, TravelHrCntYard, WaitingTimeDonga
    FROM CntPerformance WHERE [C.Code] IS NOT NULL
  `);
  console.log('\nCntPerformance C.Code sample:', cCodeSample.recordset);

  const cCodeNull = await pool.request().query(`
    SELECT COUNT(*) as gateRows FROM CntPerformance WHERE [C.Code] IS NULL OR [C.Code] = 0
  `);
  console.log('CntPerformance Gate rows (C.Code NULL/0):', cCodeNull.recordset[0]);

  const totalCnt = await pool.request().query(`SELECT COUNT(*) as total FROM CntPerformance`);
  console.log('CntPerformance total:', totalCnt.recordset[0]);

  pool.close();
  process.exit(0);
}

run().catch(err => { console.error('Error:', err.message); process.exit(1); });
