const { poolPromise } = require('../utils/sqlServer');
const { pool: mysqlPool } = require('../config/mysql');
const { clearDateRangeCache } = require('../controllers/canePerformanceMysql');

const COOLDOWN_MS = 60_000; // Auto-sync at most once per minute
let lastSyncTime = 0;
let lastSyncStatus = 'idle';
let lastSyncResult = null;
let inFlightPromise = null;

function parseDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof val === 'string') {
    const s = val.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (m) {
      const month = m[1].padStart(2, '0');
      const day = m[2].padStart(2, '0');
      const year = m[3];
      const hh = (m[4] || '00').padStart(2, '0');
      const mm = (m[5] || '00').padStart(2, '0');
      const ss = (m[6] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return null;
}

function parseYmd(val) {
  const dt = parseDateStr(val);
  return dt ? dt.slice(0, 10) : null;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function persistSyncStatus(status, details = {}) {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await mysqlPool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?), (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [
        'cane_performance_last_synced_at', timestamp,
        'cane_performance_last_sync_status', JSON.stringify({ status, ...details, timestamp }),
      ]
    );
  } catch (err) {
    console.warn('[caneLiveSync] Failed to persist sync status in portal_settings:', err.message);
  }
}

async function performSync() {
  const t0 = Date.now();
  const mssql = await poolPromise;
  if (!mssql) {
    throw new Error('SQL Server connection is not available');
  }

  // 1. Fetch & Upsert G_CTC
  const gctcRes = await mssql.request().query(`
    SELECT 
      v_code, v_name, g_code, g_name, g_father, purchyno,
      SUP_MOD, m_date, PUR_ISSUE_DT, PUR_WEIGHT_DT, CutDate,
      KACHATOKENDATETIME, Tokendatetime, Grossdatetime, TAREdatetime,
      Purchase_QTL, CutToToken, TokenToGross, GrossToTare, CTC
    FROM G_CTC
    WHERE purchyno IS NOT NULL
  `);

  const gctcRows = (gctcRes.recordset || []).map((r) => {
    const mDate = parseYmd(r.m_date);
    const tokenToGrossMins = numOrNull(r.TokenToGross);
    const grossToTareMins = numOrNull(r.GrossToTare);
    const cutToTokenMins = numOrNull(r.CutToToken);

    return [
      intOrNull(r.v_code),
      r.v_name ? String(r.v_name).trim() : null,
      intOrNull(r.g_code),
      r.g_name ? String(r.g_name).trim() : null,
      r.g_father ? String(r.g_father).trim() : null,
      intOrNull(r.purchyno),
      r.SUP_MOD ? String(r.SUP_MOD).trim() : null,
      mDate,
      parseDateStr(r.PUR_ISSUE_DT),
      parseDateStr(r.PUR_WEIGHT_DT),
      parseDateStr(r.CutDate),
      parseDateStr(r.KACHATOKENDATETIME),
      parseDateStr(r.Tokendatetime),
      parseDateStr(r.Grossdatetime),
      parseDateStr(r.TAREdatetime),
      numOrNull(r.Purchase_QTL),
      tokenToGrossMins != null ? +(tokenToGrossMins / 60.0).toFixed(4) : null,
      cutToTokenMins != null ? +(cutToTokenMins / 60.0).toFixed(4) : null,
      grossToTareMins != null ? +(grossToTareMins / 60.0).toFixed(4) : null,
      mDate,
    ];
  });

  let gctcAffected = 0;
  if (gctcRows.length > 0) {
    const gctcSql = `
      INSERT INTO g_ctc (
        v_code, v_name, g_code, g_name, g_father, purchyno,
        sup_mod, m_date, pur_issue_dt, pur_weight_dt, cut_date,
        kacha_token_datetime, token_datetime, gross_datetime, tare_datetime,
        purchase_qtl, yard_holding_time, cut_to_token_time, unloading_time,
        report_date
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        v_code = VALUES(v_code),
        v_name = VALUES(v_name),
        g_code = VALUES(g_code),
        g_name = VALUES(g_name),
        g_father = VALUES(g_father),
        sup_mod = VALUES(sup_mod),
        m_date = VALUES(m_date),
        pur_issue_dt = VALUES(pur_issue_dt),
        pur_weight_dt = VALUES(pur_weight_dt),
        cut_date = VALUES(cut_date),
        kacha_token_datetime = VALUES(kacha_token_datetime),
        token_datetime = VALUES(token_datetime),
        gross_datetime = VALUES(gross_datetime),
        tare_datetime = VALUES(tare_datetime),
        purchase_qtl = VALUES(purchase_qtl),
        yard_holding_time = VALUES(yard_holding_time),
        cut_to_token_time = VALUES(cut_to_token_time),
        unloading_time = VALUES(unloading_time),
        report_date = VALUES(report_date)
    `;
    const [resG] = await mysqlPool.query(gctcSql, [gctcRows]);
    gctcAffected = resG.affectedRows;
  }

  // 2. Fetch & Upsert CntPerformance
  const cntRes = await mssql.request().query(`
    SELECT 
      [C.Code], [C.Name], [V.Code], [V.Name], [G.Code], [G.Name], [G.Father],
      [Purchy No.], [Mode Code of Transport], [Mode Name of Transport],
      [Purchy Issue Date (SMS Date)], [Weighment Date (Purchy)],
      [Purchased Quantity (Qtl.)], [Harvest (Date/Time)],
      [Gross Weighment @ Centre (Grower) (Date/Time)\r\n] AS GrossWeighmentCentre,
      [Tare Weighment @ Centre (Grower) (Date/Time) (6)] AS TareWeighmentCentre,
      CHALLAN, CH_DEP_DATE, M_TokenDate_Time, TT_TOKDATETIME, KTOKENDATETIME,
      TT_GRODATETIME, TT_DATE, TravelHrToCnt, WaitingTimeCnt, TravelHrCntYard,
      WaitingTimeYard, WaitingTimeDonga, ToalTimeCTC, CentreArr,
      [Truck @ Yard (GPS Based) (Date/Time)] AS TruckYardGPS
    FROM CntPerformance
    WHERE [Purchy No.] IS NOT NULL
  `);

  const cntRows = (cntRes.recordset || []).map((r) => {
    const reportDate = parseYmd(r['Weighment Date (Purchy)']);
    const waitCnt = numOrNull(r.WaitingTimeCnt);
    const travelCntYard = numOrNull(r.TravelHrCntYard);
    const waitYard = numOrNull(r.WaitingTimeYard);
    const waitDonga = numOrNull(r.WaitingTimeDonga);

    let caneHold = null;
    if (waitCnt != null || travelCntYard != null || waitYard != null || waitDonga != null) {
      caneHold = +(((waitCnt || 0) + (travelCntYard || 0) + (waitYard || 0) + (waitDonga || 0)) / 60.0).toFixed(4);
    }

    return [
      r['C.Name'] ? String(r['C.Name']).trim() : null,
      r['V.Name'] ? String(r['V.Name']).trim() : null,
      r['G.Name'] ? String(r['G.Name']).trim() : null,
      r['G.Father'] ? String(r['G.Father']).trim() : null,
      intOrNull(r['Purchy No.']),
      r['Mode Name of Transport'] ? String(r['Mode Name of Transport']).trim() : null,
      parseYmd(r['Purchy Issue Date (SMS Date)']),
      reportDate,
      numOrNull(r['Purchased Quantity (Qtl.)']),
      parseYmd(r['Harvest (Date/Time)']),
      parseDateStr(r.GrossWeighmentCentre),
      parseDateStr(r.TareWeighmentCentre),
      intOrNull(r.CHALLAN),
      parseDateStr(r.CH_DEP_DATE),
      parseDateStr(r.M_TokenDate_Time),
      parseDateStr(r.TT_TOKDATETIME),
      parseDateStr(r.KTOKENDATETIME),
      parseDateStr(r.TT_GRODATETIME),
      parseDateStr(r.TT_DATE),
      reportDate,
      waitCnt != null ? +(waitCnt / 60.0).toFixed(4) : null,
      intOrNull(waitCnt),
      travelCntYard != null ? +(travelCntYard / 60.0).toFixed(4) : null,
      waitYard != null ? +(waitYard / 60.0).toFixed(4) : null,
      waitDonga != null ? +(waitDonga / 60.0).toFixed(4) : null,
      waitCnt != null ? +(waitCnt / 60.0).toFixed(4) : null, // truck_holding_time_center
      intOrNull(r['Mode Code of Transport']),
      caneHold,
    ];
  });

  let cntAffected = 0;
  if (cntRows.length > 0) {
    const cntSql = `
      INSERT INTO cnt_performance (
        center, v_name, grower, g_father, purchy_no, transport_mode,
        purchy_issue_date, weighment_date_purchy, cane_qty_qtls, harvest_date,
        gross_weighment_centre, tare_weighment_centre, challan_no, challan_issue_time,
        vehicle_arrival_center, truck_yard_token_time, truck_yard_kaccha_token,
        gate_weighment_time, tare_weighment_mill, report_date,
        holding_time_center, truck_holding_time_center_minutes,
        truck_transit_time, yard_waiting_time, unloading_time,
        truck_holding_time_center,
        mode_code_of_transport, cane_holding_time
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        center = VALUES(center),
        v_name = VALUES(v_name),
        grower = VALUES(grower),
        g_father = VALUES(g_father),
        transport_mode = VALUES(transport_mode),
        purchy_issue_date = VALUES(purchy_issue_date),
        weighment_date_purchy = VALUES(weighment_date_purchy),
        cane_qty_qtls = VALUES(cane_qty_qtls),
        harvest_date = VALUES(harvest_date),
        gross_weighment_centre = VALUES(gross_weighment_centre),
        tare_weighment_centre = VALUES(tare_weighment_centre),
        challan_no = VALUES(challan_no),
        challan_issue_time = VALUES(challan_issue_time),
        vehicle_arrival_center = VALUES(vehicle_arrival_center),
        truck_yard_token_time = VALUES(truck_yard_token_time),
        truck_yard_kaccha_token = VALUES(truck_yard_kaccha_token),
        gate_weighment_time = VALUES(gate_weighment_time),
        tare_weighment_mill = VALUES(tare_weighment_mill),
        report_date = VALUES(report_date),
        holding_time_center = VALUES(holding_time_center),
        truck_holding_time_center_minutes = VALUES(truck_holding_time_center_minutes),
        truck_transit_time = VALUES(truck_transit_time),
        yard_waiting_time = VALUES(yard_waiting_time),
        unloading_time = VALUES(unloading_time),
        truck_holding_time_center = VALUES(truck_holding_time_center),
        mode_code_of_transport = VALUES(mode_code_of_transport),
        cane_holding_time = VALUES(cane_holding_time)
    `;
    const [resC] = await mysqlPool.query(cntSql, [cntRows]);
    cntAffected = resC.affectedRows;
  }

  if (typeof clearDateRangeCache === 'function') {
    clearDateRangeCache();
  }

  const elapsed = Date.now() - t0;
  console.log(`[caneLiveSync] Synced G_CTC (${gctcRows.length} rows) and CntPerformance (${cntRows.length} rows) in ${elapsed}ms`);

  const result = {
    success: true,
    gctcCount: gctcRows.length,
    cntCount: cntRows.length,
    gctcAffected,
    cntAffected,
    elapsedMs: elapsed,
    syncedAt: new Date().toISOString(),
  };

  lastSyncTime = Date.now();
  lastSyncStatus = 'success';
  lastSyncResult = result;
  await persistSyncStatus('success', result);

  return result;
}

/**
 * Triggers a live sync from MSSQL into MySQL.
 * Throttled to COOLDOWN_MS unless force=true.
 */
async function syncLiveCaneData({ force = false } = {}) {
  const now = Date.now();
  if (!force && lastSyncTime > 0 && now - lastSyncTime < COOLDOWN_MS) {
    return {
      success: true,
      skipped: true,
      reason: 'cooldown',
      lastSyncTime: new Date(lastSyncTime).toISOString(),
    };
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = performSync()
    .catch(async (err) => {
      console.error('[caneLiveSync] Sync failed:', err.message);
      lastSyncStatus = 'error';
      lastSyncResult = { success: false, error: err.message };
      await persistSyncStatus('error', { error: err.message });
      return { success: false, error: err.message };
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

function getLastSyncInfo() {
  return {
    lastSyncTime: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
    lastSyncStatus,
    lastSyncResult,
  };
}

module.exports = {
  syncLiveCaneData,
  getLastSyncInfo,
};

