/** @typedef {'MTD' | 'QTD' | 'YTD'} DistilleryRangePreset */

/** Indian financial year starts 1 April (matches PY comparison labels e.g. 2024-2025). */
const FY_START_MONTH = 3; // April (0-indexed)

export function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Calendar quarter (Jan–Mar, Apr–Jun, …) — not used for BI presets. */
export function startOfQuarter(d) {
  const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), qStartMonth, 1);
}

/** Calendar year — not used for BI YTD preset. */
export function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

/** First day of the Indian FY containing `d` (Apr 1 – Mar 31). */
export function startOfFiscalYear(d) {
  const year = d.getFullYear();
  const fyStartYear = d.getMonth() >= FY_START_MONTH ? year : year - 1;
  return new Date(fyStartYear, FY_START_MONTH, 1);
}

/** First day of the Indian FY quarter containing `d` (Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar). */
export function startOfFiscalQuarter(d) {
  const fyStart = startOfFiscalYear(d);
  const monthsSinceFyStart =
    (d.getFullYear() - fyStart.getFullYear()) * 12 + (d.getMonth() - fyStart.getMonth());
  const quarterIndex = Math.floor(monthsSinceFyStart / 3);
  return new Date(fyStart.getFullYear(), fyStart.getMonth() + quarterIndex * 3, 1);
}

/**
 * @param {DistilleryRangePreset} preset
 * @param {Date} [now]
 * @returns {{ from: string; to: string }}
 */
export function getPresetDateRange(preset, now = new Date()) {
  const to = formatYMD(now);
  let fromD;
  if (preset === 'MTD') fromD = startOfMonth(now);
  else if (preset === 'QTD') fromD = startOfFiscalQuarter(now);
  else if (preset === 'YTD') fromD = startOfFiscalYear(now);
  else fromD = startOfMonth(now);
  return { from: formatYMD(fromD), to };
}

export function formatDMYShort(iso) {
  if (!iso || String(iso).length < 10) return iso || '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

/**
 * Prior-period window for PP comparison (aligned with MTD / QTD / YTD / Custom selection).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {'MTD' | 'QTD' | 'YTD' | 'Custom'} rangePreset
 */
export function computePriorPeriodRange(startDate, endDate, rangePreset) {
  const startD = new Date(`${startDate}T12:00:00`);
  const endD = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
    return { start: startDate, end: endDate, label: 'Prev. Period' };
  }

  const pStart = new Date(startD);
  const pEnd = new Date(endD);
  let label = 'Prev. Period';

  if (rangePreset === 'MTD') {
    pStart.setMonth(startD.getMonth() - 1);
    pEnd.setMonth(endD.getMonth() - 1);
    if (pStart.getMonth() === startD.getMonth()) pStart.setDate(0);
    if (pEnd.getMonth() === endD.getMonth()) pEnd.setDate(0);
    label = 'Prev. Month';
  } else if (rangePreset === 'QTD') {
    pStart.setMonth(startD.getMonth() - 3);
    pEnd.setMonth(endD.getMonth() - 3);
    label = 'Prev. Quarter';
  } else if (rangePreset === 'YTD') {
    pStart.setFullYear(startD.getFullYear() - 1);
    pEnd.setFullYear(endD.getFullYear() - 1);
    label = 'Prev. Year';
  } else {
    const diffDays = Math.round((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
    pStart.setDate(startD.getDate() - diffDays);
    pEnd.setDate(startD.getDate() - 1);
    label = 'Prev. Period';
  }

  return { start: formatYMD(pStart), end: formatYMD(pEnd), label };
}

/**
 * PY / P2Y season toggle labels (e.g. calendar 2027 → 2025-2026, 2024-2025).
 * Uses the reference date’s calendar year so labels stay current as years roll.
 * @param {Date} [refDate]
 */
export function getSeasonComparisonLabels(refDate = new Date()) {
  const y = refDate.getFullYear();
  const season1 = `${y - 2}-${y - 1}`;
  const season2 = `${y - 3}-${y - 2}`;
  const season3 = `${y - 4}-${y - 3}`;
  return {
    season1,
    season2,
    season3,
    py: season1,
    p2y: season2,
    p3y: season3,
  };
}

/** How many years to shift the selected date range for each season compare. */
export const SEASON_YEARS_BACK = {
  S1: 2,
  S2: 3,
  S3: 4,
};

export function isSeasonComparisonType(type) {
  return type === 'S1' || type === 'S2' || type === 'S3';
}

export function yearsBackForSeasonComparison(type) {
  return SEASON_YEARS_BACK[type] ?? null;
}

/** Shift from/to back N years (same calendar month/day window). */
export function shiftDateRangeYears(fromDate, toDate, yearsBack) {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { start: fromDate, end: toDate };
  }
  start.setFullYear(start.getFullYear() - yearsBack);
  end.setFullYear(end.getFullYear() - yearsBack);
  return { start: formatYMD(start), end: formatYMD(end) };
}

/** Parse season label "2023-2024" → Indian FY start year (Apr–Mar). */
export function parseIndianSeasonLabel(label) {
  const m = String(label).match(/^(\d{4})-(\d{4})$/);
  if (!m) return null;
  const startYear = parseInt(m[1], 10);
  const endYear = parseInt(m[2], 10);
  if (endYear !== startYear + 1) return null;
  return { startYear, endYear };
}

export function indianSeasonBounds(startYear) {
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

/** Map a current-range date to the same month/day inside the selected Indian season. */
export function compareDateIsoInIndianSeason(iso, seasonStartYear) {
  if (!iso || iso.length < 10) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const compareYear = d.getMonth() >= FY_START_MONTH ? seasonStartYear : seasonStartYear + 1;
  return formatYMD(new Date(compareYear, d.getMonth(), d.getDate()));
}

/**
 * Align the current From–To window into the selected season FY (e.g. MTD May 2026 → May 2023 for 2023-2024).
 * @returns {{ start: string; end: string; fyStart: string; fyEnd: string }}
 */
export function alignSeasonCompareRange(fromDate, toDate, seasonLabel) {
  const parsed = parseIndianSeasonLabel(seasonLabel);
  if (!parsed) {
    return { start: fromDate, end: toDate, fyStart: fromDate, fyEnd: toDate };
  }
  const fy = indianSeasonBounds(parsed.startYear);
  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  const startIso = compareDateIsoInIndianSeason(from, parsed.startYear);
  const endIso = compareDateIsoInIndianSeason(to, parsed.startYear);
  if (!startIso || !endIso) {
    return { start: fy.start, end: fy.end, fyStart: fy.start, fyEnd: fy.end };
  }
  let start = startIso <= endIso ? startIso : endIso;
  let end = startIso <= endIso ? endIso : startIso;
  if (start < fy.start) start = fy.start;
  if (end > fy.end) end = fy.end;
  return { start, end, fyStart: fy.start, fyEnd: fy.end };
}

export function seasonLabelForComparisonType(type, seasonLabels) {
  if (type === 'S1') return seasonLabels.season1;
  if (type === 'S2') return seasonLabels.season2;
  if (type === 'S3') return seasonLabels.season3;
  return null;
}
