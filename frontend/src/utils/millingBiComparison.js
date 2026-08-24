import {
  alignMappedSeasonByDayOffset,
  alignMappedSeasonCompareRange,
  compareDateIsoInMappedSeason,
  formatYMD,
  isSeasonComparisonType,
} from './distilleryBiDateRange';

/** Filter stoppage rows to date range and selected sections. */
export function filterMillStoppages(rows, fromDate, toDate, selectedSections) {
  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  return rows.filter((r) => {
    if (!r.dateIso) return false;
    if (fromDate && toDate && (r.dateIso < from || r.dateIso > to)) return false;
    if (selectedSections.length === 0) return false;
    return selectedSections.includes(r.section);
  });
}

/**
 * Rows in the aligned window for a season_mapping label.
 * @param {{ bySeasonDay?: boolean }} [opts] - STD: same day-of-season (day 1→N); else calendar month/day
 */
export function filterMillSeasonCompareRows(
  rawData,
  fromDate,
  toDate,
  seasonLabel,
  selectedSections,
  seasonMapping = {},
  opts = {},
) {
  const align = opts.bySeasonDay
    ? alignMappedSeasonByDayOffset
    : alignMappedSeasonCompareRange;
  const { start, end } = align(fromDate, toDate, seasonLabel, seasonMapping);
  return rawData.filter((r) => {
    if (!r.dateIso) return false;
    if (r.dateIso < start || r.dateIso > end) return false;
    if (selectedSections.length === 0) return false;
    return selectedSections.includes(r.section);
  });
}

function bucketHoursByDate(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.dateIso) continue;
    map.set(r.dateIso, (map.get(r.dateIso) || 0) + (Number(r.hours) || 0));
  }
  return map;
}

/** Map a current-window date onto the compare window (season_mapping or day-offset). */
export function alignMillCompareDateIso(dateIso, alignOpts = {}) {
  const { comparisonType, fromDate, compareFrom, seasonLabel, seasonMapping, bySeasonDay } = alignOpts;
  if (!dateIso) return null;
  // STD (and any day-1→N compare): align by offset from window start, not calendar month/day
  if (bySeasonDay) {
    return shiftIsoByWindowStart(dateIso, fromDate, compareFrom);
  }
  if (isSeasonComparisonType(comparisonType) && seasonLabel) {
    const bounds = seasonMapping?.[seasonLabel];
    const startDate = bounds?.startDate ? String(bounds.startDate).slice(0, 10) : null;
    const endDate = bounds?.endDate ? String(bounds.endDate).slice(0, 10) : null;
    if (startDate && endDate) {
      return compareDateIsoInMappedSeason(dateIso, startDate, endDate);
    }
  }
  return shiftIsoByWindowStart(dateIso, fromDate, compareFrom);
}

function shiftIsoByWindowStart(dateIso, fromDate, compareFrom) {
  if (!dateIso || !fromDate || !compareFrom) return null;
  const d = new Date(`${dateIso}T12:00:00`);
  const from = new Date(`${fromDate}T12:00:00`);
  const cmp = new Date(`${compareFrom}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(from.getTime()) || Number.isNaN(cmp.getTime())) return null;
  const days = Math.round((d.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const out = new Date(cmp);
  out.setDate(out.getDate() + days);
  return formatYMD(out);
}

/**
 * Daily stoppage hours (current) + compare overlay per day.
 * Compare dates are aligned by season FY or by day-offset from the window start (PP).
 */
export function buildMillDailyStoppageSeries(filteredData, compareData, alignOpts = {}) {
  const curMap = bucketHoursByDate(filteredData);
  const cmpMap = bucketHoursByDate(compareData);

  return [...curMap.keys()]
    .sort()
    .map((dateIso) => {
      const compareIso = alignMillCompareDateIso(dateIso, alignOpts) || dateIso;
      const compareHours = compareIso ? (cmpMap.get(compareIso) ?? 0) : 0;
      return {
        dateIso,
        stoppageHours: Number((curMap.get(dateIso) ?? 0).toFixed(2)),
        stoppageHoursCompare: Number(compareHours.toFixed(2)),
      };
    });
}

export function aggregateMillStoppageKpis(rows, fromDate, toDate) {
  const sumHours = (list) => list.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
  const maxHours = (list) => (list.length ? Math.max(...list.map((r) => Number(r.hours) || 0)) : 0);
  const eventCount = (list) => list.filter((r) => (Number(r.hours) || 0) > 0).length;

  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const days =
    Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      ? 1
      : Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  const totalAvailable = days * 24;

  const totalHrs = sumHours(rows);
  const events = eventCount(rows);
  const mtbf = events > 0 ? (totalAvailable - totalHrs) / events : totalAvailable;

  return { totalHrs, events, maxDur: maxHours(rows), mtbf };
}

export const MILL_COMPARE_SUFFIX = '__cmp';

export function millCompareKey(variable) {
  return `${variable}${MILL_COMPARE_SUFFIX}`;
}

export function millPctDelta(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / p) * 100;
}

/** Mean of each logbook variable across rows. Zeros are treated as blanks (Power BI). */
export function averageLogbookValues(series) {
  const sums = {};
  const counts = {};
  for (const row of series || []) {
    for (const [k, v] of Object.entries(row.values || {})) {
      if (v == null || !Number.isFinite(Number(v))) continue;
      const n = Number(v);
      if (n === 0) continue;
      sums[k] = (sums[k] || 0) + n;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  const out = {};
  for (const k of Object.keys(sums)) out[k] = sums[k] / counts[k];
  return out;
}

function dailyAverageMap(series, variables) {
  const varSet = variables ? new Set(variables) : null;
  const acc = new Map();
  for (const row of series || []) {
    if (!row.dateIso) continue;
    let bucket = acc.get(row.dateIso);
    if (!bucket) {
      bucket = {};
      acc.set(row.dateIso, bucket);
    }
    for (const [k, v] of Object.entries(row.values || {})) {
      if (varSet && !varSet.has(k)) continue;
      if (v == null || !Number.isFinite(Number(v))) continue;
      if (!bucket[k]) bucket[k] = { sum: 0, n: 0 };
      bucket[k].sum += Number(v);
      bucket[k].n += 1;
    }
  }
  const out = new Map();
  for (const [iso, bucket] of acc) {
    const avgs = {};
    for (const [k, { sum, n }] of Object.entries(bucket)) {
      avgs[k] = n ? sum / n : null;
    }
    out.set(iso, avgs);
  }
  return out;
}

export function attachCompareDailyAverages(points, compareSeries, variables, alignDateIso) {
  if (!points?.length) return points || [];
  const byDate = dailyAverageMap(compareSeries, variables);
  return points.map((pt) => {
    const cmpIso = alignDateIso?.(pt.dateIso) || null;
    const avgs = cmpIso ? byDate.get(cmpIso) : null;
    const next = { ...pt };
    for (const v of variables) {
      next[millCompareKey(v)] = avgs?.[v] ?? null;
    }
    return next;
  });
}

export function applyMillCompareToChart(points, lines, compareSeries, compareAlign) {
  if (!points?.length || !compareSeries?.length || !compareAlign?.compareFrom) return points || [];
  const variables = (lines || []).map((l) => l.variable).filter(Boolean);
  if (!variables.length) return points;
  return attachCompareDailyAverages(
    points,
    compareSeries,
    variables,
    (iso) => alignMillCompareDateIso(iso, compareAlign),
  );
}

export function millCompareLineDefs(lines) {
  return (lines || []).map((l) => ({
    variable: millCompareKey(l.variable),
    label: `${l.label} (cmp)`,
    color: l.color,
    dashed: true,
  }));
}

export function millExpandLines(lines) {
  return [...(lines || []), ...millCompareLineDefs(lines || [])];
}

export function millCompareSeriesLabel(lines, dataKey) {
  if (!dataKey) return '';
  const key = String(dataKey);
  if (key.endsWith(MILL_COMPARE_SUFFIX)) {
    const base = key.slice(0, -MILL_COMPARE_SUFFIX.length);
    const line = (lines || []).find((l) => l.variable === base);
    return line ? `${line.label} (cmp)` : key;
  }
  const line = (lines || []).find((l) => l.variable === dataKey);
  return line?.label || line?.equipmentName || key;
}

/**
 * Pair current + compare Recharts payload entries for readable tooltips.
 * Order follows `lines` (or first-seen base keys). Same color for actual and cmp.
 * @returns {{ key: string; label: string; color: string; actual: number|null; compare: number|null }[]}
 */
export function pairMillCompareTooltipEntries(payload, lines = []) {
  if (!payload?.length) return [];
  const byKey = new Map();
  for (const p of payload) {
    if (p?.dataKey == null) continue;
    const key = String(p.dataKey);
    byKey.set(key, p);
  }

  const baseOrder = [];
  const seen = new Set();
  for (const line of lines || []) {
    let base = line?.variable;
    if (!base) continue;
    if (base.endsWith(MILL_COMPARE_SUFFIX)) {
      base = base.slice(0, -MILL_COMPARE_SUFFIX.length);
    }
    if (!base || seen.has(base)) continue;
    seen.add(base);
    baseOrder.push(base);
  }
  for (const key of byKey.keys()) {
    const base = key.endsWith(MILL_COMPARE_SUFFIX)
      ? key.slice(0, -MILL_COMPARE_SUFFIX.length)
      : key;
    if (!seen.has(base)) {
      seen.add(base);
      baseOrder.push(base);
    }
  }

  const out = [];
  for (const base of baseOrder) {
    const cur = byKey.get(base);
    const cmp = byKey.get(millCompareKey(base));
    const curVal = cur?.value;
    const cmpVal = cmp?.value;
    const hasCur = curVal != null && Number.isFinite(Number(curVal));
    const hasCmp = cmpVal != null && Number.isFinite(Number(cmpVal));
    if (!hasCur && !hasCmp) continue;

    const line =
      (lines || []).find((l) => l.variable === base)
      || (lines || []).find((l) => {
        const v = String(l.variable || '');
        return v.endsWith(MILL_COMPARE_SUFFIX) && v.slice(0, -MILL_COMPARE_SUFFIX.length) === base;
      });
    const rawLabel = line?.label || line?.equipmentName || millCompareSeriesLabel(lines, base) || base;
    const label = String(rawLabel).replace(/\s*\(cmp\)\s*$/i, '');
    const color =
      (lines || []).find((l) => l.variable === base)?.color
      || line?.color
      || cur?.color
      || cmp?.color
      || '#64748b';
    out.push({
      key: base,
      label,
      color,
      actual: hasCur ? Number(curVal) : null,
      compare: hasCmp ? Number(cmpVal) : null,
    });
  }
  return out;
}

export function millCompareLineProps(line) {
  return {
    type: 'monotone',
    dataKey: millCompareKey(line.variable),
    name: `${line.label} (cmp)`,
    stroke: line.color,
    strokeWidth: 1.5,
    strokeDasharray: '5 4',
    strokeOpacity: 0.65,
    dot: false,
    connectNulls: true,
    isAnimationActive: false,
    legendType: 'none',
  };
}
