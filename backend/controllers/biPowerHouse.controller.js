const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { canAccessForm } = require('./form.controller');

const DEFAULT_LOOKBACK_DAYS = 365;
const BI_ROW_LIMIT = 200000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORM_KEY = 'bi_power_house';

function buildDateBound(query) {
  const q = query || {};
  let from = typeof q.from === 'string' && ISO_DATE_RE.test(q.from) ? q.from : null;
  let to = typeof q.to === 'string' && ISO_DATE_RE.test(q.to) ? q.to : null;

  if (from && to && from > to) {
    from = null;
    to = null;
  }

  if (from && to) {
    return { clause: ' AND `Date` >= ? AND `Date` <= ?', params: [from, to] };
  }
  if (from) {
    return { clause: ' AND `Date` >= ?', params: [from] };
  }
  if (to) {
    return {
      clause: ' AND `Date` <= ? AND `Date` >= DATE_SUB(?, INTERVAL ? DAY)',
      params: [to, to, DEFAULT_LOOKBACK_DAYS],
    };
  }
  return {
    clause: ' AND `Date` >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
    params: [DEFAULT_LOOKBACK_DAYS],
  };
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

function dedupeLatestPerDate(rows) {
  const byDate = new Map();
  for (const r of rows) {
    const k = dateKey(r.Date);
    if (!k) continue;
    const prev = byDate.get(k);
    if (!prev || tsNum(r) >= tsNum(prev)) byDate.set(k, r);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function serializeDate(d) {
  return dateKey(d);
}

function serializeDateTime(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapPowerRow(r) {
  return {
    Date: serializeDate(r.Date),
    Time: serializeDateTime(r.Time),
    Crush: num(r.Crush),
    Baggase: num(r.Baggase),
    Hours30: num(r.Hours30),
    Hours3Old: num(r.Hours3Old),
    Hours3New: num(r.Hours3New),
    Hours4: num(r.Hours4),
    PowerGen30: num(r.PowerGen30),
    PowerGen3Old: num(r.PowerGen3Old),
    PowerGen3New: num(r.PowerGen3New),
    PowerGen4MW: num(r.PowerGen4MW),
    GenDG30: num(r.GenDG30),
    GenDG3Old: num(r.GenDG3Old),
    GenDG3New: num(r.GenDG3New),
    GenDG4: num(r.GenDG4),
    ExportGrid30: num(r.ExportGrid30),
    ExportGrid3Old: num(r.ExportGrid3Old),
    ExportGrid3New: num(r.ExportGrid3New),
    ExportGrid4: num(r.ExportGrid4),
    ExportSug30: num(r.ExportSug30),
    ExportSug3Old: num(r.ExportSug3Old),
    ExportSug3New: num(r.ExportSug3New),
    ExportSug4: num(r.ExportSug4),
    ExportCogen30: num(r.ExportCogen30),
    ExportCogen3Old: num(r.ExportCogen3Old),
    ExportCogen3New: num(r.ExportCogen3New),
    ExportCogen4: num(r.ExportCogen4),
    ExportDist30: num(r.ExportDist30),
    Imp_Grid: num(r.Imp_Grid),
    Imp_3MWOld: num(r.Imp_3MWOld),
    Imp_3MWNew: num(r.Imp_3MWNew),
    Imp_4MW: num(r.Imp_4MW),
    PowerConMillHouse: num(r.PowerConMillHouse),
    PowerConDSHouse: num(r.PowerConDSHouse),
    PowerConRaw_Ref: num(r.PowerConRaw_Ref),
    PowerCon70TPH: num(r.PowerCon70TPH),
    PowerConETP: num(r.PowerConETP),
    PowerConColony: num(r.PowerConColony),
    PowerConSugarCPU: num(r.PowerConSugarCPU),
    PowerConOthers: num(r.PowerConOthers),
    remark: r.remark != null ? String(r.remark) : null,
    timestamp: serializeDateTime(r.timestamp),
  };
}

/** Map DigiLog StmCons*35 → PBI StmCons*70 names used by measures. */
function mapSteamRow(r) {
  return {
    Date: serializeDate(r.Date),
    Time: serializeDateTime(r.Time),
    SteamGen150: num(r.SteamGen150),
    SteamCon30MW: num(r.SteamCon30MW),
    SteamtoSugar110_3ATAPRDS: num(r.SteamtoSugar110_3ATAPRDS),
    Stmto3Old110_45ATAPRDS: num(r.Stmto3Old110_45ATAPRDS),
    Stmto3New110_45ATAPRDS: num(r.Stmto3New110_45ATAPRDS),
    StmMillTurbine110_45ATAPRDS: num(r.StmMillTurbine110_45ATAPRDS),
    StmtoDistil110_45ATAPRDS_o: num(r.StmtoDistil110_45ATAPRDS_o),
    Stm4MWTG110_45ATAPRDS: num(r.Stm4MWTG110_45ATAPRDS),
    ExtractionStm30MW: num(r.ExtractionStm30MW),
    Bleed2HPH1Stm: num(r.Bleed2HPH1Stm),
    Bleed1HPH2Stm: num(r.Bleed1HPH2Stm),
    TotalStmtoSug150: num(r.TotalStmtoSug150),
    Stmtodeareator150: num(r.Stmtodeareator150),
    SteamGen35: num(r.SteamGen35),
    StmCons4: num(r.StmCons4),
    StmCons45_55ATAPRDS: num(r.StmCons45_55ATAPRDS),
    Stm45_55ATADeareatorEjectorPRDS: num(r.Stm45_55ATADeareatorEjectorPRDS),
    Extractionstm4: num(r.Extractionstm4),
    TotalStmdistil: num(r.TotalStmdistil),
    StmtoEjector: num(r.StmtoEjector),
    Stm35TDeareator: num(r.Stm35TDeareator),
    StmtoSugDisti: num(r.StmtoSugDisti),
    SteamGen70: num(r.SteamGen70),
    // PBI names (DigiLog stores as *35)
    StmCons3Old70: num(r.StmCons3Old35),
    StmCons3New70: num(r.StmCons3New35),
    StmCons3Old35: num(r.StmCons3Old35),
    StmCons3New35: num(r.StmCons3New35),
    StmDist70: num(r.StmDist70),
    Stmto4_70TPH: num(r.Stmto4_70TPH),
    TotalStmtoSug70: num(r.TotalStmtoSug70),
    Firewood150: num(r.Firewood150),
    Baggase150: num(r.Baggase150),
    Firewood70: num(r.Firewood70),
    Baggase70: num(r.Baggase70),
    Firewood35: num(r.Firewood35),
    Baggase35: num(r.Baggase35),
    SlopCon: num(r.SlopCon),
    timestamp: serializeDateTime(r.timestamp),
  };
}

function durationHours(start, end) {
  if (!start || !end) return null;
  const a = start instanceof Date ? start : new Date(start);
  const b = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  // PBI: (end_Time - start_time) * 24 — Excel serial day diff * 24 ≈ hours
  return ((b.getTime() - a.getTime()) / 3600000);
}

function mapStoppageRow(r) {
  const section = r.section != null ? String(r.section).trim() : '';
  const category = r.category != null ? String(r.category).trim() : '';
  return {
    Date: serializeDate(r.Date),
    start_time: serializeDateTime(r.start_time),
    end_Time: serializeDateTime(r.end_Time),
    section: section || null,
    sub_section: r.sub_section != null ? String(r.sub_section).trim() || null : null,
    machinery: r.machinery != null ? String(r.machinery).trim() || null : null,
    category: category || null,
    remarks: r.remarks != null ? String(r.remarks) : null,
    Duration: durationHours(r.start_time, r.end_Time),
    timestamp: serializeDateTime(r.timestamp),
  };
}

/**
 * GET /api/bi/power-house
 * Returns power / steam / stoppage rows for the selected Date range.
 */
async function getPowerHouseBi(req, res) {
  try {
    const allowed = await canAccessForm(req.user, FORM_KEY);
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied to Power House analytics.' });
    }

    const [[dateBoundsRow]] = await pool.query(
      `SELECT MIN(d) AS minDate, MAX(d) AS maxDate
       FROM (
         SELECT \`Date\` AS d FROM ph_power WHERE \`Date\` IS NOT NULL
         UNION ALL
         SELECT \`Date\` AS d FROM ph_steam WHERE \`Date\` IS NOT NULL
         UNION ALL
         SELECT \`Date\` AS d FROM ph_stoppage WHERE \`Date\` IS NOT NULL
       ) bounds`,
    );
    const dataMin = dateBoundsRow?.minDate ? dateKey(dateBoundsRow.minDate) : null;
    const dataMax = dateBoundsRow?.maxDate ? dateKey(dateBoundsRow.maxDate) : null;

    // When client omits from/to, use full data span (not the generic 365-day lookback).
    const queryForBound = { ...req.query };
    if ((!queryForBound.from || !ISO_DATE_RE.test(String(queryForBound.from))) && dataMin) {
      queryForBound.from = dataMin;
    }
    if ((!queryForBound.to || !ISO_DATE_RE.test(String(queryForBound.to))) && dataMax) {
      queryForBound.to = dataMax;
    }
    // Clamp requested range inside available data.
    if (dataMin && queryForBound.from && queryForBound.from < dataMin) queryForBound.from = dataMin;
    if (dataMax && queryForBound.to && queryForBound.to > dataMax) queryForBound.to = dataMax;
    if (dataMax && queryForBound.from && queryForBound.from > dataMax) queryForBound.from = dataMax;
    if (dataMin && queryForBound.to && queryForBound.to < dataMin) queryForBound.to = dataMin;

    const bound = buildDateBound(queryForBound);

    const [powerRaw, steamRaw, stoppageRaw] = await Promise.all([
      pool.query(
        `SELECT *
         FROM ph_power
         WHERE \`Date\` IS NOT NULL${bound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC
         LIMIT ${BI_ROW_LIMIT}`,
        bound.params,
      ),
      pool.query(
        `SELECT *
         FROM ph_steam
         WHERE \`Date\` IS NOT NULL${bound.clause}
         ORDER BY \`Date\` ASC, \`timestamp\` ASC
         LIMIT ${BI_ROW_LIMIT}`,
        bound.params,
      ),
      pool.query(
        `SELECT
           \`Date\`,
           \`start_time\`,
           \`end_Time\`,
           \`section\`,
           \`sub_section\`,
           \`machinery\`,
           \`category\`,
           \`remarks\`,
           \`timestamp\`
         FROM ph_stoppage
         WHERE \`Date\` IS NOT NULL${bound.clause}
         ORDER BY \`Date\` ASC, \`start_time\` ASC, \`timestamp\` ASC
         LIMIT ${BI_ROW_LIMIT}`,
        bound.params,
      ),
    ]);

    const powerRows = dedupeLatestPerDate(powerRaw[0]).map(mapPowerRow);
    const steamRows = dedupeLatestPerDate(steamRaw[0]).map(mapSteamRow);
    const stoppageRows = stoppageRaw[0].map(mapStoppageRow);

    return res.json({
      source: { power: 'ph_power', steam: 'ph_steam', stoppage: 'ph_stoppage' },
      meta: {
        from: queryForBound.from || null,
        to: queryForBound.to || null,
        dateBounds: { min: dataMin, max: dataMax },
        powerCount: powerRows.length,
        steamCount: steamRows.length,
        stoppageCount: stoppageRows.length,
      },
      powerRows,
      steamRows,
      stoppageRows,
    });
  } catch (err) {
    return sendServerError(res, 'BI power-house error:', err, MSG.LOAD);
  }
}

module.exports = { getPowerHouseBi };
