import { useCallback, useEffect, useRef, useState } from 'react';
import { MdClose, MdDownload, MdImage } from 'react-icons/md';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { downloadChartCsv, downloadContainerChartPng } from '../../utils/chartExport';
import MillPairedChartTooltip, { MILL_CHART_TOOLTIP_PROPS, MillTooltipAnchor } from './MillPairedChartTooltip';

function ExpandChartTooltip({ lines, ...props }) {
  return <MillPairedChartTooltip {...props} lines={lines} valueFormat="plain" />;
}

/**
 * Generic chart-expand modal for Milling dashboards.
 *
 * Props:
 *   title       – card title shown in the modal header
 *   lines       – [{ variable, label, color }]  — Recharts Line descriptors
 *   chartData   – array of data points already built for the chart
 *   isDarkMode  – boolean
 *   axisStyle   – Recharts tick style object
 *   gridStyle   – CartesianGrid stroke props
 *   onClose     – () => void
 */
export default function MillChartExpandModal({
  title,
  lines,
  chartData,
  isDarkMode,
  axisStyle,
  gridStyle,
  onClose,
}) {
  const chartRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);

  /* Keyboard close + body scroll lock */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /* Give Recharts one frame to paint before allowing PNG export */
  useEffect(() => {
    setChartReady(false);
    const id = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(id);
  }, [title]);

  /* ── CSV: date column + one column per line ── */
  const handleCsv = useCallback(() => {
    if (!chartData?.length || !lines?.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const columns = [
      { key: 'label', label: 'Date' },
      ...lines.map((l) => ({ key: l.variable, label: l.label })),
    ];
    downloadChartCsv(`milling-${slug}-${stamp}`, chartData, columns);
  }, [chartData, lines, title]);

  /* ── PNG ── */
  const handlePng = useCallback(async () => {
    if (!chartRef.current) return;
    await new Promise((r) => requestAnimationFrame(r));
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await downloadContainerChartPng(chartRef.current, `milling-${slug}-${stamp}`, {
      background: isDarkMode ? '#0f172a' : '#ffffff',
    });
  }, [isDarkMode, title]);

  /* ── Shared styles ── */
  const panel = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const btn = isDarkMode
    ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

  if (!title) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mill-chart-expand-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close expanded chart"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative flex max-h-[min(92vh,900px)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-6xl sm:rounded-2xl ${panel} ${border}`}
      >
        {/* Header */}
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 ${border}`}>
          <h2 id="mill-chart-expand-title" className="text-lg font-black tracking-tight">
            {title}
          </h2>

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

        {/* Chart body */}
        <div className="relative min-h-0 flex-1 px-4 py-5 sm:px-6">
          <MillTooltipAnchor className="h-[420px] w-full">
            <div ref={chartRef} className="h-full w-full">
            {chartReady && chartData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} {...gridStyle} />
                  <XAxis
                    dataKey="label"
                    tick={{ ...axisStyle, fontSize: 10 }}
                    stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ ...axisStyle, fontSize: 10 }}
                    stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                  />
                  <Tooltip
                    {...MILL_CHART_TOOLTIP_PROPS}
                    content={(props) => (
                      <ExpandChartTooltip {...props} lines={lines} isDarkMode={isDarkMode} />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} iconType="circle" />
                  {lines.map((l) => (
                    <Line
                      key={l.variable}
                      type="monotone"
                      dataKey={l.variable}
                      name={l.label}
                      stroke={l.color}
                      strokeDasharray={l.dashed ? '5 4' : undefined}
                      strokeOpacity={l.dashed ? 0.65 : 1}
                      strokeWidth={l.dashed ? 1.5 : 2.5}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
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
          </MillTooltipAnchor>
        </div>

        {/* Footer */}
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
