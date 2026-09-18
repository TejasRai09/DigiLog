import { useCallback, useEffect, useRef, useState } from 'react';
import { MdClose, MdDownload, MdImage } from 'react-icons/md';
import { downloadChartCsv, downloadContainerChartPng, inferCsvColumns, slugifyChartTitle } from '../../utils/chartExport';
import { trackChartDownloadCsv } from '../../utils/trackActivity';

/**
 * Generic expand modal for BI charts (same actions as Distillery).
 *
 * config: {
 *   title, definition, data, csvColumns, plot,
 *   filePrefix, dashboardLabel, chartId
 * }
 */
export default function BiChartExpandModal({ config, isDarkMode = false, onClose }) {
  const chartRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);
  const title = config?.title || '';

  useEffect(() => {
    if (!config) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [config, onClose]);

  useEffect(() => {
    setChartReady(false);
    const id = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(id);
  }, [title]);

  const slug = slugifyChartTitle(config?.chartId || title);
  const prefix = config?.filePrefix || 'chart';

  const handleCsv = useCallback(() => {
    if (!config) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = config.data || [];
    const columns = config.csvColumns?.length ? config.csvColumns : inferCsvColumns(rows);
    if (!columns.length) return;
    downloadChartCsv(`${prefix}-${slug}-${stamp}`, rows, columns);
    trackChartDownloadCsv({
      dashboardLabel: config.dashboardLabel || prefix,
      chartId: slug,
      chartTitle: title,
    });
  }, [config, prefix, slug, title]);

  const handlePng = useCallback(async () => {
    if (!chartRef.current) return;
    await new Promise((r) => requestAnimationFrame(r));
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadContainerChartPng(chartRef.current, `${prefix}-${slug}-${stamp}`, {
      background: isDarkMode ? '#0f172a' : '#ffffff',
    });
  }, [isDarkMode, prefix, slug]);

  if (!config?.title) return null;

  const panel = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const btn = isDarkMode
    ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
  const hasData = Array.isArray(config.data) ? config.data.length > 0 : true;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bi-chart-expand-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close expanded chart"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[min(92vh,900px)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-6xl sm:rounded-2xl ${panel} ${border}`}
      >
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 ${border}`}>
          <div className="min-w-0 flex-1">
            <h2 id="bi-chart-expand-title" className="text-lg font-black tracking-tight">
              {title}
            </h2>
            {config.definition ? (
              <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {config.definition}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCsv}
              className={`rounded-lg border p-2 transition-colors ${btn}`}
              title="Download CSV"
              aria-label="Download chart data as CSV"
            >
              <MdDownload className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handlePng}
              className={`rounded-lg border p-2 transition-colors ${btn}`}
              title="Download PNG"
              aria-label="Download chart as PNG"
            >
              <MdImage className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full border p-2 transition-colors ${btn}`}
              title="Close"
              aria-label="Close"
            >
              <MdClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 px-4 py-5 sm:px-6">
          <div ref={chartRef} className="h-[420px] w-full">
            {chartReady && hasData ? (
              config.plot
            ) : (
              <div
                className={`flex h-full items-center justify-center rounded-xl border border-dashed text-sm font-semibold ${
                  isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'
                }`}
              >
                {chartReady ? 'No data available' : 'Loading chart…'}
              </div>
            )}
          </div>
        </div>

        <p
          className={`shrink-0 border-t px-5 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest ${
            isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'
          }`}
        >
          Press Esc to close
        </p>
      </div>
    </div>
  );
}
