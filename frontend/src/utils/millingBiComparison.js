import {
  alignSeasonCompareRange,
  compareDateIsoInIndianSeason,
  parseIndianSeasonLabel,
} from './distilleryBiDateRange';

/** Filter stoppage rows to date range and selected sections. */
export function filterMillStoppages(rows, fromDate, toDate, selectedSections) {
  const from = fromDate <= toDate ? fromDate : toDate;
  const to = fromDate <= toDate ? toDate : fromDate;
  return rows.filter((r) => {
    if (!r.dateIso) return false;
    if (r.dateIso < from || r.dateIso > to) return false;
    if (selectedSections.length === 0) return false;
    return selectedSections.includes(r.section);
  });
}

/** Rows in the aligned window for the selected Indian season. */
export function filterMillSeasonCompareRows(rawData, fromDate, toDate, seasonLabel, selectedSections) {
  const { start, end } = alignSeasonCompareRange(fromDate, toDate, seasonLabel);
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

/**
 * Daily stoppage hours (current) + compare overlay per day.
 * @param {boolean} useSeasonAlign — when true, map each current date into the season FY
 */
export function buildMillDailyStoppageSeries(filteredData, compareData, useSeasonAlign, seasonLabel) {
  const curMap = bucketHoursByDate(filteredData);
  const cmpMap = bucketHoursByDate(compareData);
  const parsed = useSeasonAlign && seasonLabel ? parseIndianSeasonLabel(seasonLabel) : null;

  return [...curMap.keys()]
    .sort()
    .map((dateIso) => {
      let compareIso = dateIso;
      if (parsed) {
        compareIso = compareDateIsoInIndianSeason(dateIso, parsed.startYear) || dateIso;
      }
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
