import {
  alignSeasonCompareRange,
  compareDateIsoInIndianSeason,
  parseIndianSeasonLabel,
} from './distilleryBiDateRange';

/** Map BI point fields from a prior row onto the current row shape for charts/KPIs. */
export function overlayPriorMetrics(currentRow, priorRow) {
  if (!priorRow) {
    return {
      ...currentRow,
      totalProd: currentRow.totalProd * 0.94,
      totalWash: currentRow.totalWash * 0.94,
      syrupMolConsumed: currentRow.syrupMolConsumed * 0.94,
      recovery: currentRow.recovery * 0.99,
      fermEff: currentRow.fermEff * 0.99,
      distEff: currentRow.distEff * 0.995,
      fermSugar: currentRow.fermSugar * 0.96,
      alcohol: currentRow.alcohol * 0.96,
      molInStore: currentRow.molInStore * 1.03,
      ethInStore: currentRow.ethInStore * 0.96,
    };
  }
  return {
    ...currentRow,
    totalProd: priorRow.totalProd,
    totalWash: priorRow.totalWash,
    syrupMolConsumed: priorRow.syrupMolConsumed,
    recovery: priorRow.recovery,
    fermEff: priorRow.fermEff,
    distEff: priorRow.distEff,
    fermSugar: priorRow.fermSugar,
    alcohol: priorRow.alcohol,
    molInStore: priorRow.molInStore,
    ethInStore: priorRow.ethInStore,
  };
}

export function shiftIsoYears(iso, yearsBack) {
  if (!iso || iso.length < 10) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() - yearsBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Rows in the aligned window for the selected Indian season (e.g. 2023-2024 → Apr 2023–Mar 2024 slice).
 */
export function filterSeasonCompareRowsBySeason(rawData, fromDate, toDate, seasonLabel, rowDateIso, selectedModes) {
  const { start, end } = alignSeasonCompareRange(fromDate, toDate, seasonLabel);
  return rawData.filter((row) => {
    const iso = rowDateIso(row);
    if (!iso || iso < start || iso > end) return false;
    if (selectedModes.length > 0 && !selectedModes.includes(row.mode)) return false;
    return true;
  });
}

/**
 * Per-day chart compare: match each current day to the same month/day in the selected season FY.
 */
export function buildSeasonHistoricalByDay(filteredData, priorRows, seasonLabel, rowDateIso) {
  const parsed = parseIndianSeasonLabel(seasonLabel);
  const byIso = new Map();
  for (const row of priorRows) {
    const iso = rowDateIso(row);
    if (iso) byIso.set(iso, row);
  }
  return filteredData.map((item) => {
    const iso = rowDateIso(item);
    const priorIso = iso && parsed ? compareDateIsoInIndianSeason(iso, parsed.startYear) : null;
    const priorRow = priorIso ? byIso.get(priorIso) : null;
    return overlayPriorMetrics(item, priorRow);
  });
}

export function aggregateKpisFromRows(rows) {
  if (!rows.length) {
    return { ethanolProd: 0, syrupMol: 0, fermEff: 0, distEff: 0 };
  }
  return {
    ethanolProd: rows.reduce((sum, item) => sum + item.totalProd, 0),
    syrupMol: rows.reduce((sum, item) => sum + item.syrupMolConsumed, 0),
    fermEff: rows.reduce((sum, item) => sum + item.fermEff, 0) / rows.length,
    distEff: rows.reduce((sum, item) => sum + item.distEff, 0) / rows.length,
  };
}
