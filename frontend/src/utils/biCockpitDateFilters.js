/**
 * Shared BI cockpit date / compare filters (Milling pattern).
 * Compare season chips = all season_mapping rows except the current From/To season.
 */
import toast from 'react-hot-toast';
import {
  alignMappedSeasonByDayOffset,
  alignMappedSeasonCompareRange,
  computePriorPeriodRange,
  findSeasonLabelForDate,
  formatYMD,
  getSeasonComparisonLabels,
  getSeasonComparisonLabelsFromMapping,
  isSeasonComparisonType,
  seasonLabelForComparisonType,
} from './distilleryBiDateRange';

export { isSeasonComparisonType, seasonLabelForComparisonType };

export const SEASON_COMPARE_PREFIX = 'SEASON:';

/** Monday start of the week containing `d`. */
export function startOfWeekMonday(d) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const offset = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

/**
 * MTD / STD / WTD From–To for cockpit dashboards.
 * STD From = season_mapping startDate for the To-date’s season (fallback Oct 1).
 */
export function getCockpitPresetDateRange(preset, now = new Date(), seasonMapping = {}) {
  const to = formatYMD(now);
  if (preset === 'MTD') {
    return { from: formatYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  if (preset === 'STD') {
    const label = findSeasonLabelForDate(to, seasonMapping);
    const start = label && seasonMapping?.[label]?.startDate
      ? String(seasonMapping[label].startDate).slice(0, 10)
      : null;
    if (start) return { from: start, to };
    const seasonStartYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: formatYMD(new Date(seasonStartYear, 9, 1)), to };
  }
  if (preset === 'WTD') {
    return { from: formatYMD(startOfWeekMonday(now)), to };
  }
  return { from: formatYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to };
}

export function getCockpitPPLabel(rangePreset) {
  if (rangePreset === 'MTD') return 'Prev. Month';
  if (rangePreset === 'STD') return 'Prev. Season';
  if (rangePreset === 'WTD') return 'Prev. Week';
  if (rangePreset === 'QTD') return 'Prev. Quarter';
  if (rangePreset === 'YTD') return 'Prev. Year';
  return 'Prev. Period';
}

/** Season chip labels from mapping when available, else calendar fallback (legacy S1/S2/S3 shape). */
export function getCockpitSeasonLabels(refIso, seasonMapping = {}) {
  if (seasonMapping && Object.keys(seasonMapping).length > 0) {
    return getSeasonComparisonLabelsFromMapping(refIso, seasonMapping);
  }
  return getSeasonComparisonLabels(refIso ? new Date(`${refIso}T12:00:00`) : new Date());
}

/** All mapped seasons except the one containing refIso, newest first. */
export function listCompareSeasonsFromMapping(refIso, seasonMapping = {}) {
  const entries = Object.entries(seasonMapping || {})
    .map(([label, m]) => ({
      label,
      start: m?.startDate ? String(m.startDate).slice(0, 10) : null,
    }))
    .filter((e) => e.start)
    .sort((a, b) => b.start.localeCompare(a.start));

  if (!entries.length) return [];

  const current = findSeasonLabelForDate(refIso, seasonMapping);
  return entries.filter((e) => e.label !== current).map((e) => e.label);
}

export function seasonCompareOptionId(seasonLabel) {
  return `${SEASON_COMPARE_PREFIX}${seasonLabel}`;
}

/** Resolve chip id → season label (SEASON:…, legacy S1/S2/S3, or raw label). */
export function resolveSeasonLabelFromCompareId(comparisonType, seasonLabels = {}, seasonMapping = {}) {
  if (!comparisonType || comparisonType === 'PP') return null;
  if (typeof comparisonType === 'string' && comparisonType.startsWith(SEASON_COMPARE_PREFIX)) {
    return comparisonType.slice(SEASON_COMPARE_PREFIX.length);
  }
  if (isSeasonComparisonType(comparisonType)) {
    return seasonLabelForComparisonType(comparisonType, seasonLabels);
  }
  if (seasonMapping?.[comparisonType]) return comparisonType;
  return null;
}

/**
 * Compare options: PP + every season_mapping row except current.
 * Signature: (rangePreset, seasonMapping, refIso)
 * Legacy (rangePreset, seasonLabels, thirdSeasonEnabled) still works for S1/S2/(S3).
 */
export function buildCockpitComparisonOptions(rangePreset, seasonMappingOrLabels = {}, refIsoOrThird = null) {
  const opts = [{ id: 'PP', label: getCockpitPPLabel(rangePreset) }];

  const looksLikeLegacyLabels =
    seasonMappingOrLabels
    && typeof seasonMappingOrLabels === 'object'
    && ('season1' in seasonMappingOrLabels || 'season2' in seasonMappingOrLabels);

  if (looksLikeLegacyLabels) {
    const seasonLabels = seasonMappingOrLabels;
    const thirdSeasonEnabled = Boolean(refIsoOrThird);
    if (seasonLabels?.season1) opts.push({ id: 'S1', label: seasonLabels.season1 });
    if (seasonLabels?.season2) opts.push({ id: 'S2', label: seasonLabels.season2 });
    if (thirdSeasonEnabled && seasonLabels?.season3) {
      opts.push({ id: 'S3', label: seasonLabels.season3 });
    }
    return opts;
  }

  const seasonMapping = seasonMappingOrLabels || {};
  const refIso = refIsoOrThird;
  let seasons = listCompareSeasonsFromMapping(refIso, seasonMapping);
  if (!seasons.length) {
    const fb = getSeasonComparisonLabels(refIso ? new Date(`${String(refIso).slice(0, 10)}T12:00:00`) : new Date());
    seasons = [fb.season1, fb.season2, fb.season3].filter(Boolean);
  }
  for (const label of seasons) {
    opts.push({ id: seasonCompareOptionId(label), label });
  }
  return opts;
}

/**
 * Prior-period (PP) window.
 * STD + mapping → previous season day 1→N; else computePriorPeriodRange.
 */
export function resolveCockpitPriorRange(fromDate, toDate, rangePreset, seasonMapping = {}) {
  if (
    rangePreset === 'STD'
    && fromDate
    && toDate
    && seasonMapping
    && Object.keys(seasonMapping).length > 0
  ) {
    const labels = getSeasonComparisonLabelsFromMapping(toDate || fromDate, seasonMapping);
    if (labels.season1) {
      const aligned = alignMappedSeasonByDayOffset(fromDate, toDate, labels.season1, seasonMapping);
      return { start: aligned.start, end: aligned.end, label: 'Prev. Season' };
    }
  }
  return computePriorPeriodRange(fromDate, toDate, rangePreset);
}

/**
 * Compare window for PP or season chip.
 * STD → day-of-season offset; MTD/WTD/Custom → calendar month/day in mapped season.
 */
export function resolveCockpitCompareRange(
  fromDate,
  toDate,
  comparisonType,
  seasonLabels,
  seasonMapping = {},
  rangePreset = 'Custom',
) {
  if (comparisonType === 'PP') {
    return resolveCockpitPriorRange(fromDate, toDate, rangePreset, seasonMapping);
  }
  const seasonLabel = resolveSeasonLabelFromCompareId(comparisonType, seasonLabels, seasonMapping);
  if (!seasonLabel || !fromDate || !toDate) return { start: '', end: '' };

  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  const align = rangePreset === 'STD' ? alignMappedSeasonByDayOffset : alignMappedSeasonCompareRange;
  const aligned = align(from, to, seasonLabel, seasonMapping);
  return { start: aligned.start, end: aligned.end, label: seasonLabel };
}

/** True if [compareFrom, compareTo] overlaps dashboard data [dataMin, dataMax]. */
export function compareRangeHasData(compareFrom, compareTo, dataMin, dataMax) {
  if (!compareFrom || !compareTo || !dataMin || !dataMax) return false;
  const a = String(compareFrom).slice(0, 10);
  const b = String(compareTo).slice(0, 10);
  const min = String(dataMin).slice(0, 10);
  const max = String(dataMax).slice(0, 10);
  const from = a <= b ? a : b;
  const to = a <= b ? b : a;
  return from <= max && to >= min;
}

export function notifyCompareDataUnavailable(seasonLabel) {
  const name = seasonLabel || 'this season';
  toast(`Data is not available for comparison for ${name}.`, {
    duration: 3200,
    style: {
      background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 45%, #fed7aa 100%)',
      color: '#9a3412',
      border: '1px solid #fdba74',
      fontSize: '13px',
      fontWeight: 600,
      boxShadow: '0 4px 14px rgba(251, 146, 60, 0.18)',
    },
  });
}

/**
 * Apply a Compare chip selection; toast once when season window has no data overlap.
 */
export function applyCockpitCompareSelection({
  nextId,
  fromDate,
  toDate,
  rangePreset,
  seasonMapping,
  seasonLabels,
  dataMin,
  dataMax,
  setComparisonType,
}) {
  setComparisonType(nextId);
  if (!nextId || nextId === 'PP') return;

  const resolved = resolveCockpitCompareRange(
    fromDate,
    toDate,
    nextId,
    seasonLabels,
    seasonMapping,
    rangePreset,
  );
  const label =
    resolved.label
    || resolveSeasonLabelFromCompareId(nextId, seasonLabels, seasonMapping)
    || nextId;

  if (!compareRangeHasData(resolved.start, resolved.end, dataMin, dataMax)) {
    notifyCompareDataUnavailable(label);
  }
}

/** Drop stale compare selection if chip no longer in options. */
export function ensureCompareSelectionValid(comparisonType, comparisonOptions, setComparisonType) {
  if (!comparisonType || comparisonType === 'PP') return;
  const ok = (comparisonOptions || []).some((o) => o.id === comparisonType);
  if (!ok) setComparisonType('PP');
}

export function clampIsoToBounds(iso, minStr, maxStr) {
  if (!iso) return iso;
  let v = String(iso).slice(0, 10);
  if (minStr && v < minStr) v = minStr;
  if (maxStr && v > maxStr) v = maxStr;
  return v;
}
