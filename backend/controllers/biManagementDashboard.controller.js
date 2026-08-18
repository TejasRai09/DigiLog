const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { canAccessForm } = require('./form.controller');
const { buildRows, n, nullableNum } = require('../utils/managementDashboardMeasures');
const { buildManagementSeries } = require('../utils/managementDashboardSeries');
const { computeDmrKpis } = require('../utils/dmrDailyMeasures');

const FORM_KEY = 'bi_management_dashboard';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BI_ROW_LIMIT = 200000;

function buildDateBound(query) {
  const q = query || {};
  let from = typeof q.from === 'string' && ISO_DATE_RE.test(q.from) ? q.from : null;
  let to = typeof q.to === 'string' && ISO_DATE_RE.test(q.to) ? q.to : null;
  if (from && to && from > to) {
    from = null;
    to = null;
  }
  if (from && to) return { clause: ' AND `Date` >= ? AND `Date` <= ?', params: [from, to] };
  if (from) return { clause: ' AND `Date` >= ?', params: [from] };
  if (to) return { clause: ' AND `Date` <= ?', params: [to] };
  return { clause: '', params: [] };
}

function buildGenericDateBound(dateCol, query) {
  const q = query || {};
  let from = typeof q.from === 'string' && ISO_DATE_RE.test(q.from) ? q.from : null;
  let to = typeof q.to === 'string' && ISO_DATE_RE.test(q.to) ? q.to : null;
  if (from && to && from > to) {
    from = null;
    to = null;
  }
  if (from && to) return { clause: ` AND ${dateCol} >= ? AND ${dateCol} <= ?`, params: [from, to] };
  if (from) return { clause: ` AND ${dateCol} >= ?`, params: [from] };
  if (to) return { clause: ` AND ${dateCol} <= ?`, params: [to] };
  return { clause: '', params: [] };
}

function dateKey(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

function tsNum(row) {
  if (!row.timestamp) return 0;
  const t = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp);
  return t.getTime();
}

function dedupeLatestPerDate(rows, dateField = 'Date') {
  const byDate = new Map();
  for (const r of rows || []) {
    const k = dateKey(r[dateField]);
    if (!k) continue;
    const prev = byDate.get(k);
    if (!prev || tsNum(r) >= tsNum(prev)) byDate.set(k, r);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function num(v) {
  if (v == null || v === '') return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapPowerRow(r) {
  return {
    Date: dateKey(r.Date),
    PowerGen30: num(r.PowerGen30),
    PowerGen3Old: num(r.PowerGen3Old),
    PowerGen3New: num(r.PowerGen3New),
    PowerGen4MW: num(r.PowerGen4MW),
    Hours30: num(r.Hours30),
    Hours3Old: num(r.Hours3Old),
    Hours3New: num(r.Hours3New),
    Hours4: num(r.Hours4),
    Crush: num(r.Crush),
    ExportGrid30: num(r.ExportGrid30),
    ExportCogen30: num(r.ExportCogen30),
    ExportCogen3New: num(r.ExportCogen3New),
    ExportCogen3Old: num(r.ExportCogen3Old),
    ExportCogen4: num(r.ExportCogen4),
    ExportSug30: num(r.ExportSug30),
    ExportSug3New: num(r.ExportSug3New),
    ExportSug3Old: num(r.ExportSug3Old),
    ExportSug4: num(r.ExportSug4),
    ExportDist30: num(r.ExportDist30),
    Imp_4MW: num(r.Imp_4MW),
    PowerConMillHouse: num(r.PowerConMillHouse),
    PowerConDSHouse: num(r.PowerConDSHouse),
    PowerConRaw_Ref: num(r.PowerConRaw_Ref),
    timestamp: r.timestamp,
  };
}

function mapSteamRow(r) {
  return {
    Date: dateKey(r.Date),
    SteamGen150: num(r.SteamGen150),
    SteamGen70: num(r.SteamGen70),
    SteamGen35: num(r.SteamGen35),
    SteamCon30MW: num(r.SteamCon30MW),
    StmCons3Old70: num(r.StmCons3Old35),
    StmCons3New70: num(r.StmCons3New35),
    StmCons4: num(r.StmCons4),
    TotalStmtoSug150: num(r.TotalStmtoSug150),
    TotalStmtoSug70: num(r.TotalStmtoSug70),
    StmtoSugDisti: num(r.StmtoSugDisti),
    TotalStmdistil: num(r.TotalStmdistil),
    StmDist70: num(r.StmDist70),
    StmtoDistil110_45ATAPRDS_o: num(r.StmtoDistil110_45ATAPRDS_o),
    StmMillTurbine110_45ATAPRDS: num(r.StmMillTurbine110_45ATAPRDS),
    Baggase150: num(r.Baggase150),
    Baggase70: num(r.Baggase70),
    Baggase35: num(r.Baggase35),
    SlopCon: num(r.SlopCon),
    timestamp: r.timestamp,
  };
}

async function safeQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR')) return [];
    throw err;
  }
}

async function computeCentreOverruns(indentBound, purchaseDateBound) {
  const [gatePurchase, gateIndent, centerPurchase, centerIndent] = await Promise.all([
    safeQuery(
      `SELECT SUM(purchase_qty) AS total FROM centre_purchase_data
       WHERE purchase_date IS NOT NULL AND LOWER(TRIM(category)) = 'gate'${purchaseDateBound.clause}`,
      purchaseDateBound.params,
    ),
    safeQuery(
      `SELECT SUM(indent_qty) AS total FROM centre_indent_data
       WHERE indent_date IS NOT NULL AND LOWER(TRIM(category)) = 'gate'${indentBound.clause}`,
      indentBound.params,
    ),
    safeQuery(
      `SELECT SUM(purchase_qty) AS total FROM centre_purchase_data
       WHERE purchase_date IS NOT NULL AND LOWER(TRIM(category)) = 'center'${purchaseDateBound.clause}`,
      purchaseDateBound.params,
    ),
    safeQuery(
      `SELECT SUM(indent_qty) AS total FROM centre_indent_data
       WHERE indent_date IS NOT NULL AND LOWER(TRIM(category)) = 'center'${indentBound.clause}`,
      indentBound.params,
    ),
  ]);

  const gatePur = n(gatePurchase[0]?.total);
  const gateInd = n(gateIndent[0]?.total);
  const centerPur = n(centerPurchase[0]?.total);
  const centerInd = n(centerIndent[0]?.total);

  const overrunGatePct = gateInd > 0 ? (gatePur / gateInd) * 100 : null;
  const overrunCenterPct = centerInd > 0 ? (centerPur / centerInd) * 100 : null;
  const overrunCenterQty = centerPur > centerInd ? centerPur - centerInd : null;

  return { overrunGatePct, overrunCenterPct, overrunCenterQty: nullableNum(overrunCenterQty) };
}

async function getManagementDashboard(req, res) {
  try {
    const allowed = await canAccessForm(req.user, FORM_KEY);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied to Management Dashboard.' });
    }

    const dma = Number(req.query.dma) || 7;

    // Match Power BI slicer: DMR_SS24[Date] only (not a union of all fact tables).
    const [[dateBoundsRow]] = await pool.query(
      `SELECT MIN(\`Date\`) AS minDate, MAX(\`Date\`) AS maxDate
       FROM dmr_daily
       WHERE \`Date\` IS NOT NULL`,
    );

    const dataMin = dateBoundsRow?.minDate ? dateKey(dateBoundsRow.minDate) : null;
    const dataMax = dateBoundsRow?.maxDate ? dateKey(dateBoundsRow.maxDate) : null;

    const queryForBound = { ...req.query };
    if ((!queryForBound.from || !ISO_DATE_RE.test(String(queryForBound.from))) && dataMin) {
      queryForBound.from = dataMin;
    }
    if ((!queryForBound.to || !ISO_DATE_RE.test(String(queryForBound.to))) && dataMax) {
      queryForBound.to = dataMax;
    }
    if (dataMin && queryForBound.from && queryForBound.from < dataMin) queryForBound.from = dataMin;
    if (dataMax && queryForBound.to && queryForBound.to > dataMax) queryForBound.to = dataMax;

    const dateBound = buildDateBound(queryForBound);
    const indentBound = buildGenericDateBound('indent_date', queryForBound);
    const purchaseBound = buildGenericDateBound('p.purchase_date', queryForBound);
    const purchaseDateBound = buildGenericDateBound('purchase_date', queryForBound);
    const brixBound = buildGenericDateBound('`Date`', queryForBound);

    const [
      indentAgg,
      purchaseAgg,
      brixYardAgg,
      brixFieldAgg,
      polAgg,
      yardBalRow,
      centreOverruns,
      indentRaw,
      purchaseRaw,
      brixYardRaw,
      brixFieldRaw,
      opsRaw,
      dsRaw,
      rsRaw,
      powerRaw,
      steamRaw,
      distilleryRaw,
      dmrRaw,
    ] = await Promise.all([
      safeQuery(
        `SELECT SUM(indent_qty) AS total FROM centre_indent_data WHERE indent_date IS NOT NULL${indentBound.clause}`,
        indentBound.params,
      ),
      safeQuery(
        `SELECT SUM(p.purchase_qty) AS total FROM centre_purchase_data p
         WHERE p.purchase_date IS NOT NULL${purchaseBound.clause}`,
        purchaseBound.params,
      ),
      safeQuery(
        `SELECT AVG(MiddleBrix) AS avgVal FROM brix_yard_sampling WHERE \`Date\` IS NOT NULL${brixBound.clause}`,
        brixBound.params,
      ),
      safeQuery(
        `SELECT AVG(MiddleBrix) AS avgVal FROM brix_field_sampling WHERE \`Date\` IS NOT NULL${brixBound.clause}`,
        brixBound.params,
      ),
      safeQuery(
        `SELECT AVG(PJ_Pol) AS avgVal FROM ds_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT yard_bal FROM ops_logbook
         WHERE yard_bal IS NOT NULL AND \`Date\` IS NOT NULL${dateBound.clause}
           AND (Sampling_time LIKE '7-8%' OR Sampling_time LIKE '8-9%')
         ORDER BY \`Date\` DESC, \`timestamp\` DESC LIMIT 1`,
        dateBound.params,
      ),
      computeCentreOverruns(indentBound, purchaseDateBound),
      safeQuery(
        `SELECT indent_date, indent_qty, category FROM centre_indent_data
         WHERE indent_date IS NOT NULL${indentBound.clause} LIMIT ${BI_ROW_LIMIT}`,
        indentBound.params,
      ),
      safeQuery(
        `SELECT purchase_date, purchase_qty, category FROM centre_purchase_data
         WHERE purchase_date IS NOT NULL${purchaseDateBound.clause} LIMIT ${BI_ROW_LIMIT}`,
        purchaseDateBound.params,
      ),
      safeQuery(
        `SELECT \`Date\`, MiddleBrix FROM brix_yard_sampling WHERE \`Date\` IS NOT NULL${brixBound.clause} LIMIT ${BI_ROW_LIMIT}`,
        brixBound.params,
      ),
      safeQuery(
        `SELECT \`Date\`, MiddleBrix FROM brix_field_sampling WHERE \`Date\` IS NOT NULL${brixBound.clause} LIMIT ${BI_ROW_LIMIT}`,
        brixBound.params,
      ),
      safeQuery(
        `SELECT * FROM ops_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT * FROM ds_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT * FROM rs_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT * FROM ph_power WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT * FROM ph_steam WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT * FROM distillery_operations WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
      safeQuery(
        `SELECT * FROM dmr_daily WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params,
      ),
    ]);

    const opsRows = dedupeLatestPerDate(opsRaw);
    const dsRows = dedupeLatestPerDate(dsRaw);
    const rsRows = dedupeLatestPerDate(rsRaw);
    const powerRows = dedupeLatestPerDate(powerRaw).map(mapPowerRow);
    const steamRows = dedupeLatestPerDate(steamRaw).map(mapSteamRow);
    const distilleryRows = dedupeLatestPerDate(distilleryRaw);
    const dmrRows = dmrRaw || [];
    const dmrKpis = dmrRows.length ? computeDmrKpis(dmrRows) : null;
    // Power BI "Days" card = Count of DMR_SS24[Date] (COUNTROWS of DMR in slicer).
    const daysElapsed = dmrRows.filter((r) => dateKey(r.Date)).length;

    const { series, rightVal7dma } = buildManagementSeries(
      {
        indentRows: indentRaw,
        purchaseRows: purchaseRaw,
        opsRows,
        dsRows,
        powerRows,
        steamRows,
        distilleryRows,
        brixYardRows: brixYardRaw,
        brixFieldRows: brixFieldRaw,
        dmrRows,
      },
      queryForBound.from,
      queryForBound.to,
      dma,
    );

    const rows = buildRows({
      caneIndent: nullableNum(indentAgg[0]?.total),
      canePurchase: nullableNum(purchaseAgg[0]?.total),
      yardBal: nullableNum(yardBalRow[0]?.yard_bal),
      polInCane: nullableNum(polAgg[0]?.avgVal),
      brixYard: nullableNum(brixYardAgg[0]?.avgVal),
      brixField: nullableNum(brixFieldAgg[0]?.avgVal),
      overrunGatePct: centreOverruns.overrunGatePct,
      overrunCenterPct: centreOverruns.overrunCenterPct,
      overrunCenterQty: centreOverruns.overrunCenterQty,
      opsRows,
      dsRows,
      rsRows,
      powerRows,
      steamRows,
      distilleryRows,
      dmrRows,
      dmrKpis,
      series,
      rightVal7dma,
    });

    return res.json({
      from: queryForBound.from || null,
      to: queryForBound.to || null,
      dma,
      daysElapsed,
      dateBounds: { min: dataMin, max: dataMax, from: dataMin, to: dataMax },
      rows,
    });
  } catch (err) {
    return sendServerError(res, 'BI management-dashboard error:', err, MSG.LOAD);
  }
}

module.exports = { getManagementDashboard };
