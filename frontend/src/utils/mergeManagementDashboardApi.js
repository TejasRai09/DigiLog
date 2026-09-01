/**
 * Merge live Management Dashboard API payload with static KPI catalog metadata.
 */
import {
  MANAGEMENT_KPI_CATALOG,
  MANAGEMENT_ROWS,
  INVERSE_GOOD_KPI_IDS,
  getKpiGlossary,
  formatKpiTablesUsed,
} from '../data/managementDashboardMeta';

const catalogById = new Map(MANAGEMENT_KPI_CATALOG.map((k) => [k.id, k]));

function enrichKpi(apiKpi) {
  const meta = catalogById.get(apiKpi.id) || MANAGEMENT_KPI_CATALOG.find((k) => k.title === apiKpi.title);
  if (!meta) {
    return {
      ...apiKpi,
      series: apiKpi.series || [],
      glossary: getKpiGlossary(apiKpi.id),
    };
  }

  return {
    id: meta.id,
    title: meta.title,
    value: apiKpi.value,
    rawValue: apiKpi.value,
    rightVal: apiKpi.rightVal ?? null,
    compareVal: apiKpi.compareVal ?? null,
    inverseGood: INVERSE_GOOD_KPI_IDS.has(meta.id),
    subValues: (apiKpi.subValues || []).map((sub) => ({
      ...sub,
      glossary: getKpiGlossary(meta.id, sub.label),
    })),
    stackedLabel: meta.stackedLabel || apiKpi.stackedLabel,
    unit: meta.unit,
    glossary: getKpiGlossary(meta.id),
    definition: getKpiGlossary(meta.id) || meta.formula,
    formula: meta.formula,
    chart7dma: meta.chart7dma,
    // Frontend meta is the source of truth for whether a KPI should render a chart.
    chart: meta.chartType || apiKpi.chart || 'none',
    seriesKeys: meta.seriesKeys ?? null,
    chartColor: apiKpi.chartColor,
    series: apiKpi.series || [],
    sourceTable: formatKpiTablesUsed(meta),
    dateJoin: meta.dateJoin ?? null,
    aggregation: meta.aggregation,
  };
}

export function mergeManagementDashboardApi(apiData) {
  const apiRows = apiData?.rows || [];
  const apiRowById = new Map(apiRows.map((r) => [r.id, r]));

  const rows = MANAGEMENT_ROWS.map((rowMeta) => {
    const apiRow = apiRowById.get(rowMeta.id);
    const apiKpis = apiRow?.kpis || [];
    const apiKpiById = new Map(apiKpis.map((k) => [k.id, k]));

    const kpis = MANAGEMENT_KPI_CATALOG.filter((k) => k.rowId === rowMeta.id).map((meta) => {
      const apiKpi = apiKpiById.get(meta.id);
      if (apiKpi) return enrichKpi(apiKpi);
      return enrichKpi({ id: meta.id, title: meta.title, value: null, series: [] });
    });

    return {
      id: rowMeta.id,
      title: rowMeta.title,
      color: rowMeta.color,
      icon: rowMeta.icon,
      kpis,
    };
  });

  const bounds = apiData?.dateBounds || {};

  return {
    from: apiData?.from || bounds.min,
    to: apiData?.to || bounds.max,
    dma: apiData?.dma ?? 7,
    daysElapsed: apiData?.daysElapsed ?? 0,
    dateBounds: {
      min: bounds.min || null,
      max: bounds.max || null,
      from: bounds.min || null,
      to: bounds.max || null,
    },
    rows,
  };
}

export default mergeManagementDashboardApi;
