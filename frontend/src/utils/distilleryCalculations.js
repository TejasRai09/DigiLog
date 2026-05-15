/**
 * Derived fields for GSMA Distillery Operations (form_key distillery_ops).
 * Division by zero or invalid operands → null (blank in UI / NULL in DB).
 */

export function parseNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function safeDiv(num, denom) {
  if (num === null || denom === null) return null;
  if (!Number.isFinite(num) || !Number.isFinite(denom) || denom === 0) return null;
  return num / denom;
}

/**
 * Distillery calculated fields: at most 2 decimal places; when absolute value is strictly between 0 and 1, at most 5 decimal places.
 */
export function formatDistilleryDerivedNumber(v) {
  if (v === null || v === undefined) return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  const av = Math.abs(n);
  if (av === 0) return '0';
  if (av < 1) {
    return String(Number.parseFloat(n.toFixed(5)));
  }
  return String(Number.parseFloat(n.toFixed(2)));
}

/**
 * @param {Record<string, string|number>} input — raw form state (manual fields only)
 * @returns {Record<string, number|null>} derived keys for API / display (DB-generated cols excluded from INSERT in API)
 */
export function computeDistilleryDerived(input) {
  const syrup = parseNum(input.syrup_molasses_qtls);
  const wash = parseNum(input.wash_distilled);
  const trs = parseNum(input.trs);
  const ufs = parseNum(input.ufs);
  const alcoholPct = parseNum(input.alcohol_pct);
  const actualEthanolBl = parseNum(input.actual_ethanol_bl);
  const alBlRatioPct = parseNum(input.al_bl_ratio_pct);

  const bhMol = parseNum(input.total_bh_molasses_qtls);
  const chMol = parseNum(input.total_ch_molasses_qtls);

  const fs = trs !== null && ufs !== null ? trs - ufs : null;
  const fsPercentRatio = safeDiv(fs, trs);
  const total_mol_in_store_qtls =
    bhMol === null && chMol === null ? null : (bhMol ?? 0) + (chMol ?? 0);
  const fs_quantity =
    fs !== null && syrup !== null ? (fs / 100) * syrup : null;
  const theoretical_yield =
    fs_quantity !== null ? fs_quantity * 64.4 : null;
  const alcohol_prod_fermentation =
    alcoholPct !== null && wash !== null ? (alcoholPct / 100) * wash : null;

  const fe = safeDiv(alcohol_prod_fermentation, theoretical_yield);
  const actual_prod_al =
    alBlRatioPct !== null && actualEthanolBl !== null
      ? (alBlRatioPct / 100) * actualEthanolBl
      : null;
  const de = safeDiv(actual_prod_al, alcohol_prod_fermentation);
  const oe =
    fe !== null && de !== null ? fe * de : null;

  const rec_bl = safeDiv(actualEthanolBl, syrup);
  const rec_al = safeDiv(actual_prod_al, syrup);
  const trs_qty =
    trs !== null && syrup !== null ? (trs / 100) * syrup : null;
  const ufs_qty =
    ufs !== null && syrup !== null ? (ufs / 100) * syrup : null;

  return {
    fs,
    'FS%': fsPercentRatio,
    total_mol_in_store_qtls,
    fs_quantity,
    theoretical_yield,
    alcohol_prod_fermentation,
    fe,
    actual_prod_al,
    de,
    oe,
    rec_bl,
    rec_al,
    trs_qty,
    ufs_qty,
  };
}
