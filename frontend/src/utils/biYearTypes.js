/**
 * Distillery parent year-types: Sugar Season (SS), Ethanol Supplier Year (ESY),
 * Financial Year (FY).
 *
 * Compare chips always use Sugar Season labels from season_mapping.
 * FY / ESY only change the start/end dates applied to those labels
 * (Apr–Mar and Nov–Oct respectively).
 */
import {
  formatYMD,
  findSeasonLabelForDate,
  getPresetDateRange,
  parseIndianSeasonLabel,
  startOfFiscalYear,
} from './distilleryBiDateRange';
import {
  getCockpitPresetDateRange,
  startOfWeekMonday,
} from './biCockpitDateFilters';

export const YEAR_TYPE_SS = 'SS';
export const YEAR_TYPE_ESY = 'ESY';
export const YEAR_TYPE_FY = 'FY';

export const YEAR_TYPE_OPTIONS = [
  { id: YEAR_TYPE_SS, label: 'SS', title: 'Sugar Season' },
  { id: YEAR_TYPE_ESY, label: 'ESY', title: 'Ethanol Supplier Year' },
  { id: YEAR_TYPE_FY, label: 'FY', title: 'Financial Year' },
];

/** Child presets per parent year-type (Custom is always available separately). */
export const CHILD_PRESETS_BY_YEAR_TYPE = {
  [YEAR_TYPE_SS]: ['WTD', 'MTD', 'STD'],
  [YEAR_TYPE_ESY]: ['WTD', 'MTD', 'STD'],
  [YEAR_TYPE_FY]: ['WTD', 'MTD', 'QTD', 'YTD'],
};

export const DEFAULT_YEAR_TYPE = YEAR_TYPE_SS;
/** Distillery default range chip (STD). FY has no STD — use YTD instead. */
export const DEFAULT_CHILD_PRESET = 'STD';

export function defaultChildPresetForYearType(yearType) {
  const children = childPresetsForYearType(yearType);
  if (children.includes(DEFAULT_CHILD_PRESET)) return DEFAULT_CHILD_PRESET;
  if (children.includes('YTD')) return 'YTD';
  return children[0] || 'MTD';
}

/** Fixed calendar rules shown in Config (no per-year label list). */
export const FY_DATE_RULE = {
  startLabel: '1 Apr',
  endLabel: '31 Mar',
  description: 'Indian financial year (fixed)',
};

export const ESY_DATE_RULE = {
  startLabel: '1 Nov',
  endLabel: '31 Oct',
  description: 'Ethanol supplier year (fixed)',
};

/** ESY fixed window: 1 Nov → 31 Oct. */
export function getEsyBounds(startYear) {
  const y = Number(startYear);
  return {
    start: `${y}-11-01`,
    end: `${y + 1}-10-31`,
  };
}

/** Indian FY fixed window: 1 Apr → 31 Mar. */
export function getFyBounds(startYear) {
  const y = Number(startYear);
  return {
    start: `${y}-04-01`,
    end: `${y + 1}-03-31`,
  };
}

/** ESY start year containing `d` (Nov–Oct). */
export function esyStartYearForDate(d = new Date()) {
  const year = d.getFullYear();
  return d.getMonth() >= 10 ? year : year - 1;
}

/** FY start year containing `d` (Apr–Mar). */
export function fyStartYearForDate(d = new Date()) {
  const year = d.getFullYear();
  return d.getMonth() >= 3 ? year : year - 1;
}

/**
 * Reuse Sugar Season labels; replace dates with FY or ESY windows
 * derived from the label’s start year (e.g. 2024-2025 → 2024).
 */
export function mapSugarLabelsToFixedCalendar(sugarSeasonMapping = {}, calendar = 'FY') {
  const out = {};
  for (const label of Object.keys(sugarSeasonMapping || {})) {
    const parsed = parseIndianSeasonLabel(label);
    if (!parsed) continue;
    const bounds = calendar === 'ESY'
      ? getEsyBounds(parsed.startYear)
      : getFyBounds(parsed.startYear);
    out[label] = { startDate: bounds.start, endDate: bounds.end };
  }
  return out;
}

/**
 * Active calendar mapping for Distillery compare / STD, by year-type.
 * SS → sugar dates; FY/ESY → same labels, fixed Apr–Mar / Nov–Oct dates.
 */
export function resolveActiveYearMapping(yearType, sugarSeasonMapping = {}) {
  if (yearType === YEAR_TYPE_ESY) {
    return mapSugarLabelsToFixedCalendar(sugarSeasonMapping, 'ESY');
  }
  if (yearType === YEAR_TYPE_FY) {
    return mapSugarLabelsToFixedCalendar(sugarSeasonMapping, 'FY');
  }
  return sugarSeasonMapping || {};
}

export function childPresetsForYearType(yearType) {
  return CHILD_PRESETS_BY_YEAR_TYPE[yearType] || CHILD_PRESETS_BY_YEAR_TYPE[YEAR_TYPE_SS];
}

export function isValidChildPreset(yearType, preset) {
  if (preset === 'Custom') return true;
  return childPresetsForYearType(yearType).includes(preset);
}

/**
 * From–To for Distillery given parent year-type + child preset.
 */
export function getPresetDateRangeForYearType(
  yearType,
  preset,
  now = new Date(),
  sugarSeasonMapping = {},
) {
  if (preset === 'Custom') {
    const to = formatYMD(now);
    return { from: to, to };
  }

  if (yearType === YEAR_TYPE_FY) {
    if (preset === 'WTD') {
      return { from: formatYMD(startOfWeekMonday(now)), to: formatYMD(now) };
    }
    if (preset === 'MTD' || preset === 'QTD' || preset === 'YTD') {
      return getPresetDateRange(preset === 'MTD' ? 'MTD' : preset, now);
    }
    return getPresetDateRange('MTD', now);
  }

  if (yearType === YEAR_TYPE_ESY) {
    if (preset === 'WTD' || preset === 'MTD') {
      return getCockpitPresetDateRange(preset, now, {});
    }
    if (preset === 'STD') {
      const to = formatYMD(now);
      const esyMapping = mapSugarLabelsToFixedCalendar(sugarSeasonMapping, 'ESY');
      const label = findSeasonLabelForDate(to, esyMapping);
      const start = label && esyMapping[label]?.startDate
        ? String(esyMapping[label].startDate).slice(0, 10)
        : getEsyBounds(esyStartYearForDate(now)).start;
      return { from: start, to };
    }
    return getCockpitPresetDateRange('MTD', now, {});
  }

  // SS — sugar season mapping
  if (preset === 'WTD' || preset === 'MTD' || preset === 'STD') {
    return getCockpitPresetDateRange(preset, now, sugarSeasonMapping);
  }
  return getCockpitPresetDateRange('MTD', now, sugarSeasonMapping);
}

/** PP chip label for Distillery child presets. */
export function getDistilleryPPLabel(rangePreset) {
  if (rangePreset === 'WTD') return 'Prev. Week';
  if (rangePreset === 'MTD') return 'Prev. Month';
  if (rangePreset === 'STD') return 'Prev. Season';
  if (rangePreset === 'QTD') return 'Prev. Quarter';
  if (rangePreset === 'YTD') return 'Prev. Year';
  return 'Prev. Period';
}

/**
 * Cockpit compare rangePreset for alignment:
 * STD (SS/ESY) → day-of-season offset; FY QTD/YTD and others → calendar month/day.
 */
export function cockpitRangePresetForCompare(yearType, rangePreset) {
  if (rangePreset === 'Custom') return 'Custom';
  if ((yearType === YEAR_TYPE_SS || yearType === YEAR_TYPE_ESY) && rangePreset === 'STD') {
    return 'STD';
  }
  return rangePreset === 'WTD' || rangePreset === 'MTD' ? rangePreset : 'Custom';
}

/** FY start Date for a label or ref — used by tests / callers. */
export function fiscalYearStartDate(d = new Date()) {
  return startOfFiscalYear(d);
}
