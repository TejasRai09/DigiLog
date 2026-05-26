const { pool } = require('../config/mysql');
const { canAccessForm } = require('./form.controller');

function dateKey(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function tsNum(row) {
  if (!row.timestamp) return 0;
  const t = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp);
  return t.getTime();
}

/** One row per calendar Date (latest `timestamp` wins). */
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
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** FE/DE stored as ratio (0–1) or already percent. */
function effPercent(v) {
  const x = num(v);
  if (x === 0) return 0;
  if (Math.abs(x) <= 1) return x * 100;
  return x;
}

/** Same as init.sql generated `FS%`: fs / trs when valid; else 0 for downstream num-style use. */
function fsPctRatioFromRow(r) {
  if (r.trs == null || r.trs === '' || r.fs == null || r.fs === '') return 0;
  const t = Number(r.trs);
  if (!Number.isFinite(t) || t === 0) return 0;
  const f = Number(r.fs);
  if (!Number.isFinite(f)) return 0;
  return f / t;
}

/** Same as init.sql generated total_mol_in_store_qtls: COALESCE(BH) + COALESCE(CH); 0 when both inputs null. */
function molInStoreFromRow(r) {
  const bh = r.total_bh_molasses_qtls;
  const ch = r.total_ch_molasses_qtls;
  if (bh == null && ch == null) return 0;
  return num(bh) + num(ch);
}

/**
 * Map DB row (distillery_operations per mysql/init.sql) → BI dashboard series point.
 */
function mapRowToBiPoint(r) {
  const d = r.Date;
  const dateObj = d instanceof Date ? d : new Date(typeof d === 'string' ? `${d}T12:00:00` : d);
  const dateLabel = Number.isNaN(dateObj.getTime())
    ? String(d)
    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateFull = Number.isNaN(dateObj.getTime())
    ? String(d)
    : dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const dateIso = dateKey(r.Date);

  let mode = (r.operation_mode || '').trim();
  if (mode === 'None' || mode === '') mode = 'Mixed';

  const etoh = num(r.actual_ethanol_bl);
  let bHeavyProd = 0;
  let cHeavyProd = 0;
  let syrupProd = 0;
  if (mode === 'B Heavy') bHeavyProd = etoh;
  else if (mode === 'C Heavy') cHeavyProd = etoh;
  else if (mode === 'Syrup') syrupProd = etoh;
  else {
    bHeavyProd = etoh * 0.5;
    syrupProd = etoh * 0.5;
  }

  let recovery = num(r.al_bl_ratio_pct);
  if (recovery === 0 && r.rec_bl != null) {
    const rb = num(r.rec_bl);
    recovery = rb <= 1 && rb >= 0 ? rb * 100 : rb;
  }

  const fsPctRatio = fsPctRatioFromRow(r);
  const fermSugar = fsPctRatio !== 0 ? fsPctRatio * 100 : num(r.fs);

  return {
    date: dateLabel,
    dateFull,
    dateIso,
    mode,
    operationModeRaw: (r.operation_mode || '').trim(),
    bHeavyProd,
    cHeavyProd,
    syrupProd,
    totalProd: etoh,
    totalWash: num(r.wash_distilled),
    syrupMolConsumed: num(r.syrup_molasses_qtls),
    recovery,
    fermEff: effPercent(r.fe),
    distEff: effPercent(r.de),
    fermSugar,
    alcohol: num(r.alcohol_pct),
    molInStore: molInStoreFromRow(r),
    ethInStore: num(r.ethanol_storage_bl),
    trs: num(r.trs),
    ufs: num(r.ufs),
    alBlRatioPct: num(r.al_bl_ratio_pct),
    totalBhMolassesQtls: num(r.total_bh_molasses_qtls),
    totalChMolassesQtls: num(r.total_ch_molasses_qtls),
    fs: num(r.fs),
    feRaw: num(r.fe),
    deRaw: num(r.de),
    recBl: num(r.rec_bl),
    recordedAt: (() => {
      const t = r.timestamp;
      if (t == null || t === '') return '';
      const dt = t instanceof Date ? t : new Date(t);
      return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
    })(),
  };
}

/** GET /api/bi/distillery-operations — same access as form distillery_ops. */
async function getDistilleryOperationsBi(req, res) {
  try {
    const allowed = await canAccessForm(req.user, 'bi_distillery_operations');
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied to distillery analytics.' });
    }

    const [rows] = await pool.query(
      `SELECT
        \`Date\`,
        operation_mode,
        syrup_molasses_qtls,
        wash_distilled,
        trs,
        ufs,
        alcohol_pct,
        actual_ethanol_bl,
        al_bl_ratio_pct,
        total_bh_molasses_qtls,
        total_ch_molasses_qtls,
        ethanol_storage_bl,
        fs,
        fe,
        de,
        rec_bl,
        \`timestamp\`
      FROM distillery_operations
      WHERE \`Date\` IS NOT NULL
      ORDER BY \`Date\` ASC, \`timestamp\` DESC`,
    );

    const deduped = dedupeLatestPerDate(rows);
    const records = deduped.map(mapRowToBiPoint);

    return res.json({
      source: 'distillery_operations',
      recordCount: records.length,
      records,
    });
  } catch (err) {
    console.error('BI distillery error:', err.message);
    return res.status(500).json({ message: 'Database error: ' + err.message });
  }
}

/**
 * Map a `mill_stoppages` DB row → milling-cockpit BI point.
 * `hours` is computed from start_time/end_time, falling back to 0 when either is missing.
 */
function mapMillStoppageRow(r) {
  const dateIso = dateKey(r.Date);

  const dateObj =
    r.Date instanceof Date
      ? r.Date
      : new Date(typeof r.Date === 'string' ? `${r.Date}T12:00:00` : r.Date);
  const dateLabel = Number.isNaN(dateObj.getTime())
    ? String(r.Date || '')
    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const toIso = (v) => {
    if (v == null || v === '') return '';
    const dt = v instanceof Date ? v : new Date(v);
    return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
  };

  const toClock = (v) => {
    if (v == null || v === '') return '';
    const dt = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleTimeString('en-GB', { hour12: false }); // HH:MM:SS
  };

  let hours = 0;
  if (r.start_time && r.end_time) {
    const s = r.start_time instanceof Date ? r.start_time : new Date(r.start_time);
    const e = r.end_time instanceof Date ? r.end_time : new Date(r.end_time);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
      hours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    }
  }

  return {
    dateIso,
    dateLabel,
    startTimeIso: toIso(r.start_time),
    endTimeIso: toIso(r.end_time),
    startTime: toClock(r.start_time),
    endTime: toClock(r.end_time),
    hours: Math.max(0, Number(hours.toFixed(4))),
    section: (r.section || '').trim(),
    machinery: (r.machinery || '').trim(),
    remarks: (r.remarks || '').toString(),
    recordedAt: toIso(r.timestamp),
  };
}

/** GET /api/bi/milling-operations — same access as the BI dashboard form. */
async function getMillingStoppagesBi(req, res) {
  try {
    const allowed = await canAccessForm(req.user, 'bi_milling_operations');
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied to milling analytics.' });
    }

    const [rows] = await pool.query(
      `SELECT
        \`Date\`,
        \`start_time\`,
        \`end_time\`,
        \`section\`,
        \`machinery\`,
        \`remarks\`,
        \`timestamp\`
      FROM mill_stoppages
      WHERE \`Date\` IS NOT NULL
      ORDER BY \`Date\` ASC, \`start_time\` ASC, \`timestamp\` ASC`,
    );

    const records = rows.map(mapMillStoppageRow);

    return res.json({
      source: 'mill_stoppages',
      recordCount: records.length,
      records,
    });
  } catch (err) {
    console.error('BI milling error:', err.message);
    return res.status(500).json({ message: 'Database error: ' + err.message });
  }
}

/**
 * GET /api/bi/milling-equipment-temp
 * Returns the Data_Mill variable→machine→equipment mapping plus the time-series
 * temperature readings from `mill_logbook1`. Both feed the "Thermal Reports →
 * Summary - Equipment Temp" view on the milling cockpit.
 *
 * Same access gate as the Milling Division Cockpit (bi_milling_operations).
 */
async function getMillingEquipmentTempBi(req, res) {
  try {
    const allowed = await canAccessForm(req.user, 'bi_milling_operations');
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied to milling analytics.' });
    }

    const [mappingRows] = await pool.query(
      `SELECT
         \`variable\`,
         \`machine\`,
         \`equipment_name\`,
         \`sort_order\`
       FROM data_mill_mapping
       ORDER BY \`sort_order\` ASC, \`machine\` ASC, \`equipment_name\` ASC`,
    );

    const mapping = mappingRows.map((r) => ({
      variable: String(r.variable || '').trim(),
      machine: String(r.machine || '').trim(),
      equipmentName: String(r.equipment_name || '').trim(),
      sortOrder: Number(r.sort_order) || 0,
    }));

    // Pull all mill_logbook1 columns referenced by the mapping (variable column
    // names match the table column names). Guarding against arbitrary input by
    // intersecting with information_schema for the table.
    const [columnRows] = await pool.query(
      `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'mill_logbook1'`,
    );
    const tableColumns = new Set(columnRows.map((r) => r.name));

    const variableSet = new Set();
    for (const m of mapping) {
      if (m.variable && tableColumns.has(m.variable)) variableSet.add(m.variable);
    }
    const variableColumns = Array.from(variableSet);

    let series = [];
    if (variableColumns.length > 0) {
      const selectCols = ['`Date`', '`Shift`', '`Time`', ...variableColumns.map((c) => `\`${c}\``)].join(', ');
      const [rows] = await pool.query(
        `SELECT ${selectCols}
         FROM mill_logbook1
         WHERE \`Date\` IS NOT NULL
         ORDER BY \`Date\` ASC, \`Time\` ASC`,
      );

      series = rows.map((r) => {
        const dateIso = dateKey(r.Date);
        const time = r.Time;
        let timeIso = '';
        if (time != null && time !== '') {
          const t = time instanceof Date ? time : new Date(time);
          if (!Number.isNaN(t.getTime())) timeIso = t.toISOString();
        }
        const values = {};
        for (const col of variableColumns) {
          const v = r[col];
          values[col] = v == null || v === '' ? null : Number(v);
        }
        return {
          dateIso,
          shift: (r.Shift || '').toString().trim(),
          timeIso,
          values,
        };
      });
    }

    return res.json({
      source: 'mill_logbook1+data_mill_mapping',
      mapping,
      series,
      mappingCount: mapping.length,
      seriesCount: series.length,
    });
  } catch (err) {
    console.error('BI milling equipment-temp error:', err.message);
    return res.status(500).json({ message: 'Database error: ' + err.message });
  }
}

module.exports = {
  getDistilleryOperationsBi,
  getMillingStoppagesBi,
  getMillingEquipmentTempBi,
};
