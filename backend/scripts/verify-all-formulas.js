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

  // ── Step 1: Check how many rows have non-NULL CentreArr ──────────────────
  const centreArrCheck = await pool.request().query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN CentreArr IS NOT NULL THEN 1 ELSE 0 END) as hasArrival,
      SUM(CASE WHEN [Harvest (Date/Time)] IS NOT NULL THEN 1 ELSE 0 END) as hasHarvest
    FROM CntPerformance
  `);
  console.log('CentreArr / Harvest nullability:', centreArrCheck.recordset[0]);

  // ── Step 2: Try WA Cane Holding Time with each possible "Gate Weighment Time" column ──
  // Candidates: M_TokenDate_Time, TT_TOKDATETIME, TT_GRODATETIME, TT_DATE
  const candidates = ['M_TokenDate_Time', 'TT_TOKDATETIME', 'KTOKENDATETIME', 'TT_GRODATETIME', 'TT_DATE'];
  for (const col of candidates) {
    try {
      const res = await pool.request()
        .input('from', sql.Date, new Date(FROM))
        .input('to',   sql.Date, new Date(TO))
        .query(`
          SELECT 
            '${col}' as gateWeighmentCol,
            SUM(CAST(DATEDIFF(MINUTE, CentreArr, [${col}]) AS FLOAT) / 60.0 * [Purchased Quantity (Qtl.)]) 
              / NULLIF(SUM([Purchased Quantity (Qtl.)])  , 0) as waHoldingHrs,
            COUNT(*) as rowsUsed
          FROM CntPerformance
          WHERE CentreArr IS NOT NULL
            AND [${col}] IS NOT NULL
            AND [Purchased Quantity (Qtl.)] > 0
            AND CAST([Weighment Date (Purchy)] AS DATE) >= @from
            AND CAST([Weighment Date (Purchy)] AS DATE) <= @to
        `);
      console.log(JSON.stringify(res.recordset[0]));
    } catch(e) {
      console.log(col, 'ERROR:', e.message.substring(0, 80));
    }
  }

  // ── Step 3: CuttoCenterTime — DATEDIFF(Harvest, CentreArr, MINUTE)/60 ───
  const cutToCenter = await r().query(`
    SELECT 
      AVG(CAST(DATEDIFF(MINUTE, [Harvest (Date/Time)], CentreArr) AS FLOAT) / 60.0) as avgCuttoCenterHrs,
      COUNT(*) as rowsUsed
    FROM CntPerformance
    WHERE [Harvest (Date/Time)] IS NOT NULL
      AND CentreArr IS NOT NULL
      AND CAST([Weighment Date (Purchy)] AS DATE) >= @from
      AND CAST([Weighment Date (Purchy)] AS DATE) <= @to
  `);
  console.log('\nCuttoCenterTime avg:', cutToCenter.recordset[0]);

  // ── Step 4: CuttoTokenTime — DATEDIFF(CutDate, Tokendatetime, MINUTE)/60 from G_CTC ──
  // Both stored as nvarchar, need TRY_CONVERT
  const cutToToken = await r().query(`
    SELECT 
      AVG(CAST(DATEDIFF(MINUTE, 
        TRY_CONVERT(datetime, CutDate, 101), 
        TRY_CONVERT(datetime, Tokendatetime, 101)
      ) AS FLOAT) / 60.0) as avgCuttoTokenHrs,
      COUNT(*) as rowsUsed
    FROM G_CTC
    WHERE CutDate IS NOT NULL
      AND Tokendatetime IS NOT NULL
      AND CAST(m_date AS DATE) >= @from
      AND CAST(m_date AS DATE) <= @to
  `);
  console.log('CuttoTokenTime avg:', cutToToken.recordset[0]);

  // ── Step 5: Center Overruns (from CntPerformance per DAX) ────────────────
  const cntOverrun = await r().query(`
    SELECT 
      [Mode Name of Transport] as mode,
      AVG([Purchased Quantity (Qtl.)]) - 
        CASE 
          WHEN [Mode Name of Transport] LIKE '18%' THEN 18
          WHEN [Mode Name of Transport] LIKE '36%' THEN 36
          WHEN [Mode Name of Transport] LIKE '45%' THEN 45
          WHEN [Mode Name of Transport] LIKE '63%' THEN 63
          ELSE NULL
        END as avgOverrun
    FROM CntPerformance
    WHERE [Purchased Quantity (Qtl.)] > 0
      AND [Mode Name of Transport] IS NOT NULL
      AND CAST([Weighment Date (Purchy)] AS DATE) >= @from
      AND CAST([Weighment Date (Purchy)] AS DATE) <= @to
    GROUP BY [Mode Name of Transport]
  `);
  console.log('\nCenter Overruns (CntPerformance):', cntOverrun.recordset);

  // ── Step 6: Gate Overruns (from G_CTC per DAX) ───────────────────────────
  const gateOverrun = await r().query(`
    SELECT 
      SUP_MOD as mode,
      AVG(Purchase_QTL) - 
        CASE 
          WHEN SUP_MOD LIKE '18%' THEN 18
          WHEN SUP_MOD LIKE '36%' THEN 36
          WHEN SUP_MOD LIKE '63%' THEN 63
          WHEN SUP_MOD LIKE '99%' THEN 99
          ELSE NULL
        END as avgOverrun
    FROM G_CTC
    WHERE Purchase_QTL > 0
      AND CAST(m_date AS DATE) >= @from
      AND CAST(m_date AS DATE) <= @to
    GROUP BY SUP_MOD
  `);
  console.log('Gate Overruns (G_CTC):', gateOverrun.recordset);

  pool.close();
  process.exit(0);
}
run().catch(err => { console.error('Error:', err.message); process.exit(1); });
