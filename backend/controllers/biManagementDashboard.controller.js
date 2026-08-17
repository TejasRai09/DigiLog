const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { canAccessForm } = require('./form.controller');
const { buildRows, n, nullableNum } = require('../utils/managementDashboardMeasures');

const FORM_KEY = 'bi_management_dashboard';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BI_ROW_LIMIT = 200000;

const LINKED_PURCHASE_EXISTS =
  'EXISTS (SELECT 1 FROM centre_indent_data i WHERE i.unique_id = p.unique_id)';

const GATE_OVERRUN = `CASE
  WHEN sup_mod = '18 QCART' THEN 18 WHEN sup_mod = '36 QTROLLY' THEN 36
  WHEN sup_mod = '45 QTROLLY' THEN 45 WHEN sup_mod = '63 QTROLLY' THEN 63
  WHEN sup_mod IN ('99 QTROLLY','99 QTRUCK') THEN 99 ELSE NULL END`;

const CNT_OVERRUN = `CASE
  WHEN transport_mode = '18 QCART' THEN 18 WHEN transport_mode = '36 QTROLLY' THEN 36
  WHEN transport_mode = '45 QTROLLY' THEN 45 WHEN transport_mode = '63 QTROLLY' THEN 63
  ELSE NULL END`;

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

async function getManagementDashboard(req, res) {
  try {
    const allowed = await canAccessForm(req.user, FORM_KEY);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied to Management Dashboard.' });
    }

    const [[dateBoundsRow]] = await pool.query(
      `SELECT MIN(d) AS minDate, MAX(d) AS maxDate FROM (
         SELECT \`Date\` AS d FROM ph_power WHERE \`Date\` IS NOT NULL
         UNION SELECT \`Date\` AS d FROM ph_steam WHERE \`Date\` IS NOT NULL
         UNION SELECT \`Date\` AS d FROM ops_logbook WHERE \`Date\` IS NOT NULL
         UNION SELECT \`Date\` AS d FROM ds_logbook WHERE \`Date\` IS NOT NULL
         UNION SELECT \`Date\` AS d FROM distillery_operations WHERE \`Date\` IS NOT NULL
         UNION SELECT \`Date\` AS d FROM brix_yard_sampling WHERE \`Date\` IS NOT NULL
         UNION SELECT m_date AS d FROM g_ctc WHERE m_date IS NOT NULL
         UNION SELECT report_date AS d FROM cnt_performance WHERE report_date IS NOT NULL
         UNION SELECT indent_date AS d FROM centre_indent_data WHERE indent_date IS NOT NULL
         UNION SELECT purchase_date AS d FROM centre_purchase_data WHERE purchase_date IS NOT NULL
       ) bounds`
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
    const brixBound = buildGenericDateBound('`Date`', queryForBound);
    const gctcBound = buildGenericDateBound('m_date', queryForBound);
    const cntBound = buildGenericDateBound('report_date', queryForBound);

    const [
      indentAgg,
      purchaseAgg,
      brixYardAgg,
      brixFieldAgg,
      polAgg,
      yardBalRow,
      gateOverrun,
      centerOverrun,
      opsRaw,
      dsRaw,
      rsRaw,
      powerRaw,
      steamRaw,
      distilleryRaw,
    ] = await Promise.all([
      safeQuery(
        `SELECT SUM(indent_qty) AS total FROM centre_indent_data WHERE indent_date IS NOT NULL${indentBound.clause}`,
        indentBound.params
      ),
      safeQuery(
        `SELECT SUM(p.purchase_qty) AS total FROM centre_purchase_data p
         WHERE p.purchase_date IS NOT NULL AND ${LINKED_PURCHASE_EXISTS}${purchaseBound.clause}`,
        purchaseBound.params
      ),
      safeQuery(
        `SELECT AVG(MiddleBrix) AS avgVal FROM brix_yard_sampling WHERE \`Date\` IS NOT NULL${brixBound.clause}`,
        brixBound.params
      ),
      safeQuery(
        `SELECT AVG(MiddleBrix) AS avgVal FROM brix_field_sampling WHERE \`Date\` IS NOT NULL${brixBound.clause}`,
        brixBound.params
      ),
      safeQuery(
        `SELECT AVG(PJ_Pol) AS avgVal FROM ds_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}`,
        dateBound.params
      ),
      safeQuery(
        `SELECT yard_bal FROM ops_logbook
         WHERE yard_bal IS NOT NULL AND \`Date\` IS NOT NULL${dateBound.clause}
           AND (Sampling_time LIKE '7-8%' OR Sampling_time LIKE '8-9%')
         ORDER BY \`Date\` DESC, \`timestamp\` DESC LIMIT 1`,
        dateBound.params
      ),
      safeQuery(
        `SELECT AVG(purchase_qtl - (${GATE_OVERRUN})) AS avgOver,
                AVG((${GATE_OVERRUN})) AS avgStd
         FROM g_ctc WHERE purchase_qtl IS NOT NULL AND sup_mod IS NOT NULL${gctcBound.clause}`,
        gctcBound.params
      ),
      safeQuery(
        `SELECT AVG(cane_qty_qtls - (${CNT_OVERRUN})) AS avgOver,
                AVG((${CNT_OVERRUN})) AS avgStd,
                SUM(GREATEST(cane_qty_qtls - (${CNT_OVERRUN}), 0)) AS overrunQty
         FROM cnt_performance WHERE cane_qty_qtls IS NOT NULL${cntBound.clause}`,
        cntBound.params
      ),
      safeQuery(
        `SELECT * FROM ops_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params
      ),
      safeQuery(
        `SELECT * FROM ds_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params
      ),
      safeQuery(
        `SELECT * FROM rs_logbook WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params
      ),
      safeQuery(
        `SELECT * FROM ph_power WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params
      ),
      safeQuery(
        `SELECT * FROM ph_steam WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params
      ),
      safeQuery(
        `SELECT * FROM distillery_operations WHERE \`Date\` IS NOT NULL${dateBound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC LIMIT ${BI_ROW_LIMIT}`,
        dateBound.params
      ),
    ]);

    const opsRows = dedupeLatestPerDate(opsRaw);
    const dsRows = dedupeLatestPerDate(dsRaw);
    const rsRows = dedupeLatestPerDate(rsRaw);
    const powerRows = dedupeLatestPerDate(powerRaw).map(mapPowerRow);
    const steamRows = dedupeLatestPerDate(steamRaw).map(mapSteamRow);
    const distilleryRows = dedupeLatestPerDate(distilleryRaw);

    const gateStd = n(gateOverrun[0]?.avgStd);
    const gateOver = n(gateOverrun[0]?.avgOver);
    const overrunGatePct = gateStd > 0 ? (gateOver / gateStd) * 100 : null;

    const centerStd = n(centerOverrun[0]?.avgStd);
    const centerOver = n(centerOverrun[0]?.avgOver);
    const overrunCenterPct = centerStd > 0 ? (centerOver / centerStd) * 100 : null;
    const overrunCenterQty = n(centerOverrun[0]?.overrunQty);

    const rows = buildRows({
      caneIndent: nullableNum(indentAgg[0]?.total),
      canePurchase: nullableNum(purchaseAgg[0]?.total),
      yardBal: nullableNum(yardBalRow[0]?.yard_bal),
      polInCane: nullableNum(polAgg[0]?.avgVal),
      brixYard: nullableNum(brixYardAgg[0]?.avgVal),
      brixField: nullableNum(brixFieldAgg[0]?.avgVal),
      overrunGatePct,
      overrunCenterPct,
      overrunCenterQty,
      opsRows,
      dsRows,
      rsRows,
      powerRows,
      steamRows,
      distilleryRows,
      series: {},
    });

    return res.json({
      meta: {
        from: queryForBound.from || null,
        to: queryForBound.to || null,
        dma: Number(req.query.dma) || 7,
        dateBounds: { min: dataMin, max: dataMax },
      },
      rows,
    });
  } catch (err) {
    return sendServerError(res, 'BI management-dashboard error:', err, MSG.LOAD);
  }
}

module.exports = { getManagementDashboard };
