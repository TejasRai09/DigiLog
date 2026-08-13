import { createPortal } from 'react-dom';
import { useRef, useState, useCallback, useEffect } from 'react';
import { MdInfoOutline, MdRemove, MdTrendingDown, MdTrendingUp } from 'react-icons/md';
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';

const FLOATING_LAYER_Z = 9999;

/** Portable anchor-position tracker for portaled overlays. */
function useAnchorPosition(anchorRef, active) {
  const [position, setPosition] = useState(null);
  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      centerX: rect.left + rect.width / 2,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!active) { setPosition(null); return; }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, update]);

  return position;
}

const KpiInfoTooltip = ({ definition, isDarkMode, placement = 'top' }) => {
  const anchorRef = useRef(null);
  const [active, setActive] = useState(false);
  const pos = useAnchorPosition(anchorRef, active);

  const tooltip =
    active &&
    pos &&
    createPortal(
      <div
        role="tooltip"
        className={`pointer-events-none fixed w-64 rounded-lg p-3 text-center text-[11px] font-normal leading-relaxed text-white shadow-xl ${
          isDarkMode ? 'bg-slate-700' : 'bg-slate-800'
        }`}
        style={{
          zIndex: FLOATING_LAYER_Z,
          ...(placement === 'bottom'
            ? { top: pos.bottom + 8, left: pos.centerX, transform: 'translateX(-50%)' }
            : { top: pos.top - 8, left: pos.centerX, transform: 'translate(-50%, -100%)' }),
        }}
      >
        {definition}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ml-2 inline-flex shrink-0 cursor-help items-center rounded p-0.5 text-slate-400 transition-colors hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="More information"
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
      >
        <MdInfoOutline className="h-3.5 w-3.5" />
      </button>
      {tooltip}
    </>
  );
};

const KpiSparklineTooltip = ({ active, payload, isDarkMode, unit }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const v = Number(payload[0].value);
  if (!Number.isFinite(v)) return null;
  const dateLabel = row.dateFull || row.date || row.dateIso || '';
  const valueLabel =
    unit === '%'
      ? `${v.toFixed(2)}%`
      : `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit || ''}`;

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-lg ${
        isDarkMode ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      <div className={`mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dateLabel}</div>
      <div className="tabular-nums">{valueLabel}</div>
    </div>
  );
};

/**
 * Shared KPI card — matches the DistilleryAnalyticsDashboard MetricCard design.
 *
 * Props:
 *   title        – card heading (string)
 *   value        – current numeric value
 *   pyValue      – prior-period numeric value (for delta %)
 *   unit         – unit label string (e.g. 'BL', 'Q', '%')
 *   definition   – tooltip text
 *   timeFilter   – period label, e.g. 'MTD', 'YTD', 'Custom'
 *   comparisonLabel – e.g. 'Prev. Month (Apr 1 – Apr 10)'
 *   inverseColor – true when lower is better (red/green inverted)
 *   isDarkMode   – boolean
 *   chartData    – array of row objects for sparkline
 *   dataKey      – key on chartData rows to plot
 *   chartType    – 'area' | 'line'
 *   chartColor   – hex color for sparkline stroke
 *   formatValue  – optional custom formatter (number) => string
 */
const BiKpiCard = ({
  title,
  value,
  pyValue = 0,
  unit = '',
  definition = '',
  timeFilter = '',
  comparisonLabel = '',
  inverseColor = false,
  isDarkMode = false,
  chartData,
  dataKey,
  chartType = 'line',
  chartColor = '#3b82f6',
  formatValue,
  displayValue,
}) => {
  const safeVal = Number.isFinite(Number(value)) ? Number(value) : 0;
  const safePy = Number.isFinite(Number(pyValue)) ? Number(pyValue) : 0;
  const delta = safePy !== 0 ? ((safeVal - safePy) / Math.abs(safePy)) * 100 : 0;
  const isPositive = delta > 0;
  const isNeutral = Math.abs(delta) < 0.005;
  const isGood = inverseColor ? !isPositive : isPositive;

  const cardClasses = isDarkMode
    ? 'border-slate-700 bg-slate-800 shadow-slate-900/50'
    : 'border-slate-200 bg-white shadow-sm';

  const textClasses = isDarkMode
    ? { title: 'text-slate-400', value: 'text-slate-100', unit: 'text-slate-500', vs: 'text-slate-500' }
    : { title: 'text-slate-500', value: 'text-slate-800', unit: 'text-slate-500', vs: 'text-slate-400' };

  const fmt =
    formatValue ||
    ((v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    
  const renderedValue = displayValue !== undefined ? displayValue : fmt(safeVal);

  const hasChart = chartData && chartData.length > 0 && dataKey;

  return (
    <div
      className={`relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-shadow hover:shadow-md sm:overflow-visible ${cardClasses}`}
    >
      <div className="mb-2 flex min-w-0 items-start justify-between overflow-visible">
        <div className={`flex min-w-0 items-center text-xs font-bold ${textClasses.title}`}>
          {title}
          {definition && (
            <KpiInfoTooltip definition={definition} isDarkMode={isDarkMode} placement="top" />
          )}
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="z-10 min-w-0 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${textClasses.value}`}>{renderedValue}</span>
            {unit && <span className={`text-[10px] font-bold ${textClasses.unit}`}>{unit}</span>}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <div
              className={`inline-flex min-w-[76px] items-center justify-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                isNeutral
                  ? isDarkMode
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-slate-100 text-slate-600'
                  : isGood
                    ? isDarkMode
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-700'
                    : isDarkMode
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-rose-100 text-rose-700'
              }`}
            >
              {isNeutral ? (
                <MdRemove className="h-3 w-3" />
              ) : isPositive ? (
                <MdTrendingUp className="h-3 w-3" />
              ) : (
                <MdTrendingDown className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </div>
            <span className={`text-[10px] font-bold sm:whitespace-nowrap ${textClasses.vs}`}>
              vs {comparisonLabel} {timeFilter}
            </span>
          </div>
        </div>

        {hasChart && (
          <div className="relative h-14 w-full min-w-0 opacity-90 sm:-mb-2 sm:-mr-1 sm:ml-4 sm:h-16 sm:max-w-[55%] sm:flex-1 sm:min-w-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`bikpi-grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip
                    content={<KpiSparklineTooltip isDarkMode={isDarkMode} unit={unit} />}
                    cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                    wrapperStyle={{ zIndex: 100, outline: 'none' }}
                  />
                  <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    fill={`url(#bikpi-grad-${dataKey})`}
                    isAnimationActive={false}
                    dot={{ r: 2.5, fill: chartColor, strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: chartColor, stroke: '#fff', strokeWidth: 1 }}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                  <Tooltip
                    content={<KpiSparklineTooltip isDarkMode={isDarkMode} unit={unit} />}
                    cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                    wrapperStyle={{ zIndex: 100, outline: 'none' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: chartColor, strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: chartColor, stroke: '#fff', strokeWidth: 1 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default BiKpiCard;
