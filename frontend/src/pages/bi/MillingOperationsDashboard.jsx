import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MdArrowBack,
  MdCalendarMonth,
  MdDarkMode,
  MdLightMode,
  MdExpandMore,
  MdFilterList,
  MdInfoOutline,
  MdRemove,
  MdTrendingDown,
  MdTrendingUp,
  MdWarning,
  MdThermostat,
  MdOpacity,
  MdDashboard,
  MdTableChart,
} from 'react-icons/md';
import MillRawDataTable from '../../components/bi/MillRawDataTable';
import {
  STOPPAGE_RAW_COLUMNS,
  buildStoppageTableRows,
} from '../../utils/millingBiRawTable';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import {
  computePriorPeriodRange,
  formatDMYShort,
  formatYMD,
  getPresetDateRange,
  getSeasonComparisonLabels,
  isSeasonComparisonType,
  alignSeasonCompareRange,
  seasonLabelForComparisonType,
} from '../../utils/distilleryBiDateRange';
import {
  filterMillStoppages,
  filterMillSeasonCompareRows,
  buildMillDailyStoppageSeries,
  aggregateMillStoppageKpis,
} from '../../utils/millingBiComparison';
import MillThermalReportsTab from './MillThermalReportsTab';
import MillLubeRollerTab from './MillLubeRollerTab';

/** Section → bar/badge color (matches the milling stoppage option list). */
const SECTION_COLORS = {
  'CANE': '#10b981',
  'CANE HANDLING EQUIPMENTS': '#06b6d4',
  'PREPERATORY DEVICES': '#8b5cf6',
  'MILLS': '#3b82f6',
  '70TPH BOILER': '#f43f5e',
  '150TPH BOILER': '#14b8a6',
  'PROCESS DS': '#6366f1',
  'PROCESS RS': '#a855f7',
  'BOILING HOUSE': '#0ea5e9',
  'REDUCED JUICE FLOW': '#ec4899',
  'OTHERS': '#f59e0b',
};

const ALL_SECTIONS = Object.keys(SECTION_COLORS);

const sectionColor = (sec) => SECTION_COLORS[sec] || '#94a3b8';

const NAV_TABS = [
  { id: 'outages',    label: 'Mill Outage',           icon: MdWarning,    enabled: true  },
  { id: 'thermal',    label: 'Equipment Temperature', icon: MdThermostat, enabled: true  },
  { id: 'lube-press', label: 'Lube & Roller Temp',    icon: MdOpacity,    enabled: true  },
];

const InfoTooltip = ({ definition, isDarkMode, placement = 'top' }) => (
  <div className="group relative z-20 ml-1.5 inline-flex shrink-0 cursor-help items-center">
    <MdInfoOutline className="h-3.5 w-3.5 text-slate-400 transition-colors hover:text-blue-500" />
    <div
      className={`pointer-events-none absolute left-1/2 z-[200] w-64 -translate-x-1/2 rounded-lg p-3 text-center text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
        placement === 'bottom'
          ? 'top-full mt-2'
          : 'bottom-full mb-2'
      } ${isDarkMode ? 'bg-slate-700' : 'bg-slate-800'}`}
      role="tooltip"
    >
      {definition}
      <div
        className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
          placement === 'bottom'
            ? `bottom-full ${isDarkMode ? 'border-b-slate-700' : 'border-b-slate-800'}`
            : `top-full ${isDarkMode ? 'border-t-slate-700' : 'border-t-slate-800'}`
        }`}
      />
    </div>
  </div>
);

/** Distillery-style KPI card with sparkline. */
const KpiCard = ({
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
  formatValue,
}) => {
  const safeVal = Number.isFinite(value) ? value : 0;
  const safePy = Number.isFinite(pyValue) ? pyValue : 0;
  const delta = safePy !== 0 ? ((safeVal - safePy) / safePy) * 100 : 0;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const isGood = inverseColor ? !isPositive : isPositive;

  const cardClasses = isDarkMode
    ? 'border-slate-700 bg-slate-800 shadow-slate-900/50'
    : 'border-slate-200 bg-white shadow-sm';

  const t = isDarkMode
    ? { title: 'text-slate-400', value: 'text-slate-100', unit: 'text-slate-500', vs: 'text-slate-500' }
    : { title: 'text-slate-500', value: 'text-slate-800', unit: 'text-slate-500', vs: 'text-slate-400' };

  const fmt =
    formatValue ||
    ((v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  return (
    <div className={`relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border p-2.5 transition-shadow hover:shadow-md sm:overflow-visible sm:p-3 ${cardClasses}`}>
      <div className="mb-2 flex items-start justify-between overflow-visible">
        <div className={`flex min-w-0 items-center text-xs font-bold ${t.title}`}>
          {title}
          <InfoTooltip definition={definition} isDarkMode={isDarkMode} placement="top" />
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="z-10 min-w-0 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${t.value}`}>{fmt(safeVal)}</span>
            <span className={`text-[10px] font-bold ${t.unit}`}>{unit}</span>
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
            <span className={`whitespace-nowrap text-[10px] font-bold ${t.vs}`}>vs {comparisonLabel} {timeFilter}</span>
          </div>
        </div>

        {chartData && chartData.length > 0 && dataKey && (
          <div className="relative h-14 w-full min-w-0 opacity-90 sm:-mb-2 sm:-mr-1 sm:ml-4 sm:h-16 sm:max-w-[55%] sm:flex-1 sm:min-w-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`mill-grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    fill={`url(#mill-grad-${dataKey})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    dot={false}
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

const ChartTooltip = ({ active, payload, label, isDarkMode, unit = 'h' }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className={`rounded-xl border p-3 text-xs font-bold shadow-xl backdrop-blur-sm ${
        isDarkMode ? 'border-slate-700 bg-slate-800/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-700'
      }`}
    >
      <p className={`mb-2 border-b pb-2 ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{entry.name}:</span>
            </div>
            <span className="font-mono">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : String(entry.value)} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

function isoToLabel(iso) {
  if (!iso || iso.length < 10) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MillingOperationsDashboard() {
  const [activeTab, setActiveTab] = useState('outages');
  const [viewMode, setViewMode] = useState('dashboard');
  const [comparisonType, setComparisonType] = useState('PP');
  const [thirdSeasonEnabled, setThirdSeasonEnabled] = useState(false);
  const [rangePreset, setRangePreset] = useState('MTD');
  const initial = () => getPresetDateRange('MTD');
  const [fromDate, setFromDate] = useState(() => initial().from);
  const [toDate, setToDate] = useState(() => initial().to);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [selectedSections, setSelectedSections] = useState(ALL_SECTIONS);
  const [isSectionOpen, setIsSectionOpen] = useState(false);

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
          api.get('/bi/milling-operations'),
          api.get('/bi/settings').catch(() => ({ data: { thirdSeasonCompareEnabled: false } })),
        ]);
        if (!cancelled) {
          setRawData(Array.isArray(opsRes.data?.records) ? opsRes.data.records : []);
          setThirdSeasonEnabled(Boolean(settingsRes.data?.thirdSeasonCompareEnabled));
        }
      } catch (err) {
        if (!cancelled) {
          setRawData([]);
          setLoadError(err.response?.data?.message || err.message || 'Failed to load milling stoppages.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!thirdSeasonEnabled && comparisonType === 'S3') {
      setComparisonType('PP');
    }
  }, [thirdSeasonEnabled, comparisonType]);

  /**
   * Data bounds are kept for display hints (e.g. "Data available: Mar 2023 – Mar 2026")
   * but presets anchor to *today* so QTD/MTD/YTD mean the current Indian FY window,
   * matching how users (and ERP reports) read those acronyms.
   * Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
   */
  const dataBounds = useMemo(() => {
    const isos = rawData.map((r) => r.dateIso).filter(Boolean).sort();
    return { min: isos[0] || null, max: isos[isos.length - 1] || null };
  }, [rawData]);

  // Presets re-pin to today whenever the user switches preset (no data-anchor side-effect).
  useEffect(() => {
    if (rangePreset === 'Custom') return;
    const { from, to } = getPresetDateRange(rangePreset, new Date());
    setFromDate(from);
    setToDate(to);
  }, [rangePreset]);

  /**
   * Auto-fallback on first load: if the default MTD window (today's month) has no
   * stoppage records but data exists somewhere else, jump to the latest data range
   * so the dashboard never opens with an empty cockpit. The user can switch back to
   * a calendar preset any time — it will then resolve relative to today.
   */
  const initialFallbackRef = useRef(false);
  useEffect(() => {
    if (initialFallbackRef.current) return;
    if (loading) return;
    if (!dataBounds.max) return;
    initialFallbackRef.current = true;
    const mtd = getPresetDateRange('MTD', new Date());
    const hasInMtd = rawData.some((r) => r.dateIso && r.dateIso >= mtd.from && r.dateIso <= mtd.to);
    if (!hasInMtd) {
      setRangePreset('Custom');
      setFromDate(dataBounds.min || dataBounds.max);
      setToDate(dataBounds.max);
    }
  }, [loading, dataBounds.max, dataBounds.min, rawData]);

  const toggleSection = (sec) => {
    setSelectedSections((prev) => (prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]));
  };

  const applyPreset = (preset) => {
    const { from, to } = getPresetDateRange(preset, new Date());
    setRangePreset(preset);
    setFromDate(from);
    setToDate(to);
  };

  const selectCustomPreset = () => setRangePreset('Custom');

  const handleFromChange = (e) => {
    let v = e.target.value;
    let nextTo = toDate;
    if (v && nextTo && v > nextTo) nextTo = v;
    setFromDate(v);
    if (nextTo !== toDate) setToDate(nextTo);
    if (rangePreset !== 'Custom') setRangePreset('Custom');
  };
  const handleToChange = (e) => {
    let v = e.target.value;
    let nextFrom = fromDate;
    if (v && nextFrom && v < nextFrom) nextFrom = v;
    setToDate(v);
    if (nextFrom !== fromDate) setFromDate(nextFrom);
    if (rangePreset !== 'Custom') setRangePreset('Custom');
  };

  /** Rows inside the selected date range AND active sections. */
  const filteredData = useMemo(
    () => filterMillStoppages(rawData, fromDate, toDate, selectedSections),
    [rawData, fromDate, toDate, selectedSections],
  );

  const priorRange = useMemo(
    () => computePriorPeriodRange(fromDate, toDate, rangePreset),
    [fromDate, toDate, rangePreset],
  );

  const dynamicPPLabel = useMemo(() => {
    if (rangePreset === 'MTD') return 'Prev. Month';
    if (rangePreset === 'QTD') return 'Prev. Quarter';
    if (rangePreset === 'YTD') return 'Prev. Year';
    return 'Prev. Period';
  }, [rangePreset]);

  const seasonLabels = useMemo(() => getSeasonComparisonLabels(new Date()), []);

  const comparisonOptions = useMemo(() => {
    const opts = [
      { id: 'PP', label: dynamicPPLabel },
      { id: 'S1', label: seasonLabels.season1 },
      { id: 'S2', label: seasonLabels.season2 },
    ];
    if (thirdSeasonEnabled) {
      opts.push({ id: 'S3', label: seasonLabels.season3 });
    }
    return opts;
  }, [dynamicPPLabel, seasonLabels, thirdSeasonEnabled]);

  const activeSeasonLabel = useMemo(
    () => (isSeasonComparisonType(comparisonType) ? seasonLabelForComparisonType(comparisonType, seasonLabels) : null),
    [comparisonType, seasonLabels],
  );

  const compareData = useMemo(() => {
    if (comparisonType === 'PP') {
      return filterMillStoppages(rawData, priorRange.start, priorRange.end, selectedSections);
    }
    if (activeSeasonLabel) {
      return filterMillSeasonCompareRows(rawData, fromDate, toDate, activeSeasonLabel, selectedSections);
    }
    return [];
  }, [rawData, comparisonType, priorRange, fromDate, toDate, activeSeasonLabel, selectedSections]);

  const timeFilterLabel = rangePreset === 'Custom' ? `${formatDMYShort(fromDate)} – ${formatDMYShort(toDate)}` : rangePreset;
  const periodLabel = rangePreset === 'Custom' ? 'Custom' : rangePreset;

  const comparisonLabel = useMemo(() => {
    const fOpt = { month: 'short', day: 'numeric' };
    const friendly = (dStr) => {
      const d = new Date(`${dStr}T12:00:00`);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', fOpt);
    };

    if (comparisonType === 'PP') {
      return `${priorRange.label} (${friendly(priorRange.start)} - ${friendly(priorRange.end)})`;
    }

    if (!activeSeasonLabel) return '';

    const from = fromDate <= toDate ? fromDate : toDate;
    const to = fromDate <= toDate ? toDate : fromDate;
    const { start, end } = alignSeasonCompareRange(from, to, activeSeasonLabel);
    return `${activeSeasonLabel} (${friendly(start)} - ${friendly(end)})`;
  }, [comparisonType, priorRange, activeSeasonLabel, fromDate, toDate]);

  /** Per-day stoppage totals (current + compare overlay). */
  const dailySeries = useMemo(() => {
    const base = buildMillDailyStoppageSeries(
      filteredData,
      compareData,
      isSeasonComparisonType(comparisonType),
      activeSeasonLabel,
    );
    return base.map((pt) => ({
      ...pt,
      date: isoToLabel(pt.dateIso),
    }));
  }, [filteredData, compareData, comparisonType, activeSeasonLabel]);

  /** Section roll-up totals for the bar chart (sorted desc). */
  const sectionTotals = useMemo(() => {
    const map = new Map();
    for (const r of filteredData) {
      if (!r.section) continue;
      map.set(r.section, (map.get(r.section) || 0) + (Number(r.hours) || 0));
    }
    return Array.from(map.entries())
      .map(([section, hours]) => ({ section, hours: Number(hours.toFixed(2)), color: sectionColor(section) }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredData]);

  /** Machinery roll-up totals (sorted desc) for the matrix list. */
  const machineryTotals = useMemo(() => {
    const map = new Map();
    for (const r of filteredData) {
      const key = r.machinery || '—';
      const prev = map.get(key) || { hours: 0, section: r.section };
      prev.hours += Number(r.hours) || 0;
      if (!prev.section) prev.section = r.section;
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .map(([machinery, { hours, section }]) => ({ machinery, hours: Number(hours.toFixed(2)), section }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredData]);

  const totalMachineryHours = useMemo(
    () => machineryTotals.reduce((acc, m) => acc + m.hours, 0).toFixed(2),
    [machineryTotals],
  );

  /** KPI aggregates for current and compare period. */
  const kpis = useMemo(() => {
    const cur = aggregateMillStoppageKpis(filteredData, fromDate, toDate);
    const prior = aggregateMillStoppageKpis(compareData, fromDate, toDate);
    return {
      cur: { totalHrs: cur.totalHrs, events: cur.events, maxDur: cur.maxDur },
      prior: { totalHrs: prior.totalHrs, events: prior.events, maxDur: prior.maxDur },
      mtbf: cur.mtbf,
      priorMtbf: prior.mtbf,
    };
  }, [filteredData, compareData, fromDate, toDate]);

  const axisStyle = {
    fontSize: 9,
    fontWeight: 600,
    fill: isDarkMode ? '#64748b' : '#94a3b8',
  };
  const gridStyle = {
    stroke: isDarkMode ? '#334155' : '#e2e8f0',
    strokeDasharray: '3 3',
  };

  const appClasses = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800';
  const headerClasses = isDarkMode ? 'text-slate-100' : 'text-slate-900';
  const subheadClasses = isDarkMode ? 'text-slate-400' : 'text-slate-500';
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

  const headerSubtitle =
    activeTab === 'thermal'
      ? 'Equipment temperature analytics · Reference: Data_Mill'
      : activeTab === 'lube-press'
        ? 'Lube pressure & roller temperature · Reference: DataLube_Names'
        : 'Mill stoppage analytics & outage telemetry';

  if (loading) {
    return (
      <div className={`flex h-[calc(100vh-3.75rem)] w-full items-center justify-center font-sans ${appClasses}`}>
        <Spinner size="lg" />
      </div>
    );
  }

  const sectionPanelClass = isDarkMode
    ? 'absolute right-0 top-full z-[320] mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-xl'
    : 'absolute right-0 top-full z-[320] mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-xl';

  return (
    <div className={`flex h-[calc(100dvh-3.75rem)] min-h-0 w-full flex-col overflow-hidden p-1.5 font-sans transition-colors duration-300 sm:p-2 ${appClasses}`}>
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

      <div className="mb-2 flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <Link
            to="/bi"
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
              isDarkMode
                ? 'border-slate-600 bg-slate-800 text-blue-400 hover:bg-slate-700'
                : 'border-slate-200 bg-white text-blue-600 hover:bg-slate-50'
            }`}
          >
            <MdArrowBack className="h-3.5 w-3.5" />
            BI Control Tower
          </Link>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
                viewMode === 'dashboard'
                  ? 'border-blue-500 text-blue-500'
                  : `border-transparent ${textClasses.muted} ${textClasses.hover}`
              }`}
            >
              <MdDashboard className="h-3.5 w-3.5" />
              Visual Dashboard
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
                viewMode === 'table'
                  ? 'border-blue-500 text-blue-500'
                  : `border-transparent ${textClasses.muted} ${textClasses.hover}`
              }`}
            >
              <MdTableChart className="h-3.5 w-3.5" />
              Raw Data Table
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 shrink-0 px-0.5">
            <h1 className={`text-lg font-black tracking-tight sm:text-xl ${headerClasses}`}>
              Milling Division Cockpit
            </h1>
            <p className={`mt-0.5 text-[10px] font-bold leading-snug sm:text-[11px] ${subheadClasses}`}>
              {headerSubtitle}
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 px-0.5 py-1 lg:min-w-0 lg:max-w-full lg:flex-1 lg:items-end lg:py-1.5">
            <div
              className={`mill-cockpit-filter-bar relative z-[200] flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 overflow-x-hidden rounded-2xl border p-2 shadow-sm backdrop-blur-md sm:gap-2.5 sm:p-2.5 ${
                isDarkMode
                  ? 'border-purple-500/30 bg-slate-800/80 shadow-purple-900/20'
                  : 'border-purple-200 bg-white/80 shadow-purple-100/50'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`shrink-0 rounded-xl border p-1.5 transition-colors sm:p-2 ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                }`}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <MdLightMode className="h-4 w-4" /> : <MdDarkMode className="h-4 w-4" />}
              </button>

              <div className={`mx-1 hidden h-6 w-px sm:block ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

              <div className={`flex shrink-0 flex-nowrap items-center gap-0.5 rounded-xl border p-0.5 ${cardClasses}`}>
                {NAV_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const disabled = !tab.enabled;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={disabled}
                      title={disabled ? 'Coming soon' : undefined}
                      onClick={() => (disabled ? null : setActiveTab(tab.id))}
                      className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:text-[11px] ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : disabled
                            ? `cursor-not-allowed opacity-40 ${textClasses.muted}`
                            : `text-slate-500 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                      }`}
                    >
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Section multi-select (mill-stoppage only) */}
              <div className={`relative z-[310] shrink-0 ${activeTab === 'outages' ? '' : 'hidden'}`}>
                <button
                  type="button"
                  onClick={() => setIsSectionOpen(!isSectionOpen)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border p-1.5 px-2 text-[10px] font-bold transition-colors sm:gap-2 sm:px-3 sm:text-xs ${cardClasses} ${textClasses.muted} ${
                    isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <MdFilterList className="h-3.5 w-3.5" />
                  Section ({selectedSections.length === ALL_SECTIONS.length ? 'All' : selectedSections.length})
                  <MdExpandMore className={`h-3 w-3 transition-transform ${isSectionOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSectionOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-[300] cursor-default bg-transparent"
                      onClick={() => setIsSectionOpen(false)}
                    />
                    <div className={sectionPanelClass}>
                      <div
                        className={`mb-2 flex items-center justify-between border-b px-2 pb-2 text-[10px] font-bold uppercase tracking-wider ${
                          isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'
                        }`}
                      >
                        Filter by section
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSections((prev) =>
                              prev.length === ALL_SECTIONS.length ? [] : ALL_SECTIONS,
                            )
                          }
                          className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {selectedSections.length === ALL_SECTIONS.length ? 'Clear all' : 'Select all'}
                        </button>
                      </div>
                      <div className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
                        {ALL_SECTIONS.map((sec) => (
                          <label
                            key={sec}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition-colors ${
                              isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSections.includes(sec)}
                              onChange={() => toggleSection(sec)}
                              className={`h-4 w-4 rounded text-blue-600 focus:ring-blue-500 ${
                                isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-slate-300'
                              }`}
                            />
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sectionColor(sec) }} />
                            <span className={`text-xs font-semibold ${textClasses.title}`}>{sec}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Preset chips */}
              <div className={`flex shrink-0 flex-nowrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${cardClasses}`}>
                <MdCalendarMonth className={`ml-0.5 h-3.5 w-3.5 shrink-0 sm:ml-1 sm:h-4 sm:w-4 ${textClasses.muted}`} />
                <div className="flex shrink-0 flex-nowrap gap-0.5 sm:gap-1">
                  {['MTD', 'QTD', 'YTD'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPreset(preset)}
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

              <div className={`mx-0.5 hidden h-5 w-px shrink-0 sm:mx-1 sm:block sm:h-6 ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

              {/* From / To + Compare — single nowrap row */}
              <div className="flex min-w-0 shrink-0 flex-nowrap items-end gap-1.5 sm:gap-2">
                <div className="flex shrink-0 flex-col gap-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${textClasses.muted}`}>From</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={handleFromChange}
                    className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                      isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${textClasses.muted}`}>To</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={handleToChange}
                    className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                      isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  />
                </div>

                {viewMode === 'dashboard' && activeTab === 'outages' && (
                  <>
                    <div className={`mx-0.5 h-6 w-px shrink-0 self-center ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />
                    <div className="flex shrink-0 flex-nowrap items-center gap-1 pr-0.5 sm:gap-1.5 sm:pr-1">
                      <span className={`shrink-0 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider sm:text-[10px] sm:tracking-widest ${textClasses.muted}`}>
                        Compare:
                      </span>
                      <div className={`flex shrink-0 flex-nowrap gap-0.5 rounded-lg border p-0.5 ${cardClasses}`}>
                        {comparisonOptions.map((comp) => (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => setComparisonType(comp.id)}
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BODY (Distillery-style scroll: KPI row stays outside scroll on md+) ─── */}
      <div
        className={`min-h-0 min-w-0 flex-1 max-md:pb-1 ${
          viewMode === 'table'
            ? 'flex flex-col overflow-hidden'
            : 'flex flex-col overflow-hidden'
        }`}
      >
        {activeTab === 'outages' ? (
          viewMode === 'table' ? (
            <MillRawDataTable
              title="Mill Stoppage Log"
              periodLabel={periodLabel}
              columns={STOPPAGE_RAW_COLUMNS}
              rows={buildStoppageTableRows(filteredData)}
              loading={loading}
              isDarkMode={isDarkMode}
              cardClasses={cardClasses}
              textClasses={textClasses}
            />
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:overflow-hidden">
              <MillOutageTab
                kpis={kpis}
                periodLabel={periodLabel}
                comparisonLabel={comparisonLabel}
                dailySeries={dailySeries}
                sectionTotals={sectionTotals}
                machineryTotals={machineryTotals}
                totalMachineryHours={totalMachineryHours}
                filteredData={filteredData}
                isDarkMode={isDarkMode}
                cardClasses={cardClasses}
                textClasses={textClasses}
                axisStyle={axisStyle}
                gridStyle={gridStyle}
              />
            </div>
          )
        ) : activeTab === 'thermal' ? (
          <MillThermalReportsTab
            fromDate={fromDate}
            toDate={toDate}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            periodLabel={periodLabel}
            viewMode={viewMode}
          />
        ) : activeTab === 'lube-press' ? (
          <MillLubeRollerTab
            fromDate={fromDate}
            toDate={toDate}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            periodLabel={periodLabel}
            viewMode={viewMode}
          />
        ) : (
          <ComingSoonTab tab={activeTab} cardClasses={cardClasses} textClasses={textClasses} />
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * TAB 1 — MILL OUTAGE
 * ──────────────────────────────────────────────────────────── */
function MillOutageTab({
  kpis,
  periodLabel,
  comparisonLabel,
  dailySeries,
  sectionTotals,
  machineryTotals,
  totalMachineryHours,
  filteredData,
  isDarkMode,
  cardClasses,
  textClasses,
  axisStyle,
  gridStyle,
}) {
  const tooltipRender = (props) => <ChartTooltip {...props} isDarkMode={isDarkMode} unit="h" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
      {/* KPI ROW */}
      <div className="grid min-w-0 shrink-0 grid-cols-2 gap-1.5 overflow-visible xl:grid-cols-4">
        <KpiCard
          title="Total Stoppage Hours"
          value={kpis.cur.totalHrs}
          pyValue={kpis.prior.totalHrs}
          unit="Hrs"
          definition="Total downtime hours logged across all mill sections inside the selected period."
          timeFilter={periodLabel}
          inverseColor
          isDarkMode={isDarkMode}
          comparisonLabel={comparisonLabel}
          chartData={dailySeries}
          dataKey="stoppageHours"
          chartType="area"
          chartColor="#f43f5e"
        />
        <KpiCard
          title="Stoppage Events"
          value={kpis.cur.events}
          pyValue={kpis.prior.events}
          unit="Events"
          definition="Count of individual stoppage incidents (rows with a positive duration) in the period."
          timeFilter={periodLabel}
          inverseColor
          isDarkMode={isDarkMode}
          comparisonLabel={comparisonLabel}
          chartData={dailySeries}
          dataKey="stoppageHours"
          chartType="line"
          chartColor="#a855f7"
          formatValue={(v) => Math.round(v).toLocaleString()}
        />
        <KpiCard
          title="Max Incident Duration"
          value={kpis.cur.maxDur}
          pyValue={kpis.prior.maxDur}
          unit="Hrs"
          definition="Longest single stoppage logged in the selected window."
          timeFilter={periodLabel}
          inverseColor
          isDarkMode={isDarkMode}
          comparisonLabel={comparisonLabel}
          chartData={dailySeries}
          dataKey="stoppageHours"
          chartType="line"
          chartColor="#f59e0b"
        />
        <KpiCard
          title="MTBF"
          value={kpis.mtbf}
          pyValue={kpis.priorMtbf}
          unit="Hrs"
          definition="Mean Time Between Failures = (Period uptime hours) / events. Higher is better."
          timeFilter={periodLabel}
          isDarkMode={isDarkMode}
          comparisonLabel={comparisonLabel}
          chartData={dailySeries}
          dataKey="stoppageHoursCompare"
          chartType="line"
          chartColor="#10b981"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-0.5">
      {/* DAILY TREND */}
      <div className={`rounded-2xl border p-4 ${cardClasses}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <h3 className={`text-sm font-black ${textClasses.title}`}>Stoppages Daily Trend</h3>
            <InfoTooltip
              definition="Daily total stoppage hours in the selected period vs the same number of days from the prior period."
              isDarkMode={isDarkMode}
              placement="bottom"
            />
          </div>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
          }`}>
            {periodLabel} · {comparisonLabel}
          </span>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailySeries} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="mill-trend-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} {...gridStyle} />
              <XAxis dataKey="date" tick={axisStyle} stroke={isDarkMode ? '#334155' : '#cbd5e1'} />
              <YAxis tick={axisStyle} stroke={isDarkMode ? '#334155' : '#cbd5e1'} />
              <Tooltip content={tooltipRender} />
              <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} iconType="circle" />
              <Area
                type="monotone"
                dataKey="stoppageHours"
                name="Stoppage Hours"
                stroke="#f43f5e"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#mill-trend-grad)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="stoppageHoursCompare"
                name="Prior Period"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* OUTAGES BY CATEGORY */}
      <div className={`rounded-2xl border p-4 ${cardClasses}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <h3 className={`text-sm font-black ${textClasses.title}`}>Total Outages by Category</h3>
            <InfoTooltip
              definition="Cumulative stoppage hours grouped by mill section over the active selection."
              isDarkMode={isDarkMode}
              placement="bottom"
            />
          </div>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
          }`}>
            {sectionTotals.length} sections
          </span>
        </div>
        <div className="h-[300px] w-full">
          {sectionTotals.length === 0 ? (
            <EmptyState message="No stoppages match the current filters." isDarkMode={isDarkMode} textClasses={textClasses} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionTotals} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                <CartesianGrid vertical={false} {...gridStyle} />
                <XAxis
                  dataKey="section"
                  tick={{ ...axisStyle, fontSize: 8 }}
                  stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={axisStyle} stroke={isDarkMode ? '#334155' : '#cbd5e1'} />
                <Tooltip content={tooltipRender} />
                <Bar dataKey="hours" name="Stoppage Hours" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {sectionTotals.map((entry, idx) => (
                    <Cell key={`bar-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* MACHINERY + INCIDENT LOG */}
      <div className="grid grid-cols-12 gap-3">
        <div className={`col-span-12 flex flex-col rounded-2xl border p-4 lg:col-span-4 ${cardClasses}`}>
          <div className="mb-3 flex items-center">
            <h3 className={`text-sm font-black ${textClasses.title}`}>Machinery Outage List</h3>
            <InfoTooltip
              definition="Cumulative downtime hours per individual machine for the current filters."
              isDarkMode={isDarkMode}
              placement="bottom"
            />
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`} style={{ maxHeight: 360 }}>
            <table className="w-full text-left text-xs">
              <thead
                className={`sticky top-0 z-10 border-b text-[10px] uppercase tracking-wide ${
                  isDarkMode ? 'border-slate-700 bg-slate-900/90 text-slate-500' : 'border-slate-200 bg-slate-50/90 text-slate-400'
                }`}
              >
                <tr>
                  <th className="px-3 py-2 font-bold">Machinery</th>
                  <th className="px-3 py-2 text-right font-bold">Hours</th>
                </tr>
              </thead>
              <tbody className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {machineryTotals.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={`px-3 py-12 text-center font-semibold ${textClasses.muted}`}>
                      No machinery downtime in this window.
                    </td>
                  </tr>
                ) : (
                  machineryTotals.map((m, idx) => (
                    <tr
                      key={idx}
                      className={isDarkMode ? 'transition-colors hover:bg-slate-800/50' : 'transition-colors hover:bg-slate-50'}
                    >
                      <td className="px-3 py-2">
                        <div className={`font-bold ${textClasses.title}`}>{m.machinery}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sectionColor(m.section) }} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${textClasses.muted}`}>
                            {m.section || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-black text-rose-500">{m.hours.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className={`mt-3 flex items-center justify-between border-t pt-2 text-xs font-black uppercase ${
            isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-200 text-slate-700'
          }`}>
            <span>Total duration</span>
            <span className="font-mono text-rose-500 dark:text-rose-400">{totalMachineryHours}h</span>
          </div>
        </div>

        {/* Incident ledger */}
        <div className={`col-span-12 flex flex-col rounded-2xl border p-4 lg:col-span-8 ${cardClasses}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center">
              <h3 className={`text-sm font-black ${textClasses.title}`}>Detailed Incident Log Ledger</h3>
              <InfoTooltip
                definition="Chronological list of mill stoppage entries, with section, machinery and remark."
                isDarkMode={isDarkMode}
                placement="bottom"
              />
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
            }`}>
              {filteredData.length} records
            </span>
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`} style={{ maxHeight: 360 }}>
            <table className="w-full text-left text-xs">
              <thead
                className={`sticky top-0 z-10 border-b text-[10px] uppercase tracking-wide ${
                  isDarkMode ? 'border-slate-700 bg-slate-900/90 text-slate-500' : 'border-slate-200 bg-slate-50/90 text-slate-400'
                }`}
              >
                <tr>
                  <th className="px-3 py-2 font-bold">Date</th>
                  <th className="px-3 py-2 font-bold">Window</th>
                  <th className="px-3 py-2 text-right font-bold">Loss</th>
                  <th className="px-3 py-2 font-bold">Section · Machinery</th>
                  <th className="px-3 py-2 font-bold">Remarks</th>
                </tr>
              </thead>
              <tbody className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-3 py-12 text-center font-semibold ${textClasses.muted}`}>
                      No incidents logged for the current filters.
                    </td>
                  </tr>
                ) : (
                  [...filteredData]
                    .sort((a, b) => (b.dateIso || '').localeCompare(a.dateIso || ''))
                    .map((row, idx) => (
                      <tr
                        key={idx}
                        className={isDarkMode ? 'transition-colors hover:bg-slate-800/50' : 'transition-colors hover:bg-slate-50'}
                      >
                        <td className={`whitespace-nowrap px-3 py-2 font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {formatDMYShort(row.dateIso)}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 font-mono ${textClasses.muted}`}>
                          {row.startTime || '—'} → {row.endTime || '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-black text-rose-500">
                          {Number(row.hours).toFixed(2)}h
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="mr-2 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                            style={{ backgroundColor: sectionColor(row.section) }}
                          >
                            {row.section || '—'}
                          </span>
                          <span className={`text-[11px] font-semibold ${textClasses.title}`}>{row.machinery || '—'}</span>
                        </td>
                        <td
                          className={`max-w-[420px] truncate px-3 py-2 text-[11px] font-medium leading-relaxed ${textClasses.muted}`}
                          title={row.remarks || ''}
                        >
                          {row.remarks || '—'}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * COMING-SOON PLACEHOLDER FOR TABS 2 & 3
 * ──────────────────────────────────────────────────────────── */
function ComingSoonTab({ tab, cardClasses, textClasses }) {
  const titleByTab = {
    'thermal': 'Thermal Reports',
    'lube-press': 'Lube & Roller Temp',
  };
  return (
    <div className={`flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border ${cardClasses}`}>
      <span className={`text-xs font-black uppercase tracking-widest ${textClasses.muted}`}>{titleByTab[tab] || tab}</span>
      <h2 className={`mt-2 text-xl font-black ${textClasses.title}`}>Coming soon</h2>
      <p className={`mt-1 max-w-md text-center text-xs font-semibold ${textClasses.muted}`}>
        This module is under construction. The Mill Outage tab is fully live and reads from the Mill Stoppages form
        submissions.
      </p>
    </div>
  );
}

function EmptyState({ message, isDarkMode, textClasses }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed text-xs font-semibold ${
        isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'
      }`}
    >
      <span>{message}</span>
      <span className={`mt-1 text-[10px] font-semibold ${textClasses.muted}`}>Adjust filters to load data.</span>
    </div>
  );
}
