import api from '../api/axios';
import { formatYMD, resolveDashboardToDate } from './distilleryBiDateRange';
import { getCockpitPresetDateRange } from './biCockpitDateFilters';

function clampIso(iso, minStr, maxStr) {
  if (!iso) return iso;
  if (minStr && iso < minStr) return minStr;
  if (maxStr && iso > maxStr) return maxStr;
  return iso;
}

/** Current crushing season (STD), independent of the on-screen WTD/MTD/Custom range. */
export function resolveCaneSeasonWindow({ seasonMapping, dbMinDateStr, dbMaxDateStr }) {
  const toIso = resolveDashboardToDate(null, dbMaxDateStr) || dbMaxDateStr || formatYMD(new Date());
  const ref = toIso ? new Date(`${String(toIso).slice(0, 10)}T12:00:00`) : new Date();
  const std = getCockpitPresetDateRange('STD', ref, seasonMapping || {});
  const from = clampIso(std.from, dbMinDateStr, dbMaxDateStr) || dbMinDateStr || std.from;
  const to = clampIso(std.to, dbMinDateStr, dbMaxDateStr) || dbMaxDateStr || std.to;
  return { from, to };
}

async function blobErrorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.error) return parsed.error;
    } catch {
      // not JSON
    }
  }
  return err?.message || 'Export failed';
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download the current-season workbook: one sheet per exported tab (plus Summary for all tabs)
 * and the gate / center records behind them.
 * @param {'tab'|'all'} scope
 */
export async function exportCaneSeasonWorkbook({
  scope = 'tab',
  tabId = 'procurement',
  seasonMapping,
  dbMinDateStr,
  dbMaxDateStr,
}) {
  const { from, to } = resolveCaneSeasonWindow({ seasonMapping, dbMinDateStr, dbMaxDateStr });
  if (!from || !to) {
    throw new Error('Current season dates are not available yet.');
  }

  const params = { scope, tab: tabId, from, to };
  try {
    const res = await api.get('/bi/cane-performance/export', { params, responseType: 'blob' });
    const filename = scope === 'all'
      ? `cane-performance-season-${from}-to-${to}.xlsx`
      : `cane-performance-${tabId}-${from}-to-${to}.xlsx`;
    saveBlob(res.data, filename);
    return { filename, from, to };
  } catch (err) {
    throw new Error(await blobErrorMessage(err));
  }
}
