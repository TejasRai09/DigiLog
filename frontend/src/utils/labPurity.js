/** Apparent purity (%) = (Pol / Brix) * 100. Blank when either value is missing or Brix is 0. */

export function isLabPurityKey(dbKey) {
  return dbKey === 'Purity_FineLiqourMelt' || /_Purity$/.test(dbKey);
}

export function formatPurity(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function calcPurity(pol, brix) {
  if (pol === '' || brix === '' || pol == null || brix == null) return '';
  const p = Number(pol);
  const b = Number(brix);
  if (!Number.isFinite(p) || !Number.isFinite(b) || b === 0) return '';
  return formatPurity((p / b) * 100);
}

/** Copy of a form with purity keys filled from each Pol/Brix pair. */
export function withComputedPurity(form, pairs) {
  const next = { ...form };
  for (const { pol, brix, purity } of pairs) {
    next[purity] = calcPurity(form[pol], form[brix]);
  }
  return next;
}
