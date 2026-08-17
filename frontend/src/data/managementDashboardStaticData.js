/**
 * Builds static Management Dashboard payload (PBI snapshot values + mock daily series).
 */
import {
  MANAGEMENT_KPI_CATALOG,
  MANAGEMENT_ROWS,
  MANAGEMENT_DATE_BOUNDS,
  MANAGEMENT_DMA,
  ROW_CHART_COLORS,
  getKpiGlossary,
} from './managementDashboardMeta';

/** PBI snapshot values (Oct 27 2024 – Mar 29 2025 season). */
const SNAPSHOT_VALUES = {
  cane_indent: { value: 21390, display: '21.39K' },
  cane_purchase: { value: 71130, display: '71.13K' },
  yard_bal: {
    value: 21775.86,
    subValues: [
      { label: 'Overrun Gate', value: '67.4%', unit: '%' },
      { label: 'Overrun Center', value: '79.1%', unit: '%', rightVal: '4.19K', valColor: 'text-red-500' },
    ],
  },
  pol_in_cane: { value: 15.16 },
  brix_yard: { value: 19.73 },
  brix_field: { value: 19.41 },
  cane_crush: { value: 73070, display: '73.07K' },
  maceration: { value: 54.21 },
  mixed_juice: { value: 88030, display: '88.03K' },
  dmf: { value: 66.51 },
  bag_pol_cane: {
    value: 0.49,
    rightVal: 0.57,
    subValues: [
      { label: 'Pol % Bagasse', value: 1.76, rightVal: 1.73 },
      { label: 'Bagasse Moisture', value: 49.67, rightVal: 49.66 },
    ],
  },
  power_per_cane: { value: 1.36 },
  steam_per_cane: { value: 5.96 },
  cane_ds: { value: 48240, display: '48.24K' },
  cane_rs: { value: 24830, display: '24.83K' },
  sugar_total: { value: 8330, display: '8.33K' },
  sugar_recovery: { value: 11.4 },
  pol_f_cake: {
    value: 0.08,
    rightVal: 0.08,
    subValues: [
      { label: 'Mol Pol % Cane', value: 2.28, rightVal: 3.08 },
      { label: 'F Mol Purity (DS)', value: 43.37, rightVal: 50.09 },
      { label: 'F Mol Purity (RS)', value: 41.29, rightVal: 48.82 },
    ],
  },
  power_per_sugar: { value: 10.81 },
  steam_per_sugar: { value: 429.94 },
  power_gen: { value: 909730, display: '909.73K' },
  power_export: { value: 534330, display: '534.33K' },
  inhouse_consp: { value: 375400, display: '375.40K' },
  steam_gen: { value: 5740, display: '5.74K' },
  steam_to_sugar: { value: 3600, display: '3.60K' },
  steam_bag: {
    value: 2.52,
    rightVal: 2.57,
    subValues: [
      { label: 'Steam/Bag 70 TPH', value: 2.19, rightVal: 2.23 },
      { label: 'Steam/Bag 35 TPH', value: 2.01, rightVal: 1.82 },
    ],
  },
  spec_steam: {
    value: 5.12,
    rightVal: 5.14,
    subValues: [
      { label: 'Sp. Steam 3(O+N)', value: 8.83, rightVal: 8.96 },
      { label: 'Sp. Steam 4MW', value: 8.96, rightVal: 9.26 },
    ],
  },
  syrup_mol: { value: 3900, display: '3.90K' },
  ethanol_prod: { value: 125200, display: '125.20K' },
  recovery_bl: { value: 32.1 },
  ethanol_store: { value: 250280, display: '250.28K' },
  b_mol_store: {
    value: 77630,
    rightVal: '233.0K',
    subValues: [{ label: 'C Mol in Store (Q)', value: '0.00', rightVal: '0.00' }],
  },
  dist_eff: {
    value: '98.80%',
    rightVal: '98.80%',
    subValues: [{ label: 'Fermentation Eff.', value: '92.71%', rightVal: '92.79%' }],
  },
  trs_fs: { value: 55.45, rightVal: 54.26 },
};

function parseSeedValue(snap) {
  if (!snap || snap.value == null) return 100;
  if (typeof snap.value === 'number' && Number.isFinite(snap.value)) return snap.value;
  if (typeof snap.value === 'string' && snap.value.includes('%')) {
    const n = parseFloat(snap.value);
    return Number.isFinite(n) ? n : 50;
  }
  return 100;
}

function seededNoise(seed, i) {
  const x = Math.sin(seed * 9999 + i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(from, to) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function generateMockSeries(kpiId, seedValue, from, to, meta = null) {
  const total = daysBetween(from, to);
  const step = total > 120 ? 3 : total > 60 ? 2 : 1;
  const base = seedValue > 0 ? seedValue : 50;
  const amplitude = base * 0.12;
  const points = [];

  for (let i = 0; i < total; i += step) {
    const date = addDays(from, i);
    if (date > to) break;
    const trend = base * (0.85 + (i / total) * 0.3);
    const noise = (seededNoise(kpiId.charCodeAt(0), i) - 0.5) * amplitude;
    const seasonal = Math.sin(i / 14) * amplitude * 0.4;
    const raw = Math.max(0, trend + noise + seasonal);
    const point = {
      date,
      dateFull: date,
      value: round2(raw),
    };

    if (meta?.id === 'sugar_total') {
      const dsShare = 0.58 + seededNoise(11, i) * 0.08;
      point.valueDs = round2(raw * dsShare);
      point.valueRs = round2(raw * (1 - dsShare));
    }

    if (meta?.id === 'trs_fs') {
      const trsBase = base > 0 ? base : 55;
      const trs = trsBase + (seededNoise(21, i) - 0.5) * 4 + Math.sin(i / 12) * 1.5;
      const fs = (meta?.companionSeed ?? trsBase - 1.2) + (seededNoise(31, i) - 0.5) * 3.5;
      point.value = round2(trs);
      point.value2 = round2(fs);
    }

    points.push(point);
  }
  return points;
}

function buildKpiPayload(meta) {
  const snap = SNAPSHOT_VALUES[meta.id] || {};
  const seed = parseSeedValue(snap);
  const seriesMeta =
    meta.id === 'trs_fs'
      ? { ...meta, companionSeed: typeof snap.rightVal === 'number' ? snap.rightVal : parseFloat(snap.rightVal) }
      : meta;
  const series = generateMockSeries(
    meta.id,
    seed,
    MANAGEMENT_DATE_BOUNDS.from,
    MANAGEMENT_DATE_BOUNDS.to,
    seriesMeta,
  );

  return {
    id: meta.id,
    title: meta.title,
    value: snap.value ?? snap.display ?? null,
    rawValue: snap.value ?? snap.display ?? null,
    rightVal: snap.rightVal ?? null,
    subValues: (snap.subValues ?? []).map((sub) => ({
      ...sub,
      glossary: getKpiGlossary(meta.id, sub.label),
    })),
    unit: meta.unit,
    glossary: getKpiGlossary(meta.id),
    definition: getKpiGlossary(meta.id) || meta.formula,
    formula: meta.formula,
    chart7dma: meta.chart7dma,
    chart: meta.chartType,
    seriesKeys: meta.seriesKeys ?? null,
    chartColor: ROW_CHART_COLORS[meta.rowId],
    series,
    sourceTable: meta.sourceTable,
    aggregation: meta.aggregation,
  };
}

export function buildManagementDashboardStatic() {
  const rows = MANAGEMENT_ROWS.map((row) => ({
    id: row.id,
    title: row.title,
    color: row.color,
    icon: row.icon,
    kpis: MANAGEMENT_KPI_CATALOG.filter((k) => k.rowId === row.id).map(buildKpiPayload),
  }));

  return {
    from: MANAGEMENT_DATE_BOUNDS.from,
    to: MANAGEMENT_DATE_BOUNDS.to,
    dma: MANAGEMENT_DMA,
    dateBounds: { ...MANAGEMENT_DATE_BOUNDS },
    rows,
  };
}

export function filterKpiSeries(series, from, to) {
  if (!Array.isArray(series) || !from || !to) return series || [];
  return series.filter((p) => p.date >= from && p.date <= to);
}

export default buildManagementDashboardStatic;
