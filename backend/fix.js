const { poolPromise, sql } = require('../utils/sqlServer');
const { pool: mysqlPool } = require('../config/mysql');

const USE_MSSQL_LIVE = true; // Set to false to use local MySQL backlog data instead

const getGate1Data = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (USE_MSSQL_LIVE) {
      const pool = await poolPromise;
      if (!pool) {
        return res.status(503).json({ error: 'SQL Server is unavailable. Check server connection.' });
      }

      const request = pool.request();
      request.input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'));
      request.input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'));

      const modePieResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            ISNULL(SUP_MOD, 'Unknown') as mode,
            COUNT(purchyno) as purchy,
            SUM(Purchase_QTL) as caneQty
          FROM G_CTC
          WHERE m_date >= @fromDate AND m_date < DATEADD(day, 1, @toDate)
          GROUP BY SUP_MOD
        `);

      const trendResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT TOP 30
            CAST(m_date AS DATE) as date,
            SUM(Purchase_QTL) as qty
          FROM G_CTC
          WHERE m_date IS NOT NULL 
            AND m_date >= @fromDate AND m_date < DATEADD(day, 1, @toDate)
          GROUP BY CAST(m_date AS DATE)
          ORDER BY date DESC
        `);

      const kpiResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            COUNT(DISTINCT CHALLAN) as totalChallan,
            AVG(CAST(WaitingTimeYard   AS FLOAT)) / 60.0 as yardWaiting,
            AVG(CAST(WaitingTimeDonga  AS FLOAT)) / 60.0 as waCane,
            AVG(CAST(TravelHrCntYard   AS FLOAT)) / 60.0 as truckTransit
          FROM CntPerformance
          WHERE [Weighment Date (Purchy)] >= @fromDate
            AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
        `);

      const truckHoldResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT AVG(CAST(maxPerChallan AS FLOAT)) / 60.0 as truckHolding
          FROM (
            SELECT CHALLAN, MAX(WaitingTimeCnt) as maxPerChallan
            FROM CntPerformance
            WHERE [Weighment Date (Purchy)] >= @fromDate
              AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
            GROUP BY CHALLAN
          ) t
        `);

      const waCaneHoldResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            SUM(
              CAST(DATEDIFF(MINUTE, CentreArr, M_TokenDate_Time) AS FLOAT) / 60.0
              * [Purchased Quantity (Qtl.)]
            ) / NULLIF(SUM([Purchased Quantity (Qtl.)]), 0) as waCaneHolding
          FROM CntPerformance
          WHERE [Purchased Quantity (Qtl.)] > 0
            AND [Weighment Date (Purchy)] >= @fromDate
            AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
        `);

      const gateYardResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            ISNULL(SUP_MOD, 'Unknown') as mode,
            COUNT(purchyno) as vehicles,
            SUM(Purchase_QTL) as cane,
            AVG(CAST(TokenToGross AS FLOAT) / 60.0) as avgYardHrs,
            SUM(CASE WHEN CAST(TokenToGross AS FLOAT)/60.0 > 8.0 THEN 1 ELSE 0 END) as devOver8H
          FROM G_CTC
          WHERE m_date >= @fromDate AND m_date < DATEADD(day, 1, @toDate)
          GROUP BY SUP_MOD
          ORDER BY vehicles DESC
        `);

      const gateMillResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            ISNULL(SUP_MOD, 'Unknown') as mode,
            COUNT(purchyno) as vehicles,
            AVG(CAST(GrossToTare AS FLOAT) / 60.0) as avgDongaHrs,
            SUM(CASE WHEN CAST(GrossToTare AS FLOAT)/60.0 > 0.5 THEN 1 ELSE 0 END) as devOver05H
          FROM G_CTC
          WHERE m_date >= @fromDate AND m_date < DATEADD(day, 1, @toDate)
          GROUP BY SUP_MOD
          ORDER BY SUP_MOD
        `);

      const sidebarResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            SUM(Purchase_QTL) as totalCanePurchased,
            COUNT(purchyno) as noOfPurchy,
            (SUM(Purchase_QTL) / NULLIF(COUNT(purchyno), 0)) as avgPurchySize
          FROM G_CTC
          WHERE m_date >= @fromDate AND m_date < DATEADD(day, 1, @toDate)
        `);

      const overrunResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            ISNULL(SUP_MOD, 'Unknown') as mode,
            AVG(Purchase_QTL) - 
              CASE 
                WHEN SUP_MOD LIKE '18%' THEN 18.0
                WHEN SUP_MOD LIKE '36%' THEN 36.0
                WHEN SUP_MOD LIKE '45%' THEN 45.0
                WHEN SUP_MOD LIKE '63%' THEN 63.0
                WHEN SUP_MOD LIKE '99%' THEN 99.0
                ELSE NULL
              END as avgOverrun
          FROM G_CTC
          WHERE Purchase_QTL > 0
            AND m_date >= @fromDate
            AND m_date < DATEADD(day, 1, @toDate)
          GROUP BY SUP_MOD
        `);

      const cntOverrunResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            ISNULL([Mode Name of Transport], 'Unknown') as mode,
            AVG([Purchased Quantity (Qtl.)]) - 
              CASE 
                WHEN [Mode Name of Transport] LIKE '18%' THEN 18.0
                WHEN [Mode Name of Transport] LIKE '36%' THEN 36.0
                WHEN [Mode Name of Transport] LIKE '45%' THEN 45.0
                WHEN [Mode Name of Transport] LIKE '63%' THEN 63.0
                ELSE NULL
              END as avgOverrun
          FROM CntPerformance
          WHERE [Purchased Quantity (Qtl.)] > 0
            AND [Mode Name of Transport] IS NOT NULL
            AND [Weighment Date (Purchy)] >= @fromDate
            AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
          GROUP BY [Mode Name of Transport]
        `);

      const procFlowResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT 
            ISNULL([Mode Name of Transport], 'Unknown') as mode,
            CASE WHEN [C.Code] > 0 THEN 1 ELSE 0 END as isCenter,
            COUNT(DISTINCT CHALLAN) as trips,
            SUM([Purchased Quantity (Qtl.)]) as cane,
            AVG(CAST(WaitingTimeCnt   AS FLOAT)) / 60.0 as avgCenterWait,
            AVG(CAST(TravelHrCntYard  AS FLOAT)) / 60.0 as avgTravelToYard,
            AVG(CAST(WaitingTimeYard  AS FLOAT)) / 60.0 as avgYardWait,
            MIN(CAST(WaitingTimeYard  AS FLOAT)) / 60.0 as minYardWait,
            MAX(CAST(WaitingTimeYard  AS FLOAT)) / 60.0 as maxYardWait,
            AVG(CAST(WaitingTimeDonga AS FLOAT)) / 60.0 as avgDongaWait,
            SUM(CASE WHEN (CAST(WaitingTimeYard  AS FLOAT) / 60.0) > 8.0  AND [C.Code] = 0 THEN 1 ELSE 0 END) as devGateYard,
            SUM(CASE WHEN (CAST(WaitingTimeYard  AS FLOAT) / 60.0) > 14.0 AND [C.Code] > 0 THEN 1 ELSE 0 END) as devCenterYard,
            SUM(CASE WHEN (CAST(WaitingTimeDonga AS FLOAT) / 60.0) > 0.5 THEN 1 ELSE 0 END) as devMill
          FROM CntPerformance
          WHERE [Weighment Date (Purchy)] >= @fromDate AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
          GROUP BY ISNULL([Mode Name of Transport], 'Unknown'),
                   CASE WHEN [C.Code] > 0 THEN 1 ELSE 0 END
        `);

      const topCentersResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT TOP 10
            ISNULL([C.Name], 'Unknown') as c,
            COUNT(DISTINCT CHALLAN) as trips,
            SUM([Purchased Quantity (Qtl.)]) as cane
          FROM CntPerformance
          WHERE [Weighment Date (Purchy)] >= @fromDate AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
            AND [C.Code] > 0
          GROUP BY [C.Name]
          ORDER BY cane DESC
        `);

      const bottomCentersResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT TOP 10
            ISNULL([C.Name], 'Unknown') as c,
            COUNT(DISTINCT CHALLAN) as trips,
            SUM([Purchased Quantity (Qtl.)]) as cane
          FROM CntPerformance
          WHERE [Weighment Date (Purchy)] >= @fromDate AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
            AND [C.Code] > 0
          GROUP BY [C.Name]
          ORDER BY cane ASC
        `);

      const dbRowsResult = await pool.request()
        .input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'))
        .input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'))
        .query(`
          SELECT TOP 500
            [Purchy No.] as purchyNo,
            ISNULL([C.Name], 'Gate') as center,
            [G.Name] as grower,
            [V.Name] as vehicle,
            [Purchased Quantity (Qtl.)] as caneQty,
            [CHALLAN] as challanNo,
            [Mode Name of Transport] as mode,
            [Weighment Date (Purchy)] as arrival,
            CAST(WaitingTimeYard AS FLOAT) / 60.0 as holding,
            CAST(WaitingTimeDonga AS FLOAT) / 60.0 as truckH
          FROM CntPerformance
          WHERE [Weighment Date (Purchy)] >= @fromDate AND [Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)
          ORDER BY [Weighment Date (Purchy)] DESC
        `);

      res.json({
        modeData: modePieResult.recordset,
        trendData: trendResult.recordset,
        kpis: {
          totalChallan:  kpiResult.recordset[0]?.totalChallan  || 0,
          yardWaiting:   kpiResult.recordset[0]?.yardWaiting   || 0,
          waCane:        kpiResult.recordset[0]?.waCane         || 0,
          truckTransit:  kpiResult.recordset[0]?.truckTransit   || 0,
          truckHolding:  truckHoldResult.recordset[0]?.truckHolding  || 0,
          caneHolding:   waCaneHoldResult.recordset[0]?.waCaneHolding || 0,
        },
        sidebar: {
          totalCanePurchased: sidebarResult.recordset[0]?.totalCanePurchased || 0,
          noOfPurchy:         sidebarResult.recordset[0]?.noOfPurchy         || 0,
          avgPurchySize:      sidebarResult.recordset[0]?.avgPurchySize       || 0
        },
        overruns:    overrunResult.recordset,
        cntOverruns: cntOverrunResult.recordset,
        procurementFlow: procFlowResult.recordset,
        gateYard: gateYardResult.recordset,
        gateMill: gateMillResult.recordset,
        topCenters:    topCentersResult.recordset,
        bottomCenters: bottomCentersResult.recordset,
        dbRows:        dbRowsResult.recordset
      });
