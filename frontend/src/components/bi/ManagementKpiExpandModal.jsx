import { useCallback, useEffect, useRef } from 'react';
import { MdClose, MdDownload, MdImage } from 'react-icons/md';
import { downloadChartCsv, downloadContainerChartPng } from '../../utils/chartExport';
import { ManagementKpiExpandedChart } from './ManagementKpiCell';
import { formatCompact, formatNum } from '../../utils/powerHouseMeasures';

const MODAL_CHART_HEIGHT = 420;

function formatMetric(v, unit) {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (Math.abs(n) >= 1000) return formatCompact(n);
  return formatNum(n, 2);
}

export default function ManagementKpiExpandModal({
  kpi,
  series,
  periodLabel,
  isDarkMode,
  onClose,
}) {
  const chartPlotRef = useRef(null);

  useEffect(() => {
    if (!kpi) return undefined;
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
  }, [kpi, onClose]);

  const handleCsv = useCallback(() => {
    if (!series?.length || !kpi) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const columns = [{ key: 'date', label: 'Date' }];
    if (Array.isArray(kpi.seriesKeys) && kpi.seriesKeys.length) {
      kpi.seriesKeys.forEach((s) => columns.push({ key: s.key, label: s.label }));
    } else {
      columns.push({ key: 'value', label: kpi.title });
    }
    downloadChartCsv(`management-${kpi.id}-${stamp}`, series, columns);
  }, [series, kpi]);

  const handlePng = useCallback(async () => {
    if (!chartPlotRef.current) return;
    const stamp = new Date().toISOString().slice(0, 10);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await downloadContainerChartPng(chartPlotRef.current, `management-${kpi?.id}-${stamp}`, {
      background: isDarkMode ? '#0f172a' : '#ffffff',
    });
  }, [kpi, isDarkMode]);

  if (!kpi) return null;

  const panel = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const btn = isDarkMode
    ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

  const definition = kpi.glossary || kpi.definition;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mgmt-kpi-expand-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close expanded chart"
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[min(92vh,900px)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-5xl sm:rounded-2xl ${panel} ${border}`}
      >
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 ${border}`}>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id="mgmt-kpi-expand-title" className="text-lg font-black tracking-tight">
                {kpi.title}
              </h2>
              {periodLabel && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {periodLabel}
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  isDarkMode ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                {kpi.sourceTable}
              </span>
            </div>
            {definition && (
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {definition}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={handleCsv} className={`rounded-lg border p-2 transition-colors ${btn}`} title="Download CSV" aria-label="Download CSV">
              <MdDownload className="h-5 w-5" />
            </button>
            <button type="button" onClick={handlePng} className={`rounded-lg border p-2 transition-colors ${btn}`} title="Download PNG" aria-label="Download PNG">
              <MdImage className="h-5 w-5" />
            </button>
            <button type="button" onClick={onClose} className={`rounded-full border p-2 transition-colors ${btn}`} title="Close" aria-label="Close">
              <MdClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`shrink-0 border-b px-5 py-3 ${border}`}>
          <div className="flex flex-wrap items-baseline gap-4">
            <div>
              <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Period value
              </span>
              <p className={`text-2xl font-black tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {formatMetric(kpi.value, kpi.unit)}
                {kpi.unit && kpi.unit !== '%' && (
                  <span className={`ml-1 text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {kpi.unit}
                  </span>
                )}
              </p>
            </div>
            {kpi.rightVal != null && kpi.rightVal !== '' && (
              <div>
                <span className="text-[10px] font-bold uppercase text-red-400">7DMA</span>
                <p className="text-lg font-black tabular-nums text-red-500">{formatMetric(kpi.rightVal, kpi.unit)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 px-4 py-4 sm:px-5">
          <ManagementKpiExpandedChart
            kpi={kpi}
            data={series}
            isDarkMode={isDarkMode}
            height={MODAL_CHART_HEIGHT}
            chartRef={chartPlotRef}
          />
        </div>

        <p
          className={`shrink-0 border-t px-5 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest ${
            isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'
          }`}
        >
          Press Esc to close · Hover chart for daily values
        </p>
      </div>
    </div>
  );
}
