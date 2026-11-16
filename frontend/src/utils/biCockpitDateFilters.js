/**
 * Shared BI cockpit date / compare filters (Milling pattern).
 * Compare season chips = all season_mapping rows except the current From/To season.
 */
import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  alignMappedSeasonByDayOffset,
  alignMappedSeasonCompareRange,
  computePriorPeriodRange,
  daysBetweenIso,
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
    if (start && start <= to) return { from: start, to };
    const seasonStartYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    const fallbackFrom = formatYMD(new Date(seasonStartYear, 9, 1));
    return { from: fallbackFrom <= to ? fallbackFrom : to, to };
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

/** All mapped seasons except the one containing refIso, prioritizing prior seasons newest first. */
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
  const idx = current ? entries.findIndex((e) => e.label === current) : -1;
  if (idx >= 0) {
    const older = entries.slice(idx + 1).map((e) => e.label);
    const newer = entries.slice(0, idx).map((e) => e.label);
    return [...older, ...newer];
  }
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
 * On STD, omit PP when at least one named season chip exists (newest season is the default compare).
 * Signature: (rangePreset, seasonMapping, refIso, options?)
 * Legacy (rangePreset, seasonLabels, thirdSeasonEnabled) still works for S1/S2/(S3).
 */
export function buildCockpitComparisonOptions(rangePreset, seasonMappingOrLabels = {}, refIsoOrThird = null, options = {}) {
  const omitPpOnStd = Boolean(options?.omitPpOnStd);
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
    if (omitPpOnStd && rangePreset === 'STD' && opts.length > 1) {
      return opts.filter((o) => o.id !== 'PP');
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
  if (omitPpOnStd && rangePreset === 'STD' && seasons.length > 0) {
    return opts.filter((o) => o.id !== 'PP');
  }
  return opts;
}

/**
 * Prior-period (PP) window.
 * Crop day (or STD when no mode is passed) → same crop days in the previous season.
 * Date based → previous week, month, or equal-length window.
 */
export function resolveCockpitPriorRange(fromDate, toDate, rangePreset, seasonMapping = {}, alignMode) {
  const useCropDay = alignMode === 'cropDay' || (alignMode !== 'calendar' && rangePreset === 'STD');
  if (
    useCropDay
    && fromDate
    && toDate
    && seasonMapping
    && Object.keys(seasonMapping).length > 0
  ) {
    const labels = getSeasonComparisonLabelsFromMapping(toDate || fromDate, seasonMapping);
    if (labels.season1) {
      const aligned = alignMappedSeasonByDayOffset(fromDate, toDate, labels.season1, seasonMapping);
      return { start: aligned.start, end: aligned.end, label: labels.season1, overlap: aligned.overlap };
    }
  }
  return computePriorPeriodRange(fromDate, toDate, rangePreset);
}

/**
 * Compare window for PP or season chip.
 * STD → day-of-season offset; MTD/WTD/Custom → calendar month/day in mapped season.
 * alignMode 'calendar' or 'cropDay' overrides that preset rule. Omit it to keep the preset rule.
 */
export function resolveCockpitCompareRange(
  fromDate,
  toDate,
  comparisonType,
  seasonLabels,
  seasonMapping = {},
  rangePreset = 'Custom',
  alignMode,
) {
  if (comparisonType === 'PP') {
    return resolveCockpitPriorRange(fromDate, toDate, rangePreset, seasonMapping, alignMode);
  }
  const seasonLabel = resolveSeasonLabelFromCompareId(comparisonType, seasonLabels, seasonMapping);
  if (!seasonLabel || !fromDate || !toDate) return { start: '', end: '' };

  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  const useCropDay = alignMode === 'cropDay' || (alignMode !== 'calendar' && rangePreset === 'STD');
  const align = useCropDay ? alignMappedSeasonByDayOffset : alignMappedSeasonCompareRange;
  const aligned = align(from, to, seasonLabel, seasonMapping);
  return { start: aligned.start, end: aligned.end, label: seasonLabel, overlap: aligned.overlap };
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
  alignMode,
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
    alignMode,
  );
  const label =
    resolved.label
    || resolveSeasonLabelFromCompareId(nextId, seasonLabels, seasonMapping)
    || nextId;

  if (!compareRangeHasData(resolved.start, resolved.end, dataMin, dataMax)) {
    notifyCompareDataUnavailable(label);
  }
}

/** Drop stale compare selection if chip no longer in options; fall back to first chip. */
export function ensureCompareSelectionValid(comparisonType, comparisonOptions, setComparisonType) {
  if (!comparisonType) return;
  const opts = comparisonOptions || [];
  if (!opts.length) return;
  const ok = opts.some((o) => o.id === comparisonType);
  if (!ok) setComparisonType(opts[0].id);
}

export function clampIsoToBounds(iso, minStr, maxStr) {
  if (!iso) return iso;
  let v = String(iso).slice(0, 10);
  if (minStr && v < minStr) v = minStr;
  if (maxStr && v > maxStr) v = maxStr;
  return v;
}

/**
 * Until the user picks a chip, select the season immediately before the current one.
 * Returns a function to call when the user clicks a compare chip.
 */
export function useDefaultPreviousSeasonCompare(comparisonType, comparisonOptions, setComparisonType) {
  const touched = useRef(false);
  useEffect(() => {
    const opts = comparisonOptions || [];
    if (!opts.length) return;
    const previousSeason = opts.find((opt) => opt.id !== 'PP');
    if (!comparisonType) {
      const next = previousSeason?.id || opts[0]?.id;
      if (next) setComparisonType(next);
      return;
    }
    if (!touched.current && previousSeason && comparisonType !== previousSeason.id) {
      setComparisonType(previousSeason.id);
      return;
    }
    ensureCompareSelectionValid(comparisonType, opts, setComparisonType);
  }, [comparisonType, comparisonOptions, setComparisonType]);

  return useCallback(() => {
    touched.current = true;
  }, []);
}

/** Distillery KPI date: "Apr 1". */
export function formatFriendlyCompareDate(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLongComparisonDate(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatComparisonSeasonName(label) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  return raw.replace(/(\d{4})\s*[-–]\s*(\d{2,4})/, '$1–$2');
}

function comparisonAgainstClause(label, cropDay) {
  const name = formatComparisonSeasonName(label);
  const subject = cropDay ? 'crop days' : 'period';
  if (name && /\d{4}/.test(name)) {
    return `against the corresponding ${subject} in the ${name} season`;
  }
  const plain = (name || 'previous period').replace(/^Prev\.\s*/i, 'previous ');
  return `against the corresponding ${subject} in the ${plain}`;
}

/**
 * Active comparison sentence for the Management Dashboard.
 * Crop Day 1 is the first day of the current season.
 */
function cropDaySpan(dayFrom, dayTo) {
  if (!Number.isFinite(dayFrom) || !Number.isFinite(dayTo) || dayFrom < 1 || dayTo < 1) return '';
  return dayFrom === dayTo ? `Crop Day ${dayFrom}` : `Crop Day ${dayFrom} to Crop Day ${dayTo}`;
}

function viewedCropOffsets(startIso, endIso, seasonMapping) {
  const seasonLabel = findSeasonLabelForDate(endIso, seasonMapping)
    || findSeasonLabelForDate(startIso, seasonMapping);
  const seasonStart = seasonLabel && seasonMapping?.[seasonLabel]?.startDate
    ? String(seasonMapping[seasonLabel].startDate).slice(0, 10)
    : '';
  if (!seasonStart) return { seasonStart: '', offsetFrom: null, offsetTo: null };
  return {
    seasonStart,
    offsetFrom: daysBetweenIso(seasonStart, startIso),
    offsetTo: daysBetweenIso(seasonStart, endIso),
  };
}

export function formatActiveComparisonContext({
  from,
  to,
  alignMode,
  compareLabel,
  seasonMapping = {},
  overlap,
  compareStart,
  compareEnd,
} = {}) {
  const startIso = from && to && from <= to ? from : to;
  const endIso = from && to && from <= to ? to : from;
  if (!startIso || !endIso) return '';

  const seasonName = formatComparisonSeasonName(compareLabel);
  const hasSeason = Boolean(seasonName && /\d{4}/.test(seasonName));
  const fromLabel = formatLongComparisonDate(startIso);
  const toLabel = formatLongComparisonDate(endIso);
  const { seasonStart, offsetFrom, offsetTo } = alignMode === 'cropDay'
    ? viewedCropOffsets(startIso, endIso, seasonMapping)
    : { seasonStart: '', offsetFrom: null, offsetTo: null };

  let cropFrom = null;
  let cropTo = null;
  if (offsetFrom != null && offsetTo != null && offsetTo >= 0) {
    cropFrom = Math.max(0, offsetFrom) + 1;
    cropTo = offsetTo + 1;
    if (compareStart && compareEnd) {
      const spanDays = daysBetweenIso(compareStart, compareEnd);
      if (spanDays != null && spanDays >= 0) cropTo = cropFrom + spanDays;
    }
  }
  const cropSpan = cropDaySpan(cropFrom, cropTo);

  if (overlap === 'none') {
    if (alignMode === 'cropDay' && cropSpan && hasSeason) {
      return `The ${seasonName} season has no corresponding crop days for ${cropSpan}.`;
    }
    if (hasSeason && fromLabel && toLabel) {
      return `The ${seasonName} season has no corresponding days for ${fromLabel} to ${toLabel}.`;
    }
    return '';
  }

  if (alignMode === 'cropDay' && offsetFrom != null && offsetTo != null && offsetFrom >= 0 && offsetTo >= 0) {
    const viewedSpan = cropDaySpan(offsetFrom + 1, offsetTo + 1);
    if (overlap === 'partial' && cropSpan && viewedSpan && cropSpan !== viewedSpan && hasSeason) {
      return `You are viewing the comparison for ${viewedSpan} against ${cropSpan} in the ${seasonName} season.`;
    }
    if (viewedSpan) {
      return `You are viewing the comparison for ${viewedSpan} ${comparisonAgainstClause(compareLabel, true)}.`;
    }
  }

  if (alignMode === 'cropDay' && cropSpan && offsetFrom != null && offsetFrom < 0 && seasonStart) {
    const outside = formatLongComparisonDate(seasonStart);
    return `You are viewing the comparison for ${cropSpan} ${comparisonAgainstClause(compareLabel, true)}. Dates before ${outside} are outside this season.`;
  }

  if (
    overlap === 'partial'
    && hasSeason
    && fromLabel
    && toLabel
    && compareStart
    && compareEnd
  ) {
    const cmpFrom = formatLongComparisonDate(compareStart);
    const cmpTo = formatLongComparisonDate(compareEnd);
    if (cmpFrom && cmpTo) {
      return `You are viewing the comparison for the period ${fromLabel} to ${toLabel} against ${cmpFrom} to ${cmpTo} in the ${seasonName} season.`;
    }
  }

  if (!fromLabel || !toLabel) return '';
  return `You are viewing the comparison for the period ${fromLabel} to ${toLabel} ${comparisonAgainstClause(compareLabel, false)}.`;
}

/**
 * Distillery-style compare window for KPI cards.
 * "Prev. Month (Apr 1 - Apr 10)" or "2023-24 (Oct 15 - Oct 22)"
 */
export function formatKpiComparePeriodLabel({ label, start, end, from, to } = {}) {
  const a = formatFriendlyCompareDate(start || from);
  const b = formatFriendlyCompareDate(end || to);
  const prefix = String(label || '').trim();
  if (a && b) return prefix ? `${prefix} (${a} - ${b})` : `${a} - ${b}`;
  return prefix;
}

/**
 * Expand-modal / Distillery pill: "32 Operating Days (STD) · vs 2024-2025 (Oct 27 - Mar 29)".
 * Omit `days` for dashboards without operating days: "STD · vs …".
 * Chip CSS should uppercase the result.
 */
export function formatExpandPeriodBadge({ days, periodLabel, comparisonLabel } = {}) {
  const parts = [];
  const preset = String(periodLabel || '').trim();
  const dayNum = days == null || days === '' ? NaN : Number(days);
  if (Number.isFinite(dayNum)) {
    parts.push(`${dayNum} Operating Days${preset ? ` (${preset})` : ''}`);
  } else if (preset) {
    parts.push(preset);
  }
  const vs = String(comparisonLabel || '').replace(/^vs\s+/i, '').trim();
  if (vs) parts.push(`vs ${vs}`);
  return parts.join(' · ');
}
