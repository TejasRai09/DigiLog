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
import { MdRemove, MdTrendingDown, MdTrendingUp } from 'react-icons/md';
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

function StackedMetric({
  value,
  label,
  unit,
  rightVal,
  glossary,
  isDarkMode,
  dense = false,
  compareVal = null,
  inverseGood = false,
  compareLabel,
}) {
  if (dense) {
    return (
      <div className="flex min-h-0 min-w-0 items-center gap-1 leading-none">
        <span
          className={`shrink-0 font-black tabular-nums text-[10px] sm:text-[11px] ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          {formatStackedValue(value, unit)}
        </span>
        {rightVal != null && rightVal !== '' && (
          <span
            className="shrink-0 text-[8px] font-semibold italic tabular-nums text-rose-500"
            title="7-day moving average"
          >
            {formatDisplayValue(rightVal, unit)}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-[8px] sm:text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
          title={label}
        >
          {label}
        </span>
        {glossary && <BiInfoTooltip definition={glossary} isDarkMode={isDarkMode} placement="top" />}
        {compareVal != null && (
          <CompareChip
            pct={compareVal}
            inverseGood={inverseGood}
            isDarkMode={isDarkMode}
            compact
            label={compareLabel}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
      <div className="flex min-w-0 items-center justify-between gap-0.5">
        <span
          className={`min-w-0 truncate text-[11px] font-black tabular-nums sm:text-xs ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          {formatStackedValue(value, unit)}
        </span>
        {rightVal != null && rightVal !== '' && (
          <span
            className="shrink-0 text-[9px] font-semibold italic tabular-nums text-rose-500 sm:text-[10px]"
            title="7-day moving average"
          >
            {formatDisplayValue(rightVal, unit)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className={`min-w-0 truncate text-[9px] sm:text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
        {glossary && <BiInfoTooltip definition={glossary} isDarkMode={isDarkMode} placement="top" />}
        {compareVal != null && (
          <CompareChip
            pct={compareVal}
            inverseGood={inverseGood}
            isDarkMode={isDarkMode}
            compact
            label={compareLabel}
          />
        )}
      </div>
    </div>
  );
}

function resolveSeriesKeys(kpi, data) {
  if (Array.isArray(kpi.seriesKeys) && kpi.seriesKeys.length) {
    const sample = (data || kpi.series || []).find((p) => p);
    const keysPresent = sample
      ? kpi.seriesKeys.filter((s) => sample[s.key] != null)
      : kpi.seriesKeys;
    if (keysPresent.length) return keysPresent;
  }
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
      wrapperStyle={{ display: 'none' }}
      allowEscapeViewBox={{ x: true, y: true }}
      isAnimationActive={false}
      shared
    />
  );
}

function renderKpiChartBody({ chartType, kpi, data, compact, axisStyle, gridStroke }) {
  const keys = resolveSeriesKeys(kpi, data);
  const colors = seriesPalette(kpi, keys);
  const margin = compact
    ? { top: 6, right: 2, left: 2, bottom: 2 }
    : { top: 12, right: 16, left: 8, bottom: 8 };
  const yDomain = chartType === 'bar' ? [0, 'auto'] : ['dataMin', 'dataMax'];

  const hiddenAxis = compact ? (
    <>
      <YAxis domain={yDomain} hide />
    </>
  ) : (
    <>
      <XAxis dataKey="date" tick={axisStyle} stroke={gridStroke} tickFormatter={(d) => String(d).slice(5)} />
      <YAxis domain={chartType === 'bar' ? [0, 'auto'] : ['auto', 'auto']} tick={axisStyle} stroke={gridStroke} width={56} />
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
            stackId={keys.length > 1 ? 'kpi' : undefined}
            radius={i === keys.length - 1 ? (compact ? [1, 1, 0, 0] : [3, 3, 0, 0]) : [0, 0, 0, 0]}
            isAnimationActive={false}
            maxBarSize={compact ? 8 : 28}
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
        className={`h-full min-h-[28px] w-full rounded ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100'}`}
      />
    );
  }

  return (
    <div className="relative h-full min-h-[28px] w-full min-w-0 overflow-visible opacity-90">
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

/** Distillery-style delta chip + "vs <label>" — only as wide as content. */
function CompareChip({ pct, inverseGood, isDarkMode, label, compact = false }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const isPositive = pct > 0;
  const isNeutral = Math.abs(pct) < 0.05;
  const isGood = isNeutral ? true : inverseGood ? !isPositive : isPositive;

  const chipCls = isNeutral
    ? isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
    : isGood
      ? isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
      : isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700';

  const labelCls = isDarkMode ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={`${compact ? '' : 'mt-0.5'} flex min-w-0 shrink-0 items-center gap-0.5 ${compact ? 'flex-nowrap' : 'flex-wrap'}`}>
      <span
        className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 ${compact ? 'text-[7px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'} font-bold tabular-nums leading-none ${chipCls}`}
        title={label ? `vs ${label}` : 'vs prior period'}
      >
        {isNeutral
          ? <MdRemove className={compact ? 'h-2.5 w-2.5' : 'h-2.5 w-2.5'} />
          : isPositive
            ? <MdTrendingUp className={compact ? 'h-2.5 w-2.5' : 'h-2.5 w-2.5'} />
            : <MdTrendingDown className={compact ? 'h-2.5 w-2.5' : 'h-2.5 w-2.5'} />}
        {Math.abs(pct).toFixed(1)}%
      </span>
      {label && !compact && (
        <span
          className={`truncate ${compact ? 'text-[7px] sm:text-[8px]' : 'text-[7px] sm:text-[8px]'} font-semibold leading-none ${labelCls}`}
          title={`vs ${label}`}
        >
          vs {label}
        </span>
      )}
    </div>
  );
}

/** Single Management Dashboard KPI cell — value + sub-metrics + sparkline + expand. */
export default function ManagementKpiCell({ kpi, isDarkMode, onExpand, filteredSeries, showCompare, compareLabel }) {
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
  const compactStacked = subValues.length >= 2;

  return (
    <div
      className={`group relative flex h-full min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border p-1 transition-shadow sm:rounded-xl sm:p-1.5 ${cellBg}`}
    >
      {!isStacked && (
        <div className="mb-0.5 flex items-start justify-between gap-0.5">
          <div className="flex min-w-0 flex-1 items-start">
            <h4
              className={`line-clamp-2 text-[7px] font-bold leading-tight sm:text-[8px] ${
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
        <div
          className={`flex min-h-0 flex-col overflow-hidden ${
            hasChart ? 'shrink-0' : 'flex-1'
          } ${compactStacked ? 'justify-evenly gap-0.5' : 'justify-center gap-1'}`}
        >
          <StackedMetric
            value={primaryValue}
            label={kpi.stackedLabel || kpi.title}
            unit={kpi.unit}
            rightVal={kpi.rightVal}
            glossary={glossary}
            isDarkMode={isDarkMode}
            dense={compactStacked}
            compareVal={showCompare ? kpi.compareVal : null}
            inverseGood={kpi.inverseGood}
            compareLabel={compareLabel}
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
              dense={compactStacked}
              compareVal={showCompare ? sub.compareVal : null}
              inverseGood={kpi.inverseGood}
              compareLabel={compareLabel}
            />
          ))}
        </div>
      ) : (
        <div className={`flex flex-col gap-0.5 ${hasChart ? 'shrink-0' : 'min-h-0 flex-1 overflow-hidden'}`}>
          <div className="flex shrink-0 items-start justify-between gap-0.5">
            <span
              className={`min-w-0 truncate text-sm font-black tabular-nums leading-none sm:text-base ${
                isDarkMode ? 'text-white' : 'text-slate-800'
              }`}
            >
              {formatDisplayValue(primaryValue, kpi.unit)}
            </span>
            {kpi.rightVal != null && kpi.rightVal !== '' && (
              <span
                className="shrink-0 text-[9px] font-semibold italic tabular-nums leading-none text-rose-500 sm:text-[10px]"
                title="7-day moving average"
              >
                {formatDisplayValue(kpi.rightVal, kpi.unit)}
              </span>
            )}
          </div>
          {showCompare && (
            <div className="shrink-0">
              <CompareChip
                pct={kpi.compareVal}
                inverseGood={kpi.inverseGood}
                isDarkMode={isDarkMode}
                compact={hasChart}
                label={compareLabel}
              />
            </div>
          )}
        </div>
      )}

      {hasChart && (
        <div className="mt-0.5 flex min-h-[28px] min-w-0 flex-1 overflow-visible sm:min-h-[36px]">
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
