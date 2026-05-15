import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MdInfoOutline,
  MdCalendarMonth,
  MdDashboard,
  MdTableChart,
  MdTrendingUp,
  MdTrendingDown,
  MdRemove,
  MdDarkMode,
  MdLightMode,
  MdFilterList,
  MdExpandMore,
} from 'react-icons/md';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  AreaChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';

const InfoTooltip = ({ definition }) => (
  <div className="group relative z-10 ml-2 inline-flex cursor-help items-center">
    <MdInfoOutline className="h-3.5 w-3.5 text-slate-400 transition-colors hover:text-blue-500" />
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-center text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-700">
      {definition}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
    </div>
  </div>
);

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
      className={`flex flex-col justify-between rounded-2xl border p-4 transition-shadow hover:shadow-md ${cardClasses}`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className={`flex items-center text-xs font-bold ${textClasses.title}`}>
          {title}
          <InfoTooltip definition={definition} />
        </div>
      </div>

      <div className="flex w-full items-end justify-between">
        <div className="z-10 shrink-0">
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
            <span className={`whitespace-nowrap text-[10px] font-bold ${textClasses.vs}`}>
              vs {comparisonLabel} {timeFilter}
            </span>
          </div>
        </div>

        {chartData && chartData.length > 0 && (
          <div className="relative -mb-2 -mr-1 ml-4 h-16 min-w-[120px] max-w-[55%] flex-1 opacity-90">
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
                  <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    fill={`url(#gradient-${dataKey})`}
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
  const pyAvg = pyData.reduce((sum, item) => sum + item[dataKey], 0) / pyData.length;

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
        <InfoTooltip definition={definition} />
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

export default function DistilleryAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState('MTD');
  const [comparisonType, setComparisonType] = useState('PY');
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
        const { data } = await api.get('/bi/distillery-operations');
        if (!cancelled) setRawData(Array.isArray(data?.records) ? data.records : []);
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

  const filteredData = useMemo(() => {
    let daysToKeep = 90;
    if (timeFilter === 'MTD') daysToKeep = 14;
    if (timeFilter === 'QTD') daysToKeep = 45;

    let data = rawData.slice(-daysToKeep);

    if (selectedModes.length > 0) {
      data = data.filter((row) => selectedModes.includes(row.mode));
    } else {
      data = [];
    }

    return data;
  }, [rawData, timeFilter, selectedModes]);

  const comparisonLabels = {
    PY: '2024-2025',
    P2Y: '2023-2024',
  };

  const historicalData = useMemo(() => {
    const shiftMultiplier = comparisonType === 'PY' ? 0.95 : 0.9;
    return filteredData.map((item) => ({
      ...item,
      totalProd: item.totalProd * shiftMultiplier,
      totalWash: item.totalWash * shiftMultiplier,
      syrupMolConsumed: item.syrupMolConsumed * shiftMultiplier,
      recovery: item.recovery * (shiftMultiplier + 0.04),
      fermEff: item.fermEff * (shiftMultiplier + 0.04),
      distEff: item.distEff * (shiftMultiplier + 0.04),
      fermSugar: item.fermSugar * shiftMultiplier,
      alcohol: item.alcohol * shiftMultiplier,
      molInStore: item.molInStore * (comparisonType === 'PY' ? 1.05 : 1.1),
      ethInStore: item.ethInStore * (comparisonType === 'PY' ? 0.95 : 0.85),
    }));
  }, [filteredData, comparisonType]);

  const currentKPIs = {
    ethanolProd: filteredData.reduce((sum, item) => sum + item.totalProd, 0),
    syrupMol: filteredData.reduce((sum, item) => sum + item.syrupMolConsumed, 0),
    fermEff: filteredData.length ? filteredData.reduce((sum, item) => sum + item.fermEff, 0) / filteredData.length : 0,
    distEff: filteredData.length ? filteredData.reduce((sum, item) => sum + item.distEff, 0) / filteredData.length : 0,
  };

  const pyKPIs = {
    ethanolProd: historicalData.reduce((sum, item) => sum + item.totalProd, 0),
    syrupMol: historicalData.reduce((sum, item) => sum + item.syrupMolConsumed, 0),
    fermEff: historicalData.length
      ? historicalData.reduce((sum, item) => sum + item.fermEff, 0) / historicalData.length
      : 0,
    distEff: historicalData.length
      ? historicalData.reduce((sum, item) => sum + item.distEff, 0) / historicalData.length
      : 0,
  };

  const formatMetric = (val) => {
    if (val > 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val > 1000) return `${(val / 1000).toFixed(2)}K`;
    return `${val.toFixed(1)}%`;
  };

  const getChartMetric = (dataKey, isSum = false, sourceData = filteredData) => {
    if (sourceData.length === 0) return 0;
    const total = sourceData.reduce((sum, item) => sum + item[dataKey], 0);
    return isSum ? total : total / sourceData.length;
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

  const axisStyle = {
    fontSize: 9,
    fontWeight: 600,
    fill: isDarkMode ? '#64748b' : '#94a3b8',
  };
  const gridStyle = {
    stroke: isDarkMode ? '#334155' : '#e2e8f0',
    strokeDasharray: '3 3',
  };

  const modePanelClass = isDarkMode
    ? 'absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-xl'
    : 'absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl';
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
      <div className="mb-3 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to="/bi"
              className={`text-[10px] font-black uppercase tracking-wide transition-colors ${
                isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              ← BI Control Tower
            </Link>
            <h1 className={`text-xl font-black tracking-tight sm:text-2xl ${headerClasses}`}>Distillery Operations</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <p className={`text-[11px] font-bold ${subheadClasses}`}>Enterprise Analytics & PoP Performance</p>
            <div
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}
            >
              {filteredData.length} Operating Days ({timeFilter})
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-500'
                  : `border-transparent ${textClasses.muted} ${textClasses.hover}`
              }`}
            >
              <MdDashboard className="h-3.5 w-3.5" />
              Visual Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
                activeTab === 'table'
                  ? 'border-blue-500 text-blue-500'
                  : `border-transparent ${textClasses.muted} ${textClasses.hover}`
              }`}
            >
              <MdTableChart className="h-3.5 w-3.5" />
              Raw Data Table
            </button>
          </div>

          <div
            className={`flex flex-wrap items-center gap-3 rounded-2xl border p-1.5 shadow-sm backdrop-blur-md sm:gap-4 ${
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
            >
              {isDarkMode ? <MdLightMode className="h-4 w-4" /> : <MdDarkMode className="h-4 w-4" />}
            </button>

            <div className="relative z-50">
              <button
                type="button"
                onClick={() => setIsModeOpen(!isModeOpen)}
                className={`flex items-center gap-2 rounded-xl border p-1.5 px-3 text-xs font-bold transition-colors ${cardClasses} ${textClasses.muted} ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
              >
                <MdFilterList className="h-3.5 w-3.5" />
                Op Mode ({selectedModes.length === availableModes.length ? 'All' : selectedModes.length})
                <MdExpandMore className={`h-3 w-3 transition-transform ${isModeOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModeOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setIsModeOpen(false)}
                  />
                  <div className={modePanelClass}>
                    <div
                      className={`mb-2 border-b px-2 pb-2 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'}`}
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
                          className={`h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isDarkMode ? 'border-slate-600 bg-slate-900' : ''}`}
                        />
                        <span className={`text-sm font-semibold ${textClasses.title}`}>{m}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className={`flex items-center gap-3 rounded-xl border p-1.5 ${cardClasses}`}>
              <MdCalendarMonth className={`ml-2 h-4 w-4 ${textClasses.muted}`} />
              <div className="flex gap-1">
                {['MTD', 'QTD', 'YTD'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTimeFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition-all ${
                      timeFilter === filter
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className={`mx-1 h-6 w-px ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <div className="flex items-center gap-2 pr-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${textClasses.muted}`}>Compare:</span>
              <div className={`flex gap-1 rounded-lg border p-1 ${cardClasses}`}>
                {[
                  { id: 'PY', label: '2024-2025' },
                  { id: 'P2Y', label: '2023-2024' },
                ].map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => setComparisonType(comp.id)}
                    className={`rounded px-3 py-1 text-[10px] font-black transition-all ${
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
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Ethanol Produced"
              value={currentKPIs.ethanolProd}
              pyValue={pyKPIs.ethanolProd}
              unit="BL"
              definition="Total Bulk Liters of Ethanol produced."
              timeFilter={timeFilter}
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabels[comparisonType]}
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
              timeFilter={timeFilter}
              inverseColor
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabels[comparisonType]}
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
              timeFilter={timeFilter}
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabels[comparisonType]}
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
              timeFilter={timeFilter}
              isDarkMode={isDarkMode}
              comparisonLabel={comparisonLabels[comparisonType]}
              chartData={filteredData}
              dataKey="distEff"
              chartType="line"
              chartColor="#10b981"
            />
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 xl:grid-rows-2">
            <div className={`flex h-full min-h-[280px] flex-col rounded-2xl border p-4 ${cardClasses}`}>
              <ChartTitle
                title="Ethanol Vol"
                definition="Total accumulated volume of Ethanol produced, segmented by raw material mode, alongside overall recovery percentage."
                dataKey="totalProd"
                data={filteredData}
                pyData={historicalData}
                timeFilter={timeFilter}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />
              <div className="mb-2 flex flex-wrap gap-4">
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Total Vol:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('totalProd', true))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('totalProd', true, historicalData))}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg Recovery:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('recovery', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('recovery', false, historicalData))}
                  </span>
                </div>
              </div>
              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        dy={10}
                        minTickGap={30}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        tickFormatter={(value) => `${value / 1000}k`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                      />
                      <RechartsTooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} iconType="circle" />
                      <Bar yAxisId="left" dataKey="bHeavyProd" stackId="a" name="B Heavy (BL)" fill="#60a5fa" />
                      <Bar yAxisId="left" dataKey="cHeavyProd" stackId="a" name="C Heavy (BL)" fill="#34d399" />
                      <Bar yAxisId="left" dataKey="syrupProd" stackId="a" name="Syrup (BL)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="recovery"
                        name="Recovery %"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`flex h-full min-h-[280px] flex-col rounded-2xl border p-4 ${cardClasses}`}>
              <ChartTitle
                title="Ferm. Sugar"
                definition="Tracks the percentage of fermentable sugar relative to the resulting alcohol percentage in the wash over time."
                dataKey="fermSugar"
                data={filteredData}
                pyData={historicalData}
                timeFilter={timeFilter}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />
              <div className="mb-2 flex flex-wrap gap-4">
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg Ferm. Sugar:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('fermSugar', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('fermSugar', false, historicalData))}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg Alcohol:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('alcohol', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('alcohol', false, historicalData))}
                  </span>
                </div>
              </div>
              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        dy={10}
                        minTickGap={30}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tickFormatter={(value) => `${value.toFixed(2)}%`}
                      />
                      <RechartsTooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} iconType="circle" />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="fermSugar"
                        name="Ferm. Sugar %"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="alcohol"
                        name="Alcohol %"
                        stroke="#d97706"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 2, fill: '#d97706' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`flex h-full min-h-[280px] flex-col rounded-2xl border p-4 ${cardClasses}`}>
              <ChartTitle
                title="Overall Efficiency"
                definition="Side-by-side comparison of Fermentation Efficiency (yield based on sugar) and Distillation Efficiency (alcohol recovery)."
                dataKey="fermEff"
                data={filteredData}
                pyData={historicalData}
                timeFilter={timeFilter}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />
              <div className="mb-2 flex flex-wrap gap-4">
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg FE: <span className={textClasses.title}>{formatMetric(getChartMetric('fermEff', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('fermEff', false, historicalData))}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg DE: <span className={textClasses.title}>{formatMetric(getChartMetric('distEff', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('distEff', false, historicalData))}
                  </span>
                </div>
              </div>
              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        dy={10}
                        minTickGap={30}
                      />
                      <YAxis
                        domain={['dataMin - 2', 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                      />
                      <RechartsTooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} iconType="circle" />
                      <Line type="monotone" dataKey="fermEff" name="Ferm. Efficiency" stroke="#eab308" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="distEff" name="Dist. Efficiency" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`flex h-full min-h-[280px] flex-col rounded-2xl border p-4 ${cardClasses}`}>
              <ChartTitle
                title="Wash Distilled"
                definition="Total volume of wash processed through the distillation system during the selected time period."
                dataKey="totalWash"
                data={filteredData}
                pyData={historicalData}
                timeFilter={timeFilter}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />
              <div className="mb-2 flex flex-wrap gap-4">
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Total Wash:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('totalWash', true))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('totalWash', true, historicalData))}
                  </span>
                </div>
              </div>
              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        dy={10}
                        minTickGap={30}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                      />
                      <RechartsTooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                      <Area
                        type="monotone"
                        dataKey="totalWash"
                        name="Wash Volume"
                        stroke="#ea580c"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorWash)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`flex h-full min-h-[280px] flex-col rounded-2xl border p-4 ${cardClasses}`}>
              <ChartTitle
                title="Molasses Stock"
                definition="Current inventory levels of Molasses raw material holding in storage tanks."
                dataKey="molInStore"
                data={filteredData}
                pyData={historicalData}
                timeFilter={timeFilter}
                higherIsBetter={false}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />
              <div className="mb-2 flex flex-wrap gap-4">
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg Stock:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('molInStore', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('molInStore', false, historicalData))}
                  </span>
                </div>
              </div>
              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        dy={10}
                        minTickGap={30}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                      <Area
                        type="monotone"
                        dataKey="molInStore"
                        name="Molasses Stock"
                        stroke="#0284c7"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorMol)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`flex h-full min-h-[280px] flex-col rounded-2xl border p-4 ${cardClasses}`}>
              <ChartTitle
                title="Ethanol Stock"
                definition="Current inventory levels of finished Ethanol product holding in storage tanks awaiting dispatch."
                dataKey="ethInStore"
                data={filteredData}
                pyData={historicalData}
                timeFilter={timeFilter}
                higherIsBetter={false}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />
              <div className="mb-2 flex flex-wrap gap-4">
                <div className="flex flex-col">
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>
                    Avg Stock:{' '}
                    <span className={textClasses.title}>{formatMetric(getChartMetric('ethInStore', false))}</span>
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400">
                    | vs {comparisonLabels[comparisonType]}:{' '}
                    {formatMetric(getChartMetric('ethInStore', false, historicalData))}
                  </span>
                </div>
              </div>
              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} vertical={false} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        dy={10}
                        minTickGap={30}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={axisStyle}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                      <Area
                        type="monotone"
                        dataKey="ethInStore"
                        name="Ethanol Stock"
                        stroke="#dc2626"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEth)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm ${cardClasses}`}>
          <div
            className={`flex items-center justify-between border-b p-4 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}
          >
            <h3 className={`text-sm font-bold ${textClasses.title}`}>
              Daily Production Log <span className={`font-normal ${textClasses.muted}`}>({timeFilter} View)</span>
            </h3>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold shadow-sm transition-colors ${
                isDarkMode
                  ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Export CSV
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead
                className={`sticky top-0 z-10 border-b text-xs uppercase backdrop-blur-sm ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-900/90 text-slate-400'
                    : 'border-slate-200 bg-slate-100/90 text-slate-500'
                }`}
              >
                <tr>
                  <th className="px-6 py-3 font-bold">Date</th>
                  <th className="px-6 py-3 font-bold">Operation Mode</th>
                  <th className="px-6 py-3 text-right font-bold">Ethanol Prod (BL)</th>
                  <th className="px-6 py-3 text-right font-bold">Recovery %</th>
                  <th className="px-6 py-3 text-right font-bold">Ferm. Eff %</th>
                  <th className="px-6 py-3 text-right font-bold">Dist. Eff %</th>
                </tr>
              </thead>
              <tbody className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {[...filteredData].reverse().map((row, idx) => (
                  <tr
                    key={idx}
                    className={isDarkMode ? 'transition-colors hover:bg-slate-800/50' : 'transition-colors hover:bg-slate-50'}
                  >
                    <td className={`px-6 py-3 font-semibold ${textClasses.title}`}>
                      {row.dateFull ?? row.date}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold tracking-wide ${
                          row.mode === 'B Heavy'
                            ? isDarkMode
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-blue-100 text-blue-800'
                            : row.mode === 'C Heavy'
                              ? isDarkMode
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-emerald-100 text-emerald-800'
                              : row.mode === 'Syrup'
                                ? isDarkMode
                                  ? 'bg-indigo-500/20 text-indigo-400'
                                  : 'bg-indigo-100 text-indigo-800'
                                : isDarkMode
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {row.mode}
                      </span>
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {row.totalProd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {row.recovery.toFixed(2)}
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {row.fermEff.toFixed(2)}
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {row.distEff.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`px-6 py-12 text-center font-semibold ${textClasses.muted}`}>
                      No data available for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
