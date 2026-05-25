import { useEffect, useRef, useCallback, useState } from 'react';
import { MdClose, MdDownload, MdImage } from 'react-icons/md';
import { DISTILLERY_CHART_PLOTS } from './distilleryBiChartPlots';
import { downloadChartCsv, downloadContainerChartPng } from '../../utils/chartExport';

const MODAL_CHART_HEIGHT = 420;

export default function DistilleryChartExpandModal({
  chartId,
  title,
  definition,
  periodBadge,
  metricsRow,
  data,
  isDarkMode,
  axisStyle,
  gridStyle,
  onClose,
}) {
  const chartPlotRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);
  const plotConfig = chartId ? DISTILLERY_CHART_PLOTS[chartId] : null;
  const Plot = plotConfig?.Plot;

  useEffect(() => {
    if (!chartId) return undefined;
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
  }, [chartId, onClose]);

  useEffect(() => {
    setChartReady(false);
    const frame = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(frame);
  }, [chartId]);

  const handleCsv = useCallback(() => {
    if (!plotConfig || !data?.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadChartCsv(`distillery-${plotConfig.slug}-${stamp}`, data, plotConfig.csvColumns);
  }, [plotConfig, data]);

  const handlePng = useCallback(async () => {
    if (!plotConfig || !chartPlotRef.current) return;
    const stamp = new Date().toISOString().slice(0, 10);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await downloadContainerChartPng(chartPlotRef.current, `distillery-${plotConfig.slug}-${stamp}`, {
      background: isDarkMode ? '#0f172a' : '#ffffff',
    });
  }, [plotConfig, isDarkMode]);

  if (!chartId || !Plot) return null;

  const panel = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const btn = isDarkMode
    ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

  const modalIdPrefix = `-modal-${plotConfig.slug}`;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chart-expand-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close expanded chart"
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel} ${border}`}
      >
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 ${border}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id="chart-expand-title" className="text-lg font-black tracking-tight">
                {title}
              </h2>
              {periodBadge && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {periodBadge}
                </span>
              )}
            </div>
            {definition && (
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {definition}
              </p>
            )}
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

        {metricsRow && <div className={`shrink-0 border-b px-5 py-3 ${border}`}>{metricsRow}</div>}

        <div className="relative min-h-0 flex-1 px-4 py-4 sm:px-5">
          <div
            ref={chartPlotRef}
            className="relative h-[420px] w-full min-h-[420px] min-w-0"
          >
            {chartReady ? (
              <Plot
                data={data}
                isDarkMode={isDarkMode}
                axisStyle={axisStyle}
                gridStyle={gridStyle}
                idPrefix={modalIdPrefix}
                height={MODAL_CHART_HEIGHT}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                Loading chart…
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
