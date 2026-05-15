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
    mode,
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

module.exports = { getDistilleryOperationsBi };
