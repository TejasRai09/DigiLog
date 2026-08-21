/**
 * Shared BI cockpit date / compare filters (Milling pattern).
 * Used by all BI dashboards except Distillery.
 */
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
  return 'Prev. Period';
}

/** Season chip labels from mapping when available, else calendar fallback. */
export function getCockpitSeasonLabels(refIso, seasonMapping = {}) {
  if (seasonMapping && Object.keys(seasonMapping).length > 0) {
    return getSeasonComparisonLabelsFromMapping(refIso, seasonMapping);
  }
  return getSeasonComparisonLabels(refIso ? new Date(`${refIso}T12:00:00`) : new Date());
}

export function buildCockpitComparisonOptions(rangePreset, seasonLabels, thirdSeasonEnabled = false) {
  const opts = [{ id: 'PP', label: getCockpitPPLabel(rangePreset) }];
  if (seasonLabels?.season1) opts.push({ id: 'S1', label: seasonLabels.season1 });
  if (seasonLabels?.season2) opts.push({ id: 'S2', label: seasonLabels.season2 });
  if (thirdSeasonEnabled && seasonLabels?.season3) {
    opts.push({ id: 'S3', label: seasonLabels.season3 });
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
  const seasonLabel = isSeasonComparisonType(comparisonType)
    ? seasonLabelForComparisonType(comparisonType, seasonLabels)
    : null;
  if (!seasonLabel || !fromDate || !toDate) return { start: '', end: '' };

  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  const align = rangePreset === 'STD' ? alignMappedSeasonByDayOffset : alignMappedSeasonCompareRange;
  const aligned = align(from, to, seasonLabel, seasonMapping);
  return { start: aligned.start, end: aligned.end, label: seasonLabel };
}

export function clampIsoToBounds(iso, minStr, maxStr) {
  if (!iso) return iso;
  let v = String(iso).slice(0, 10);
  if (minStr && v < minStr) v = minStr;
  if (maxStr && v > maxStr) v = maxStr;
  return v;
}
