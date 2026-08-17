import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCardToolbar from './ChartCardToolbar';
import BiInfoTooltip from './BiInfoTooltip';
import KpiSparklineTooltip from './KpiSparklineTooltip';
import { formatCompact, formatNum } from '../../utils/powerHouseMeasures';

function parseNumeric(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const n = parseFloat(trimmed.replace(/,/g, '').replace('%', '').replace(/K$/i, ''));
    if (!Number.isFinite(n)) return null;
    if (/K$/i.test(trimmed) && !trimmed.includes('%')) return n * 1000;
    return n;
  }
  return null;
}

/** Percents are already percent — do not treat 0.49 as 49%. */
function formatDisplayValue(value, unit) {
  if (value == null || value === '' || value === '(Blank)') {
    return value === '(Blank)' ? '(Blank)' : '—';
  }
  const n = parseNumeric(value);
  if (n == null) return String(value);
  if (unit === '%') {
    const digits = Math.abs(n) < 10 ? 2 : 1;
    return `${n.toFixed(digits)}%`;
  }
  if (Math.abs(n) >= 1000) return formatCompact(n);
  if (Math.abs(n) >= 100) return formatNum(n, 1);
  return formatNum(n, 2);
}

/** Power BI multi-row card: full number (21051.52) or 111.8%. */
function formatStackedValue(value, unit) {
  if (value == null || value === '' || value === '(Blank)') {
    return value === '(Blank)' ? '(Blank)' : '—';
  }
  const n = parseNumeric(value);
  if (n == null) return String(value);
  if (unit === '%') {
    const digits = Math.abs(n) < 10 ? 2 : 1;
    return `${n.toFixed(digits)}%`;
  }
  return n.toFixed(2);
}

function StackedMetric({ value, label, unit, rightVal, glossary, isDarkMode }) {
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span
        className={`text-[13px] font-black tabular-nums sm:text-sm ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}
      >
        {formatStackedValue(value, unit)}
      </span>
      <div className="flex min-w-0 items-baseline gap-1">
        <span className={`truncate text-[9px] sm:text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
        {glossary && <BiInfoTooltip definition={glossary} isDarkMode={isDarkMode} placement="top" />}
        {rightVal != null && rightVal !== '' && (
          <span className="shrink-0 text-[9px] font-semibold italic tabular-nums text-rose-500 sm:text-[10px]">
            {formatDisplayValue(rightVal, unit)}
          </span>
        )}
      </div>
    </div>
  );
}

function resolveSeriesKeys(kpi) {
  if (Array.isArray(kpi.seriesKeys) && kpi.seriesKeys.length) return kpi.seriesKeys;
  return [{ key: 'value', label: kpi.title, color: kpi.chartColor }];
}

function seriesPalette(kpi, keys) {
  const base = kpi.chartColor || '#6366f1';
  const fallbacks = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];
  return keys.map((s, i) => s.color || fallbacks[i % fallbacks.length] || base);
}

function chartTooltip(isDarkMode, unit, seriesKeys) {
  return (
    <Tooltip
      content={<KpiSparklineTooltip isDarkMode={isDarkMode} unit={unit} seriesKeys={seriesKeys} />}
      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
      wrapperStyle={{ zIndex: 100, outline: 'none' }}
    />
  );
}

function renderKpiChartBody({ chartType, kpi, data, compact, axisStyle, gridStroke }) {
  const keys = resolveSeriesKeys(kpi);
  const colors = seriesPalette(kpi, keys);
  const margin = compact
    ? { top: 4, right: 0, left: 0, bottom: 0 }
    : { top: 12, right: 16, left: 8, bottom: 8 };

  const hiddenAxis = compact ? (
    <>
      <YAxis domain={['dataMin', 'dataMax']} hide />
    </>
  ) : (
    <>
      <XAxis dataKey="date" tick={axisStyle} stroke={gridStroke} tickFormatter={(d) => String(d).slice(5)} />
      <YAxis tick={axisStyle} stroke={gridStroke} width={56} />
      {!compact && keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  if (chartType === 'none') return null;

  if (chartType === 'bar') {
    return (
      <BarChart data={data} margin={margin}>
        {hiddenAxis}
        {chartTooltip(kpi.isDarkMode, kpi.unit, keys)}
        {keys.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={colors[i]}
            radius={compact ? [1, 1, 0, 0] : [3, 3, 0, 0]}
            isAnimationActive={false}
            maxBarSize={compact ? 6 : 28}
          />
        ))}
      </BarChart>
    );
  }

  if (chartType === 'area') {
    const color = colors[0];
    const gradId = `mgmt-grad-${String(color).replace('#', '')}`;
    return (
      <AreaChart data={data} margin={margin}>
        {compact && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {hiddenAxis}
        {chartTooltip(kpi.isDarkMode, kpi.unit, keys)}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={compact ? 2 : 2.5}
          fill={compact ? `url(#${gradId})` : color}
          fillOpacity={compact ? 1 : 0.15}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: compact ? 3 : 5, fill: color, stroke: '#fff', strokeWidth: 1 }}
        />
      </AreaChart>
    );
  }

  if (chartType === 'multiLine') {
    return (
      <LineChart data={data} margin={margin}>
        {hiddenAxis}
        {chartTooltip(kpi.isDarkMode, kpi.unit, keys)}
        {keys.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={colors[i]}
            strokeWidth={compact ? 2 : 2.5}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: compact ? 3 : 5, fill: colors[i], stroke: '#fff', strokeWidth: 1 }}
          />
        ))}
      </LineChart>
    );
  }

  const color = colors[0];
  return (
    <LineChart data={data} margin={margin}>
      {hiddenAxis}
      {chartTooltip(kpi.isDarkMode, kpi.unit, keys)}
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={compact ? 2 : 2.5}
        dot={false}
        isAnimationActive={false}
        activeDot={{ r: compact ? 3 : 5, fill: color, stroke: '#fff', strokeWidth: 1 }}
      />
    </LineChart>
  );
}

function Sparkline({ kpi, data, isDarkMode }) {
  const chartType = kpi.chart || 'line';
  if (chartType === 'none') return null;

  if (!data?.length) {
    return (
      <div
        className={`h-8 w-full rounded sm:h-9 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100'}`}
      />
    );
  }

  return (
    <div className="relative h-8 min-h-0 w-full min-w-0 flex-1 opacity-90 sm:h-9">
      <ResponsiveContainer width="100%" height="100%">
        {renderKpiChartBody({
          chartType,
          kpi: { ...kpi, isDarkMode },
          data,
          compact: true,
        })}
      </ResponsiveContainer>
    </div>
  );
}

/** Single Management Dashboard KPI cell — value + sub-metrics + sparkline + expand. */
export default function ManagementKpiCell({ kpi, isDarkMode, onExpand, filteredSeries }) {
  const series = filteredSeries ?? kpi.series ?? [];
  const chartType = kpi.chart || 'line';
  const hasChart = chartType !== 'none';
  const glossary = kpi.glossary || kpi.definition;
  const subValues = Array.isArray(kpi.subValues) ? kpi.subValues : [];
  const primaryValue = kpi.rawValue ?? kpi.value;

  const cellBg = isDarkMode
    ? 'border-slate-700 bg-slate-800 shadow-slate-900/40 hover:shadow-md'
    : 'border-slate-200 bg-white shadow-sm hover:shadow-md';

  const isStacked = subValues.length > 0;

  return (
    <div
      className={`group relative flex h-full min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-xl border p-1.5 transition-shadow sm:rounded-2xl sm:p-2 ${cellBg}`}
    >
      {!isStacked && (
        <div className="mb-0.5 flex items-start justify-between gap-0.5">
          <div className="flex min-w-0 flex-1 items-start">
            <h4
              className={`line-clamp-2 text-[8px] font-bold leading-tight sm:text-[9px] ${
                isDarkMode ? 'text-slate-300' : 'text-slate-500'
              }`}
              title={kpi.title}
            >
              {kpi.title}
            </h4>
            <BiInfoTooltip definition={glossary} isDarkMode={isDarkMode} placement="top" />
          </div>
          {hasChart && (
            <ChartCardToolbar onExpand={() => onExpand(kpi)} isDarkMode={isDarkMode} compact />
          )}
        </div>
      )}

      {isStacked ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
          <StackedMetric
            value={primaryValue}
            label={kpi.title}
            unit={kpi.unit}
            rightVal={kpi.rightVal}
            glossary={glossary}
            isDarkMode={isDarkMode}
          />
          {subValues.map((sub) => (
            <StackedMetric
              key={sub.label}
              value={sub.value}
              label={sub.label}
              unit={sub.unit || kpi.unit}
              rightVal={sub.rightVal}
              glossary={sub.glossary}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-start">
          <span
            className={`text-base font-black tabular-nums leading-none sm:text-lg ${
              isDarkMode ? 'text-white' : 'text-slate-800'
            }`}
          >
            {formatDisplayValue(primaryValue, kpi.unit)}
          </span>
        </div>
      )}

      {hasChart && (
        <div className="mt-auto flex min-h-[32px] pt-0.5">
          <Sparkline kpi={kpi} data={series} isDarkMode={isDarkMode} />
        </div>
      )}
    </div>
  );
}

/** Full-size chart for expand modal. */
export function ManagementKpiExpandedChart({
  kpi,
  data,
  isDarkMode,
  height = 400,
  chartRef,
}) {
  const chartType = kpi?.chart || 'line';
  const axisStyle = {
    fontSize: 11,
    fill: isDarkMode ? '#94a3b8' : '#64748b',
  };
  const gridStroke = isDarkMode ? '#334155' : '#e2e8f0';

  if (chartType === 'none') {
    return (
      <div
        ref={chartRef}
        className="flex h-full items-center justify-center text-sm font-semibold text-slate-400"
      >
        No trend chart in Power BI for this cell
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div
        ref={chartRef}
        className="flex h-full items-center justify-center text-sm font-semibold text-slate-400"
      >
        No data for selected period
      </div>
    );
  }

  return (
    <div ref={chartRef} style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderKpiChartBody({
          chartType,
          kpi: { ...kpi, isDarkMode },
          data,
          compact: false,
          axisStyle,
          gridStroke,
        })}
      </ResponsiveContainer>
    </div>
  );
}
