import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  MdInfoOutline,
  MdCalendarMonth,
  MdTrendingUp,
  MdTrendingDown,
  MdRemove,
  MdDarkMode,
  MdLightMode,
  MdFilterList,
  MdExpandMore,
  MdArrowBack,
  MdScience,
} from 'react-icons/md';
import { ResponsiveContainer, LineChart, AreaChart, Line, Area, YAxis, Tooltip } from 'recharts';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import {
  formatDMYShort,
  resolveDashboardToDate,
  getSeasonComparisonLabels,
  isSeasonComparisonType,
  alignSeasonCompareRange,
  seasonLabelForComparisonType,
} from '../../utils/distilleryBiDateRange';
import {
  applyCockpitCompareSelection,
  buildCockpitComparisonOptions,
  ensureCompareSelectionValid,
  resolveCockpitCompareRange,
  resolveCockpitPriorRange,
  resolveSeasonLabelFromCompareId,
} from '../../utils/biCockpitDateFilters';
import {
  YEAR_TYPE_OPTIONS,
  DEFAULT_YEAR_TYPE,
  DEFAULT_CHILD_PRESET,
  defaultChildPresetForYearType,
  childPresetsForYearType,
  getPresetDateRangeForYearType,
  getDistilleryPPLabel,
  resolveActiveYearMapping,
  cockpitRangePresetForCompare,
  isValidChildPreset,
} from '../../utils/biYearTypes';
import {
  aggregateKpisFromRows,
  averageNonBlank,
  filterSeasonCompareRowsBySeason,
} from '../../utils/distilleryBiComparison';
import DistilleryChartsGrid from '../../components/bi/DistilleryChartsGrid';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiKeyMetricBox, BiFilterBarLayout } from '../../components/bi/BiLayoutElements';

const FLOATING_LAYER_Z = 9999;
const FLOATING_BACKDROP_Z = 9998;

/** Track anchor position for portaled overlays (escapes parent z-index / overflow). */
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
    if (!active) {
      setPosition(null);
      return;
    }
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

const InfoTooltip = ({ definition, isDarkMode, placement = 'top' }) => {
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

function OpModeFilter({
  isOpen,
  onToggle,
  onClose,
  availableModes,
  selectedModes,
  toggleMode,
  isDarkMode,
  cardClasses,
  textClasses,
  modeLabelHover,
}) {
  const btnRef = useRef(null);
  const pos = useAnchorPosition(btnRef, isOpen);
  const panelWidth = 192;

  const panel =
    isOpen &&
    pos &&
    createPortal(
      <>
        <button
          type="button"
          aria-label="Close operation mode menu"
          className="fixed inset-0 cursor-default bg-transparent"
          style={{ zIndex: FLOATING_BACKDROP_Z }}
          onClick={onClose}
        />
        <div
          className={`fixed w-48 rounded-xl border p-2 shadow-xl ${
            isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
          }`}
          style={{
            zIndex: FLOATING_LAYER_Z,
            top: pos.bottom + 8,
            left: Math.max(8, Math.min(pos.right - panelWidth, window.innerWidth - panelWidth - 8)),
          }}
        >
          <div
            className={`mb-2 border-b px-2 pb-2 text-[10px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'
            }`}
          >
            Filter by Mode
          </div>
          {availableModes.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors ${modeLabelHover}`}
            >
              <input
                type="checkbox"
                checked={selectedModes.includes(m)}
                onChange={() => toggleMode(m)}
                className={`h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${
                  isDarkMode ? 'border-slate-600 bg-slate-900' : ''
                }`}
              />
              <span className={`text-sm font-semibold ${textClasses.title}`}>{m}</span>
            </label>
          ))}
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border p-1.5 px-2 text-[10px] font-bold transition-colors sm:gap-2 sm:px-3 sm:text-xs ${cardClasses} ${textClasses.muted} ${
          isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
        }`}
      >
        <MdFilterList className="h-3.5 w-3.5" />
        Op Mode ({selectedModes.length === availableModes.length ? 'All' : selectedModes.length})
        <MdExpandMore className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {panel}
    </>
  );
};

const KpiSparklineTooltip = ({ active, payload, isDarkMode, unit }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const v = Number(payload[0].value);
  if (!Number.isFinite(v)) return null;
  const dateLabel = row.dateFull || row.date || '';
  const valueLabel =
    unit === '%'
      ? `${v.toFixed(2)}%`
      : `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;

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

const MetricCard = ({
  title,
  value,
  pyValue,
  unit,
  definition,
  timeFilter,
  inverseColor = false,
  isDarkMode,
  comparisonLabel,
  chartData,
  dataKey,
  chartType = 'line',
  chartColor = '#3b82f6',
}) => {
  const delta = pyValue !== 0 ? ((value - pyValue) / pyValue) * 100 : 0;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const isGood = inverseColor ? !isPositive : isPositive;

  const cardClasses = isDarkMode
    ? 'border-slate-700 bg-slate-800 shadow-slate-900/50'
    : 'border-slate-200 bg-white shadow-sm';

  const textClasses = isDarkMode
    ? { title: 'text-slate-400', value: 'text-slate-100', unit: 'text-slate-500', vs: 'text-slate-500' }
    : { title: 'text-slate-500', value: 'text-slate-800', unit: 'text-slate-500', vs: 'text-slate-400' };

  return (
    <div
      className={`relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-shadow hover:shadow-md sm:overflow-visible ${cardClasses}`}
    >
      <div className="mb-2 flex min-w-0 items-start justify-between overflow-visible">
        <div className={`flex min-w-0 items-center text-xs font-bold ${textClasses.title}`}>
          {title}
          <InfoTooltip definition={definition} isDarkMode={isDarkMode} placement="top" />
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="z-10 min-w-0 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${textClasses.value}`}>
              {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-bold ${textClasses.unit}`}>{unit}</span>
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

        {chartData && chartData.length > 0 && (
          <div className="relative h-14 w-full min-w-0 opacity-90 sm:-mb-2 sm:-mr-1 sm:ml-4 sm:h-16 sm:max-w-[55%] sm:flex-1 sm:min-w-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
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
                    fill={`url(#gradient-${dataKey})`}
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

const CustomTooltip = ({ active, payload, label, isDarkMode }) => {
  if (active && payload && payload.length) {
    const fmt = (v, name) => {
      if (typeof v !== 'number') return String(v);
      const suffix = name.includes('%') || name.includes('Eff') ? '%' : '';
      const body = v > 1000 ? v.toLocaleString() : v.toFixed(2);
      return `${body}${suffix}`;
    };
    return (
      <div
        className={`rounded-xl border p-3 text-xs font-bold shadow-xl backdrop-blur-sm ${
          isDarkMode ? 'border-slate-700 bg-slate-800/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-700'
        }`}
      >
        <p
          className={`mb-2 border-b pb-2 ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}
        >
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{entry.name}:</span>
              </div>
              <span className="font-mono">{fmt(entry.value, entry.name)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const ChartTitle = ({
  title,
  definition,
  dataKey,
  data,
  pyData,
  timeFilter,
  higherIsBetter = true,
  isDarkMode,
  comparisonLabel,
}) => {
  if (!data || data.length === 0) return null;

  const currentAvg = data.reduce((sum, item) => sum + item[dataKey], 0) / data.length;
  const pyAvg =
    pyData?.length > 0 ? pyData.reduce((sum, item) => sum + item[dataKey], 0) / pyData.length : 0;

  const delta = pyAvg !== 0 ? ((currentAvg - pyAvg) / pyAvg) * 100 : 0;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;

  const textClasses = isDarkMode
    ? { title: 'text-slate-100', muted: 'text-slate-500' }
    : { title: 'text-slate-800', muted: 'text-slate-400' };

  return (
    <div className="mb-1 flex flex-wrap items-center gap-3">
      <div className="flex items-center">
        <h3 className={`text-sm font-black ${textClasses.title}`}>{title}</h3>
        <InfoTooltip definition={definition} isDarkMode={isDarkMode} placement="top" />
      </div>

      <div
        className={`inline-flex min-w-[70px] items-center justify-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
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
          <MdRemove className="h-2.5 w-2.5" />
        ) : isPositive ? (
          <MdTrendingUp className="h-2.5 w-2.5" />
        ) : (
          <MdTrendingDown className="h-2.5 w-2.5" />
        )}
        {Math.abs(delta).toFixed(1)}%
      </div>

      <span
        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}
      >
        ({timeFilter}) {comparisonLabel ? `· ${comparisonLabel}` : ''}
      </span>
    </div>
  );
};

function rowDateIso(row) {
  if (row.dateIso && String(row.dateIso).length >= 10) return String(row.dateIso).slice(0, 10);
  if (row.dateFull) {
    const d = new Date(String(row.dateFull));
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return null;
}

export default function DistilleryAnalyticsDashboard() {
  const [yearType, setYearType] = useState(DEFAULT_YEAR_TYPE);
  const [rangePreset, setRangePreset] = useState(DEFAULT_CHILD_PRESET);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [comparisonType, setComparisonType] = useState('PP');
  const [seasonMapping, setSeasonMapping] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);

  const availableModes = ['B Heavy', 'C Heavy', 'Syrup', 'Mixed'];
  const [selectedModes, setSelectedModes] = useState(availableModes);
  const [isModeOpen, setIsModeOpen] = useState(false);

  const toggleMode = (mode) => {
    setSelectedModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  };

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        setLoading(true);
        const [opsRes, settingsRes] = await Promise.all([
          api.get('/bi/distillery-operations'),
          api.get('/bi/settings').catch(() => ({ data: {} })),
        ]);
        if (!cancelled) {
          setRawData(Array.isArray(opsRes.data?.records) ? opsRes.data.records : []);
          if (settingsRes.data?.seasonMapping && typeof settingsRes.data.seasonMapping === 'object') {
            setSeasonMapping(settingsRes.data.seasonMapping);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setRawData([]);
          setLoadError(e.response?.data?.message || e.message || 'Failed to load distillery operations.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dataBounds = useMemo(() => {
    const isos = rawData.map(rowDateIso).filter(Boolean).sort();
    return { min: isos[0] || null, max: isos[isos.length - 1] || null, isos };
  }, [rawData]);

  /** To-date for presets: today if present in data, else latest data day. */
  const rangeToIso = useMemo(() => {
    if (!dataBounds.max) return null;
    return resolveDashboardToDate(dataBounds.isos, dataBounds.max);
  }, [dataBounds.isos, dataBounds.max]);

  const presetRefDate = useMemo(() => {
    if (!rangeToIso) return new Date();
    return new Date(`${rangeToIso}T12:00:00`);
  }, [rangeToIso]);

  // Default STD (and other presets) with To = today-if-in-data else latest data day.
  useEffect(() => {
    if (!rangeToIso) return;
    if (rangePreset === 'Custom') return;
    if (!isValidChildPreset(yearType, rangePreset)) {
      setRangePreset(defaultChildPresetForYearType(yearType));
      return;
    }
    const { from, to } = getPresetDateRangeForYearType(
      yearType,
      rangePreset,
      presetRefDate,
      seasonMapping,
    );
    setFromDate(from);
    setToDate(to);
  }, [rangeToIso, rangePreset, presetRefDate, yearType, seasonMapping]);

  const filteredData = useMemo(() => {
    if (!fromDate || !toDate) return [];
    const from = fromDate <= toDate ? fromDate : toDate;
    const to = fromDate <= toDate ? toDate : fromDate;

    let data = rawData.filter((row) => {
      const iso = rowDateIso(row);
      if (!iso) return false;
      return iso >= from && iso <= to;
    });

    if (selectedModes.length > 0) {
      data = data.filter((row) => selectedModes.includes(row.mode));
    } else {
      data = [];
    }

    return data;
  }, [rawData, fromDate, toDate, selectedModes]);

  const applyRangePreset = (preset) => {
    const { from, to } = getPresetDateRangeForYearType(
      yearType,
      preset,
      presetRefDate,
      seasonMapping,
    );
    setRangePreset(preset);
    setFromDate(from);
    setToDate(to);
  };

  const applyYearType = (nextType) => {
    setYearType(nextType);
    setComparisonType('PP');
    const nextPreset = isValidChildPreset(nextType, rangePreset)
      ? rangePreset
      : defaultChildPresetForYearType(nextType);
    setRangePreset(nextPreset);
    const { from, to } = getPresetDateRangeForYearType(
      nextType,
      nextPreset,
      presetRefDate,
      seasonMapping,
    );
    setFromDate(from);
    setToDate(to);
  };

  const selectCustomPreset = () => setRangePreset('Custom');

  const handleFromDateChange = (e) => {
    let v = e.target.value;
    let nextTo = toDate;
    if (v && nextTo && v > nextTo) nextTo = v;
    setFromDate(v);
    if (nextTo !== toDate) setToDate(nextTo);
    if (rangePreset !== 'Custom') {
      const c = getPresetDateRangeForYearType(yearType, rangePreset, presetRefDate, seasonMapping);
      if (v !== c.from || nextTo !== c.to) setRangePreset('Custom');
    }
  };

  const handleToDateChange = (e) => {
    let v = e.target.value;
    let nextFrom = fromDate;
    if (v && nextFrom && v < nextFrom) nextFrom = v;
    setToDate(v);
    if (nextFrom !== fromDate) setFromDate(nextFrom);
    if (rangePreset !== 'Custom') {
      const c = getPresetDateRangeForYearType(yearType, rangePreset, presetRefDate, seasonMapping);
      if (nextFrom !== c.from || v !== c.to) setRangePreset('Custom');
    }
  };

  const childPresets = useMemo(() => childPresetsForYearType(yearType), [yearType]);

  const timeFilterLabel =
    rangePreset === 'Custom' ? `${formatDMYShort(fromDate)} – ${formatDMYShort(toDate)}` : rangePreset;
  const periodLabel = rangePreset === 'Custom' ? 'Custom' : rangePreset;

  const dynamicPPLabel = useMemo(() => getDistilleryPPLabel(rangePreset), [rangePreset]);

  const activeYearMapping = useMemo(
    () => resolveActiveYearMapping(yearType, seasonMapping),
    [yearType, seasonMapping],
  );

  const seasonLabels = useMemo(
    () => getSeasonComparisonLabels(presetRefDate),
    [presetRefDate],
  );

  const compareRangePreset = useMemo(
    () => cockpitRangePresetForCompare(yearType, rangePreset),
    [yearType, rangePreset],
  );

  const comparisonOptions = useMemo(() => {
    const opts = buildCockpitComparisonOptions(
      compareRangePreset,
      activeYearMapping,
      toDate || rangeToIso,
    );
    if (opts[0]?.id === 'PP') {
      return [{ id: 'PP', label: dynamicPPLabel }, ...opts.slice(1)];
    }
    return opts;
  }, [dynamicPPLabel, activeYearMapping, toDate, rangeToIso, compareRangePreset]);

  useEffect(() => {
    ensureCompareSelectionValid(comparisonType, comparisonOptions, setComparisonType);
  }, [comparisonType, comparisonOptions]);

  const onCompareSelect = useCallback((nextId) => {
    applyCockpitCompareSelection({
      nextId,
      fromDate,
      toDate,
      rangePreset: compareRangePreset,
      seasonMapping: activeYearMapping,
      seasonLabels,
      dataMin: dataBounds.min,
      dataMax: dataBounds.max,
      setComparisonType,
    });
  }, [fromDate, toDate, compareRangePreset, activeYearMapping, seasonLabels, dataBounds.min, dataBounds.max]);

  const priorPeriodRange = useMemo(
    () => resolveCockpitPriorRange(fromDate, toDate, rangePreset, activeYearMapping),
    [fromDate, toDate, rangePreset, activeYearMapping],
  );

  const comparisonLabel = useMemo(() => {
    const fOpt = { month: 'short', day: 'numeric' };
    const formatDateFriendly = (dStr) => {
      const d = new Date(`${dStr}T12:00:00`);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', fOpt);
    };

    if (comparisonType === 'PP') {
      return `${priorPeriodRange.label} (${formatDateFriendly(priorPeriodRange.start)} - ${formatDateFriendly(priorPeriodRange.end)})`;
    }

    if (!isSeasonComparisonType(comparisonType)) return '';

    const seasonLabel =
      resolveSeasonLabelFromCompareId(comparisonType, seasonLabels, activeYearMapping)
      || seasonLabelForComparisonType(comparisonType, seasonLabels);
    if (!seasonLabel) return '';

    const from = fromDate <= toDate ? fromDate : toDate;
    const to = fromDate <= toDate ? toDate : fromDate;
    const resolved = Object.keys(activeYearMapping).length
      ? resolveCockpitCompareRange(
        from,
        to,
        comparisonType,
        seasonLabels,
        activeYearMapping,
        compareRangePreset,
      )
      : alignSeasonCompareRange(from, to, seasonLabel);
    return `${seasonLabel} (${formatDateFriendly(resolved.start)} - ${formatDateFriendly(resolved.end)})`;
  }, [
    fromDate,
    toDate,
    comparisonType,
    priorPeriodRange,
    seasonLabels,
    activeYearMapping,
    compareRangePreset,
  ]);

  const priorDataSlice = useMemo(() => {
    let slice = rawData.filter((row) => {
      const iso = rowDateIso(row);
      return iso && iso >= priorPeriodRange.start && iso <= priorPeriodRange.end;
    });
    if (selectedModes.length > 0) {
      slice = slice.filter((row) => selectedModes.includes(row.mode));
    }
    return slice;
  }, [rawData, priorPeriodRange, selectedModes]);

  const activeSeasonLabel = useMemo(
    () => resolveSeasonLabelFromCompareId(comparisonType, seasonLabels, activeYearMapping)
      || (isSeasonComparisonType(comparisonType) ? seasonLabelForComparisonType(comparisonType, seasonLabels) : null),
    [comparisonType, seasonLabels, activeYearMapping],
  );

  const seasonCompareSlice = useMemo(() => {
    if (!activeSeasonLabel) return [];
    const from = fromDate <= toDate ? fromDate : toDate;
    const to = fromDate <= toDate ? toDate : fromDate;
    if (Object.keys(activeYearMapping).length > 0) {
      const resolved = resolveCockpitCompareRange(
        from,
        to,
        comparisonType,
        seasonLabels,
        activeYearMapping,
        compareRangePreset,
      );
      if (!resolved.start || !resolved.end) return [];
      return rawData.filter((row) => {
        const iso = rowDateIso(row);
        if (!iso || iso < resolved.start || iso > resolved.end) return false;
        if (selectedModes.length > 0 && !selectedModes.includes(row.mode)) return false;
        return true;
      });
    }
    return filterSeasonCompareRowsBySeason(rawData, from, to, activeSeasonLabel, rowDateIso, selectedModes);
  }, [
    rawData,
    fromDate,
    toDate,
    activeSeasonLabel,
    selectedModes,
    activeYearMapping,
    comparisonType,
    seasonLabels,
    compareRangePreset,
  ]);

  /** Prior-period rows for comparisons — same slices as KPI cards (no day overlay). */
  const comparisonDataSlice = useMemo(() => {
    if (comparisonType === 'PP') return priorDataSlice;
    if (isSeasonComparisonType(comparisonType)) return seasonCompareSlice;
    return [];
  }, [comparisonType, priorDataSlice, seasonCompareSlice]);

  const currentKPIs = useMemo(() => aggregateKpisFromRows(filteredData), [filteredData]);

  /** Match Power BI: count days with ethanol production > 0 (not every logged date). */
  const operatingDaysCount = useMemo(
    () => filteredData.filter((row) => Number(row.totalProd) > 0).length,
    [filteredData],
  );

  const pyKPIs = useMemo(
    () => aggregateKpisFromRows(comparisonDataSlice),
    [comparisonDataSlice],
  );

  const formatMetric = (val, { asPercent = true } = {}) => {
    if (val == null || !Number.isFinite(Number(val))) return '—';
    const n = Number(val);
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(2)}K`;
    if (asPercent) return `${n.toFixed(1)}%`;
    return n.toFixed(2);
  };

  // Efficiency / recovery: blanks stored as 0 → skip zeros (Power BI AVERAGE).
  const AVG_SKIP_ZERO_KEYS = new Set([
    'fermEff',
    'distEff',
    'overallEff',
    'recovery',
    'recBl',
    'fermSugar',
    'alcohol',
    'trs',
    'ufs',
    'fs',
  ]);
  // Stock: blanks are null; keep real 0 inventory in the average.
  const AVG_SKIP_NULL_KEYS = new Set(['molInStore', 'ethInStore']);

  const getChartMetric = (dataKey, isSum = false, sourceData = filteredData) => {
    if (sourceData.length === 0) return 0;
    if (isSum) {
      return sourceData.reduce((sum, item) => sum + (Number(item[dataKey]) || 0), 0);
    }
    if (AVG_SKIP_ZERO_KEYS.has(dataKey)) {
      return averageNonBlank(sourceData, (item) => item[dataKey], { skipZero: true });
    }
    if (AVG_SKIP_NULL_KEYS.has(dataKey)) {
      return averageNonBlank(sourceData, (item) => item[dataKey], { skipZero: false });
    }
    const total = sourceData.reduce((sum, item) => sum + (Number(item[dataKey]) || 0), 0);
    return total / sourceData.length;
  };

  const appClasses = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800';
  const cardClasses = isDarkMode ? 'border-slate-700 bg-slate-800 shadow-slate-900/50' : 'border-slate-200 bg-white shadow-sm';
  const textClasses = isDarkMode
    ? {
        title: 'text-slate-100',
        muted: 'text-slate-400',
        border: 'border-slate-700',
        hover: 'hover:bg-slate-800 hover:text-slate-200',
      }
    : {
        title: 'text-slate-800',
        muted: 'text-slate-500',
        border: 'border-slate-200',
        hover: 'hover:bg-slate-50 hover:text-slate-700',
      };

  const axisStyle = {
    fontSize: 9,
    fontWeight: 600,
    fill: isDarkMode ? '#64748b' : '#94a3b8',
  };
  const gridStyle = {
    stroke: isDarkMode ? '#334155' : '#e2e8f0',
    strokeDasharray: '3 3',
  };

  const modeLabelHover = isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50';

  if (loading) {
    return (
      <div
        className={`flex h-[calc(100vh-3.75rem)] min-h-0 w-full flex-col items-center justify-center p-2 font-sans transition-colors duration-300 sm:p-3 ${appClasses}`}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className={`flex h-[calc(100vh-3.75rem)] min-h-0 w-full flex-col overflow-hidden p-2 font-sans transition-colors duration-300 sm:p-3 ${appClasses}`}
    >
      {loadError ? (
        <div
          className={`mb-3 shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold ${
            isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
          role="alert"
        >
          {loadError}
        </div>
      ) : null}
      <div className="mb-0 flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BiDashboardHeader
            title="Distillery Operations"
            subtitle="Enterprise Analytics & PoP Performance"
            icon={MdScience}
            iconColor="#6366f1"
            isDarkMode={isDarkMode}
          />

          <div className="flex items-center gap-4">
            <BiKeyMetricBox
              value={operatingDaysCount}
              title="Operating Days"
              subtitle={rangePreset === 'Custom' ? timeFilterLabel : rangePreset}
              isDarkMode={isDarkMode}
              tooltip={`${operatingDaysCount} days with ethanol production > 0 — ${rangePreset === 'Custom' ? timeFilterLabel : rangePreset}`}
            />
          </div>
        </div>

        <BiFilterBarLayout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}>
            <div className="shrink-0">
              <OpModeFilter
                isOpen={isModeOpen}
                onToggle={() => setIsModeOpen(!isModeOpen)}
                onClose={() => setIsModeOpen(false)}
                availableModes={availableModes}
                selectedModes={selectedModes}
                toggleMode={toggleMode}
                isDarkMode={isDarkMode}
                cardClasses={cardClasses}
                textClasses={textClasses}
                modeLabelHover={modeLabelHover}
              />
            </div>

            <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${cardClasses}`}>
              <div className="flex flex-wrap gap-0.5 sm:gap-1">
                {YEAR_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.title}
                    onClick={() => applyYearType(opt.id)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                      yearType === opt.id
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                        : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${cardClasses}`}>
              <MdCalendarMonth className={`ml-0.5 h-3.5 w-3.5 shrink-0 sm:ml-1 sm:h-4 sm:w-4 ${textClasses.muted}`} />
              <div className="flex flex-wrap gap-0.5 sm:gap-1">
                {childPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyRangePreset(preset)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                      rangePreset === preset
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={selectCustomPreset}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                    rangePreset === 'Custom'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                      : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className="flex min-w-0 shrink-0 flex-wrap items-end gap-2">
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${textClasses.muted}`}>From</span>
                <input
                  type="date"
                  value={fromDate}
                  min={dataBounds.min || undefined}
                  max={toDate}
                  onChange={handleFromDateChange}
                  className={`bi-date-input min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-900 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${textClasses.muted}`}>To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={dataBounds.max || undefined}
                  onChange={handleToDateChange}
                  className={`bi-date-input min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-900 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                />
              </div>
            </div>

            <div className="flex w-full min-w-0 basis-full flex-wrap items-center gap-1.5 sm:basis-auto sm:gap-2 lg:w-auto">
                <span className={`shrink-0 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider sm:text-[10px] sm:tracking-widest ${textClasses.muted}`}>
                  Compare:
                </span>
                <div className={`flex min-w-0 flex-wrap gap-0.5 rounded-lg border p-0.5 ${cardClasses}`}>
                  {comparisonOptions.map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => onCompareSelect(comp.id)}
                      className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-black transition-all sm:px-2 sm:py-1 sm:text-[10px] md:px-2.5 ${
                        comparisonType === comp.id
                          ? isDarkMode
                            ? 'bg-slate-700 text-slate-100 shadow-sm'
                            : 'bg-slate-800 text-white shadow-sm'
                          : `text-slate-500 ${isDarkMode ? 'hover:bg-slate-700/50 hover:text-slate-300' : 'hover:bg-slate-100 hover:text-slate-700'}`
                      }`}
                    >
                      {comp.label}
                    </button>
                  ))}
                </div>
              </div>
        </BiFilterBarLayout>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto max-md:pb-1 md:flex md:flex-col md:overflow-y-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:gap-2 md:overflow-hidden">
          <div className="mt-2 grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4 xl:gap-2">
            <MetricCard
              title="Total Ethanol Produced"
              value={currentKPIs.ethanolProd}
              pyValue={pyKPIs.ethanolProd}
              unit="BL"
              definition="Total Bulk Liters of Ethanol produced."
              timeFilter={periodLabel}
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabel}
              chartData={filteredData}
              dataKey="totalProd"
              chartType="area"
              chartColor="#3b82f6"
            />
            <MetricCard
              title="Syrup/Molasses Consumed"
              value={currentKPIs.syrupMol}
              pyValue={pyKPIs.syrupMol}
              unit="Q"
              definition="Sum of syrup/molasses consumed (quintals) from daily distillery operations records."
              timeFilter={periodLabel}
              inverseColor
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabel}
              chartData={filteredData}
              dataKey="syrupMolConsumed"
              chartType="area"
              chartColor="#f59e0b"
            />
            <MetricCard
              title="Fermentation Efficiency"
              value={currentKPIs.fermEff}
              pyValue={pyKPIs.fermEff}
              unit="%"
              definition="Yield based on sugar."
              timeFilter={periodLabel}
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabel}
              chartData={filteredData}
              dataKey="fermEff"
              chartType="line"
              chartColor="#10b981"
            />
            <MetricCard
              title="Distillation Efficiency"
              value={currentKPIs.distEff}
              pyValue={pyKPIs.distEff}
              unit="%"
              definition="Recovery of alcohol."
              timeFilter={periodLabel}
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabel}
              chartData={filteredData}
              dataKey="distEff"
              chartType="line"
              chartColor="#10b981"
            />
          </div>

          <DistilleryChartsGrid
            ChartTitle={ChartTitle}
            filteredData={filteredData}
            comparisonData={comparisonDataSlice}
            periodLabel={periodLabel}
            comparisonLabel={comparisonLabel}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            formatMetric={formatMetric}
            getChartMetric={getChartMetric}
          />

        </div>
      </div>
    </div>
  );
}
