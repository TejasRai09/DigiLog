import { useEffect, useMemo, useState } from 'react';
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
} from 'react-icons/md';
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
  getPresetDateRange,
} from '../../utils/distilleryBiDateRange';

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
  { id: 'outages', label: 'Mill Outage', icon: MdWarning, enabled: true },
  { id: 'equip-temp', label: 'Summary - Equipment Temp', icon: MdThermostat, enabled: false },
  { id: 'lube-press', label: 'Lube & Roller Temp', icon: MdOpacity, enabled: false },
];

const InfoTooltip = ({ definition }) => (
  <div className="group relative z-10 ml-1.5 inline-flex cursor-help items-center">
    <MdInfoOutline className="h-3.5 w-3.5 text-slate-400 transition-colors hover:text-blue-500" />
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-center text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-700">
      {definition}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
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
    <div className={`flex flex-col justify-between rounded-2xl border p-4 transition-shadow hover:shadow-md ${cardClasses}`}>
      <div className="mb-2 flex items-start justify-between">
        <div className={`flex items-center text-xs font-bold ${t.title}`}>
          {title}
          <InfoTooltip definition={definition} />
        </div>
      </div>

      <div className="flex w-full items-end justify-between">
        <div className="z-10 shrink-0">
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
          <div className="relative -mb-2 -mr-1 ml-4 h-16 min-w-[100px] max-w-[55%] flex-1 opacity-90">
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
        const { data } = await api.get('/bi/milling-operations');
        if (!cancelled) setRawData(Array.isArray(data?.records) ? data.records : []);
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

  /**
   * Data bounds anchor presets to the latest record in mill_stoppages so the dashboard
   * always lands on visible data. (Distillery cockpit uses the same convention.)
   * Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar are based on the Indian fiscal year.
   */
  const dataBounds = useMemo(() => {
    const isos = rawData.map((r) => r.dateIso).filter(Boolean).sort();
    return { min: isos[0] || null, max: isos[isos.length - 1] || null };
  }, [rawData]);

  useEffect(() => {
    if (!dataBounds.max) return;
    if (rangePreset === 'Custom') return;
    const ref = new Date(`${dataBounds.max}T12:00:00`);
    const { from, to } = getPresetDateRange(rangePreset, ref);
    setFromDate(from);
    setToDate(to);
  }, [dataBounds.max, rangePreset]);

  const toggleSection = (sec) => {
    setSelectedSections((prev) => (prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]));
  };

  const applyPreset = (preset) => {
    const ref = dataBounds.max ? new Date(`${dataBounds.max}T12:00:00`) : new Date();
    const { from, to } = getPresetDateRange(preset, ref);
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
  const filteredData = useMemo(() => {
    const from = fromDate <= toDate ? fromDate : toDate;
    const to = fromDate <= toDate ? toDate : fromDate;
    return rawData.filter((r) => {
      if (!r.dateIso) return false;
      if (r.dateIso < from || r.dateIso > to) return false;
      if (selectedSections.length === 0) return false;
      return selectedSections.includes(r.section);
    });
  }, [rawData, fromDate, toDate, selectedSections]);

  const priorRange = useMemo(
    () => computePriorPeriodRange(fromDate, toDate, rangePreset),
    [fromDate, toDate, rangePreset],
  );

  const priorData = useMemo(() => {
    return rawData.filter((r) => {
      if (!r.dateIso) return false;
      if (r.dateIso < priorRange.start || r.dateIso > priorRange.end) return false;
      if (selectedSections.length === 0) return false;
      return selectedSections.includes(r.section);
    });
  }, [rawData, priorRange, selectedSections]);

  const timeFilterLabel = rangePreset === 'Custom' ? `${formatDMYShort(fromDate)} – ${formatDMYShort(toDate)}` : rangePreset;
  const periodLabel = rangePreset === 'Custom' ? 'Custom' : rangePreset;

  const dynamicPPLabel = useMemo(() => {
    if (rangePreset === 'MTD') return 'Prev. Month';
    if (rangePreset === 'QTD') return 'Prev. Quarter';
    if (rangePreset === 'YTD') return 'Prev. Year';
    return 'Prev. Period';
  }, [rangePreset]);

  const comparisonLabel = useMemo(() => {
    const fOpt = { month: 'short', day: 'numeric' };
    const friendly = (dStr) => {
      const d = new Date(`${dStr}T12:00:00`);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', fOpt);
    };
    return `${dynamicPPLabel} (${friendly(priorRange.start)} - ${friendly(priorRange.end)})`;
  }, [dynamicPPLabel, priorRange]);

  /** Per-day stoppage totals (current + prior), aligned by index for chart overlay. */
  const dailySeries = useMemo(() => {
    const bucket = (rows) => {
      const map = new Map();
      for (const r of rows) {
        const k = r.dateIso;
        map.set(k, (map.get(k) || 0) + (Number(r.hours) || 0));
      }
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    };
    const cur = bucket(filteredData);
    const prior = bucket(priorData);
    const len = Math.max(cur.length, prior.length);
    const series = [];
    for (let i = 0; i < len; i += 1) {
      const c = cur[i];
      const p = prior[i];
      series.push({
        dateIso: c?.[0] || p?.[0] || `idx-${i}`,
        date: c ? isoToLabel(c[0]) : p ? isoToLabel(p[0]) : '',
        stoppageHours: Number(((c?.[1] ?? 0)).toFixed(2)),
        stoppageHoursCompare: Number(((p?.[1] ?? 0)).toFixed(2)),
      });
    }
    return series;
  }, [filteredData, priorData]);

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

  /** KPI aggregates for current and prior period. */
  const kpis = useMemo(() => {
    const sumHours = (rows) => rows.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
    const maxHours = (rows) => (rows.length ? Math.max(...rows.map((r) => Number(r.hours) || 0)) : 0);
    const eventCount = (rows) => rows.filter((r) => (Number(r.hours) || 0) > 0).length;

    const periodDays = (() => {
      const f = new Date(`${fromDate}T12:00:00`);
      const t = new Date(`${toDate}T12:00:00`);
      if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
      return Math.max(1, Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    })();

    const cur = {
      totalHrs: sumHours(filteredData),
      events: eventCount(filteredData),
      maxDur: maxHours(filteredData),
    };
    const prior = {
      totalHrs: sumHours(priorData),
      events: eventCount(priorData),
      maxDur: maxHours(priorData),
    };

    const totalAvailable = periodDays * 24;
    const mtbf = cur.events > 0 ? (totalAvailable - cur.totalHrs) / cur.events : totalAvailable;
    const priorMtbf = prior.events > 0 ? (totalAvailable - prior.totalHrs) / prior.events : totalAvailable;

    return { cur, prior, mtbf, priorMtbf };
  }, [filteredData, priorData, fromDate, toDate]);

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

  if (loading) {
    return (
      <div className={`flex h-[calc(100vh-3.75rem)] w-full items-center justify-center font-sans ${appClasses}`}>
        <Spinner size="lg" />
      </div>
    );
  }

  const sectionPanelClass = isDarkMode
    ? 'absolute right-0 top-full z-[320] mt-2 w-72 rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-xl'
    : 'absolute right-0 top-full z-[320] mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl';

  return (
    <div className={`flex h-[calc(100vh-3.75rem)] min-h-0 w-full flex-col overflow-hidden p-2 font-sans transition-colors duration-300 sm:p-3 ${appClasses}`}>
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

      {/* ─── HEADER ROW ───────────────────────────────────────── */}
      <div className="mb-2 flex shrink-0 flex-col gap-2">
        <Link
          to="/bi"
          className={`inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
            isDarkMode
              ? 'border-slate-600 bg-slate-800 text-blue-400 hover:bg-slate-700'
              : 'border-slate-200 bg-white text-blue-600 hover:bg-slate-50'
          }`}
        >
          <MdArrowBack className="h-3.5 w-3.5" />
          BI Control Tower
        </Link>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="grid grid-cols-[1fr_auto] items-stretch gap-x-3 gap-y-0.5">
              <h1 className={`col-start-1 row-start-1 self-center text-xl font-black tracking-tight sm:text-2xl ${headerClasses}`}>
                Milling Division Cockpit
              </h1>
              <p className={`col-start-1 row-start-2 self-center text-[11px] font-bold leading-snug ${subheadClasses}`}>
                Mill stoppage analytics · Outage telemetry
              </p>
              <div
                className={`col-start-2 row-start-1 row-span-2 flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center sm:w-[4.75rem] ${
                  isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-100'
                }`}
                title={`${filteredData.length} stoppage events — ${rangePreset === 'Custom' ? timeFilterLabel : rangePreset}`}
              >
                <span className={`text-3xl font-black leading-none tabular-nums sm:text-4xl ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  {filteredData.length}
                </span>
                <span className={`mt-1 text-[8px] font-bold leading-tight ${subheadClasses}`}>Stoppage Events</span>
                <span className={`max-w-full truncate text-[7px] font-semibold leading-tight ${textClasses.muted}`}>
                  {rangePreset === 'Custom' ? 'Custom' : rangePreset}
                </span>
              </div>
            </div>
          </div>

          {/* ─── FILTER STRIP (mirrors distillery cockpit) ───── */}
          <div className="flex flex-col gap-3 lg:items-end">
            {/* Tabs row */}
            <div className="flex flex-wrap gap-4">
              {NAV_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                const disabled = !tab.enabled;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => (disabled ? null : setActiveTab(tab.id))}
                    disabled={disabled}
                    title={disabled ? 'Coming soon' : undefined}
                    className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-500'
                        : disabled
                          ? `cursor-not-allowed border-transparent ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`
                          : `border-transparent ${textClasses.muted} ${textClasses.hover}`
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {disabled && (
                      <span
                        className={`ml-1 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                          isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              className={`relative z-[200] flex flex-wrap items-center gap-3 rounded-2xl border p-1.5 shadow-sm backdrop-blur-md sm:gap-4 ${
                isDarkMode
                  ? 'border-purple-500/30 bg-slate-800/80 shadow-purple-900/20'
                  : 'border-purple-200 bg-white/80 shadow-purple-100/50'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`rounded-xl border p-2 transition-colors ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                }`}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <MdLightMode className="h-4 w-4" /> : <MdDarkMode className="h-4 w-4" />}
              </button>

              {/* Section multi-select */}
              <div className="relative z-[310]">
                <button
                  type="button"
                  onClick={() => setIsSectionOpen(!isSectionOpen)}
                  className={`flex items-center gap-2 rounded-xl border p-1.5 px-3 text-xs font-bold transition-colors ${cardClasses} ${textClasses.muted} ${
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
              <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-1.5 sm:gap-3 ${cardClasses}`}>
                <MdCalendarMonth className={`ml-1 h-4 w-4 shrink-0 sm:ml-2 ${textClasses.muted}`} />
                <div className="flex flex-wrap gap-1">
                  {['MTD', 'QTD', 'YTD'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition-all ${
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
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition-all ${
                      rangePreset === 'Custom'
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                        : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div className={`mx-1 hidden h-6 w-px sm:block ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

              {/* From / To */}
              <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${textClasses.muted}`}>From</span>
                  <input
                    type="date"
                    value={fromDate}
                    min={dataBounds.min || undefined}
                    max={toDate}
                    onChange={handleFromChange}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                      isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${textClasses.muted}`}>To</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    max={dataBounds.max || undefined}
                    onChange={handleToChange}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                      isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BODY ─────────────────────────────────────────────── */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto max-md:pb-1">
        {activeTab === 'outages' ? (
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
    <div className="space-y-3">
      {/* KPI ROW */}
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4 xl:gap-2">
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

      {/* DAILY TREND */}
      <div className={`rounded-2xl border p-4 ${cardClasses}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <h3 className={`text-sm font-black ${textClasses.title}`}>Stoppages Daily Trend</h3>
            <InfoTooltip definition="Daily total stoppage hours in the selected period vs the same number of days from the prior period." />
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
            <InfoTooltip definition="Cumulative stoppage hours grouped by mill section over the active selection." />
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
            <InfoTooltip definition="Cumulative downtime hours per individual machine for the current filters." />
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
              <InfoTooltip definition="Chronological list of mill stoppage entries, with section, machinery and remark." />
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
  );
}

/* ──────────────────────────────────────────────────────────────
 * COMING-SOON PLACEHOLDER FOR TABS 2 & 3
 * ──────────────────────────────────────────────────────────── */
function ComingSoonTab({ tab, cardClasses, textClasses }) {
  const titleByTab = {
    'equip-temp': 'Summary - Equipment Temp',
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
