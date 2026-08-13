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
      recBl: (currentRow.recBl ?? currentRow.recovery) * 0.99,
      alBlRatioPct: (currentRow.alBlRatioPct ?? 0) * 0.99,
      fermEff: currentRow.fermEff * 0.99,
      distEff: currentRow.distEff * 0.995,
      overallEff: (currentRow.overallEff ?? 0) * 0.99,
      fermSugar: currentRow.fermSugar * 0.96,
      alcohol: currentRow.alcohol * 0.96,
      molInStore: currentRow.molInStore == null ? null : currentRow.molInStore * 1.03,
      ethInStore: currentRow.ethInStore == null ? null : currentRow.ethInStore * 0.96,
      bHeavyProd: currentRow.bHeavyProd * 0.94,
      cHeavyProd: currentRow.cHeavyProd * 0.94,
      syrupProd: currentRow.syrupProd * 0.94,
      mixedProd: (currentRow.mixedProd ?? 0) * 0.94,
    };
  }
  return {
    ...currentRow,
    totalProd: priorRow.totalProd,
    totalWash: priorRow.totalWash,
    syrupMolConsumed: priorRow.syrupMolConsumed,
    recovery: priorRow.recovery,
    recBl: priorRow.recBl ?? priorRow.recovery,
    alBlRatioPct: priorRow.alBlRatioPct,
    fermEff: priorRow.fermEff,
    distEff: priorRow.distEff,
    overallEff: priorRow.overallEff,
    fermSugar: priorRow.fermSugar,
    alcohol: priorRow.alcohol,
    molInStore: priorRow.molInStore,
    ethInStore: priorRow.ethInStore,
    bHeavyProd: priorRow.bHeavyProd,
    cHeavyProd: priorRow.cHeavyProd,
    syrupProd: priorRow.syrupProd,
    mixedProd: priorRow.mixedProd ?? 0,
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

/**
 * Power BI AVERAGE skips blanks.
 * - skipZero true (default): also skip 0 — for FE/DE/OE where blanks are stored as 0.
 * - skipZero false: include real 0s — for stock levels (blank must be null in data).
 */
export function averageNonBlank(rows, getValue, { skipZero = true } = {}) {
  if (!rows.length) return 0;
  let sum = 0;
  let n = 0;
  for (const row of rows) {
    const raw = getValue(row);
    if (raw == null || raw === '') continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (skipZero && v === 0) continue;
    sum += v;
    n += 1;
  }
  return n ? sum / n : 0;
}

export function aggregateKpisFromRows(rows) {
  if (!rows.length) {
    return { ethanolProd: 0, syrupMol: 0, fermEff: 0, distEff: 0, overallEff: 0, recBl: 0 };
  }
  return {
    ethanolProd: rows.reduce((sum, item) => sum + item.totalProd, 0),
    syrupMol: rows.reduce((sum, item) => sum + item.syrupMolConsumed, 0),
    fermEff: averageNonBlank(rows, (item) => item.fermEff),
    distEff: averageNonBlank(rows, (item) => item.distEff),
    overallEff: averageNonBlank(rows, (item) => item.overallEff),
    recBl: averageNonBlank(rows, (item) => item.recovery ?? item.recBl),
  };
}

/**
 * Power BI Distillery 7DMA measures: AVERAGE over the last `windowDays` days
 * ending on the day before each row's date (PREVIOUSDAY(LASTDATE) pattern).
 * Applied chronologically on already-sorted rows.
 */
export function attachDistillery7Dma(rows, windowDays = 7) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  const keys = [
    'totalProd',
    'recovery',
    'ethInStore',
    'totalBhMolassesQtls',
    'totalChMolassesQtls',
    'fermEff',
    'distEff',
    'trs',
    'fs',
    'molInStore',
  ];
  const out = rows.map((row) => ({ ...row }));
  for (let i = 0; i < out.length; i += 1) {
    // End exclusive at current day → window is previous `windowDays` rows before i
    const start = Math.max(0, i - windowDays);
    const end = i; // exclude current (PREVIOUSDAY of "today" in series)
    const slice = out.slice(start, end);
    for (const key of keys) {
      const dmaKey = `${key}7dma`;
      if (!slice.length) {
        out[i][dmaKey] = null;
        continue;
      }
      const vals = slice
        .map((r) => r[key])
        .filter((v) => v != null && v !== '')
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
      out[i][dmaKey] = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : null;
    }
  }
  return out;
}
