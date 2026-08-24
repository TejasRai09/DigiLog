import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import { MdArrowBack, MdGrass } from 'react-icons/md';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiKeyMetricBox, BiFilterBarLayout } from '../../components/bi/BiLayoutElements';
import BiKpiCard from '../../components/bi/BiKpiCard';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Filter,
  Calendar,
  Info,
  Search,
  Sun,
  Moon,
  Sprout,
  Truck,
  X
} from 'lucide-react';
import {
  formatYMD,
  resolveDashboardToDate,
} from '../../utils/distilleryBiDateRange';
import {
  applyCockpitCompareSelection,
  buildCockpitComparisonOptions,
  ensureCompareSelectionValid,
  getCockpitPresetDateRange,
  getCockpitSeasonLabels,
  resolveCockpitCompareRange,
} from '../../utils/biCockpitDateFilters';

// ─── FIELD MOCK DATA (unchanged) ────────────────────────────────
const fieldBrixTrendData = [
  { date: 'Jan 24', topBrix: 18.2, midBrix: 19.1, bottomBrix: 19.5 },
  { date: 'Feb 24', topBrix: 19.5, midBrix: 20.2, bottomBrix: 20.8 },
  { date: 'Mar 24', topBrix: 20.1, midBrix: 20.5, bottomBrix: 21.0 },
  { date: 'Apr 24', topBrix: 19.8, midBrix: 20.1, bottomBrix: 20.6 },
  { date: 'May 24', topBrix: 17.2, midBrix: 17.8, bottomBrix: 18.2 },
  { date: 'Jun 24', topBrix: 14.1, midBrix: 14.5, bottomBrix: 15.0 },
  { date: 'Jul 24', topBrix: 11.5, midBrix: 11.8, bottomBrix: 12.1 },
  { date: 'Aug 24', topBrix: 8.2, midBrix: 8.5, bottomBrix: 8.9 },
  { date: 'Sep 24', topBrix: 5.1, midBrix: 5.4, bottomBrix: 5.7 },
  { date: 'Oct 24', topBrix: 3.2, midBrix: 3.5, bottomBrix: 3.8 },
  { date: 'Nov 24', topBrix: 18.9, midBrix: 19.87, bottomBrix: 20.4 },
];

const cropConditionData = [
  { name: 'Good', value: 2140, color: '#3b82f6' },
  { name: 'Diseased', value: 0, color: '#93c5fd' },
];

const soilTypeMaturityData = [
  { soil: 'Loam', samples: 1800, maturity: 0.967 },
  { soil: 'Sandy Loam', samples: 450, maturity: 0.981 },
  { soil: 'Sandy', samples: 120, maturity: 0.917 },
  { soil: 'Clay', samples: 90, maturity: 0.930 },
];

const landAreaMaturityData = [
  { name: 'Lowland', value: 49.29, maturity: 0.96, color: '#1d4ed8' },
  { name: 'Upland', value: 50.71, maturity: 0.99, color: '#60a5fa' },
];

const cropVarietyData = [
  { variety: 'CO0238', samples: 1400, maturity: 0.97 },
  { variety: 'CO0118', samples: 400, maturity: 0.99 },
  { variety: 'COLK94184', samples: 180, maturity: 0.94 },
  { variety: 'Others', samples: 160, maturity: 0.96 },
  { variety: 'COS8272', samples: 30, maturity: 0.97 },
  { variety: 'COPK5191', samples: 20, maturity: 0.88 },
];

// ─── Yard condition colours (Power BI palette) ───────────────────
const CONDITION_COLORS = {
  Clean: '#3b82f6',
  Roots: '#8b5cf6',
  'Dry Leaves': '#f59e0b',
  Muddy: '#ef4444',
};

// ─── Shared chart tooltip ────────────────────────────────────────
const CustomChartTooltip = ({ active, payload, label, darkMode }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-2.5 rounded-lg shadow-xl text-[11px] backdrop-blur-md border ${darkMode
          ? 'bg-slate-900/95 text-white border-slate-700/50'
          : 'bg-white/95 text-slate-800 border-slate-200 shadow-slate-200/50'
        }`}>
        <p className={`font-semibold border-b pb-1 mb-1 ${darkMode ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-100'}`}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{entry.name}:</span>
            </span>
            <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {typeof entry.value === 'number' && entry.value % 1 !== 0
                ? entry.value.toFixed(2)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ─── MetricCard (used in Field tab) ─────────────────────────────
const MetricCard = ({ title, value, unit, change, changeText, isNegative, sparklineData, sparklineKey, sparklineColor = '#3b82f6', subtitle }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-3 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase flex items-center gap-1">
          {title}
          <Info className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-1 mt-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</span>
          {unit && <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{unit}</span>}
        </div>
        {sparklineData && (
          <div className="w-16 sm:w-20 h-7">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`sparkGrad-${sparklineKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={sparklineColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey={sparklineKey} stroke={sparklineColor} strokeWidth={1.5}
                  fillOpacity={1} fill={`url(#sparkGrad-${sparklineKey})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
    <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
      {change !== undefined && (
        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold text-[10px] ${isNegative
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
          }`}>
          {isNegative ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
          <span>{change}</span>
        </div>
      )}
      <span className="text-slate-500 dark:text-slate-400 font-medium truncate ml-1 text-[10px]">
        {changeText || subtitle || 'vs Prev.'}
      </span>
    </div>
  </div>
);

const formatVariance = (v) => {
  if (v == null || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${abs}`;
};

const ChangeBadge = ({ change, variance, isUp, label }) => {
  if (change === undefined || change === null || Number.isNaN(Number(change))) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        No prior data
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold
      ${isUp
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {variance != null && <span className="mr-0.5">{formatVariance(variance)}</span>}
      ({Number(change).toFixed(2)}%)
      {label ? <span className="ml-1 font-medium opacity-80">{label}</span> : null}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Main Dashboard Component
// ═══════════════════════════════════════════════════════════════════
export default function BrixSamplingDashboard() {
  const [activeTab, setActiveTab] = useState('yard');
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Shared Filter State ────────────────────────────────────────
  // Per-tab From/To so Field and Yard each show their own sampling span
  const [fieldDates, setFieldDates] = useState({ from: '', to: '' });
  const [yardDates, setYardDates] = useState({ from: '', to: '' });
  const [rangePreset, setRangePreset] = useState('STD'); // MTD | STD | WTD | Custom
  const [comparisonType, setComparisonType] = useState('PP');
  const [seasonMapping, setSeasonMapping] = useState({});
  // Per-tab sampling date bounds (field → brix_field_sampling.Date, yard → brix_yard_sampling.Date)
  const [fieldDateRange, setFieldDateRange] = useState({ min: '', max: '' });
  const [yardDateRange, setYardDateRange] = useState({ min: '', max: '' });
  const fieldRangeSeededRef = useRef(false);
  const yardRangeSeededRef = useRef(false);

  const toInputDate = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    if (v instanceof Date && !isNaN(v)) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, '0');
      const d = String(v.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
  };

  const activeDateRange = activeTab === 'field' ? fieldDateRange : yardDateRange;
  const dbMinDateStr = activeDateRange.min;
  const dbMaxDateStr = activeDateRange.max;
  const dbMaxDate = useMemo(
    () => (dbMaxDateStr ? new Date(`${dbMaxDateStr}T00:00:00`) : null),
    [dbMaxDateStr],
  );

  const activeDates = activeTab === 'field' ? fieldDates : yardDates;
  const dateFrom = activeDates.from;
  const dateTo = activeDates.to;
  const setActiveDates = activeTab === 'field' ? setFieldDates : setYardDates;

  const clampIso = (iso, minStr, maxStr) => {
    if (!iso) return iso;
    if (minStr && iso < minStr) return minStr;
    if (maxStr && iso > maxStr) return maxStr;
    return iso;
  };

  const clampToDb = useCallback((iso) => clampIso(iso, dbMinDateStr, dbMaxDateStr), [dbMinDateStr, dbMaxDateStr]);

  const setDateFrom = useCallback((value) => {
    setActiveDates((prev) => {
      const next = typeof value === 'function' ? value(prev.from) : value;
      const from = clampToDb(next);
      return prev.from === from ? prev : { ...prev, from };
    });
  }, [setActiveDates, clampToDb]);

  const setDateTo = useCallback((value) => {
    setActiveDates((prev) => {
      const next = typeof value === 'function' ? value(prev.to) : value;
      const to = clampToDb(next);
      return prev.to === to ? prev : { ...prev, to };
    });
  }, [setActiveDates, clampToDb]);

  const applyStatsDateRange = useCallback((dateRange, tab) => {
    if (!dateRange || (tab !== 'field' && tab !== 'yard')) return;
    const minStr = toInputDate(dateRange.minDate);
    const maxStr = toInputDate(dateRange.maxDate);
    if (!minStr && !maxStr) return;

    const setRange = tab === 'field' ? setFieldDateRange : setYardDateRange;
    const setDates = tab === 'field' ? setFieldDates : setYardDates;
    const seededRef = tab === 'field' ? fieldRangeSeededRef : yardRangeSeededRef;

    setRange((prev) => {
      const next = { min: minStr || prev.min, max: maxStr || prev.max };
      if (prev.min === next.min && prev.max === next.max) return prev;
      return next;
    });

    setDates((prev) => {
      const min = minStr || '';
      const max = maxStr || '';

      // First load for this tab: default to STD anchored to today-or-latest-data
      if (!seededRef.current && min && max) {
        seededRef.current = true;
        const toIso = resolveDashboardToDate(null, max);
        const ref = toIso ? new Date(`${toIso}T12:00:00`) : new Date();
        const std = getCockpitPresetDateRange('STD', ref, seasonMapping);
        const nextFrom = clampIso(std.from, min, max);
        const nextTo = clampIso(std.to, min, max);
        return { from: nextFrom, to: nextTo };
      }

      const from = prev.from ? clampIso(prev.from, min, max) : min;
      const to = prev.to ? clampIso(prev.to, min, max) : max;
      if (prev.from === from && prev.to === to) return prev;
      return { from, to };
    });
  }, [seasonMapping]);

  // Cockpit-style season compare labels from Season Mapping
  const seasonLabels = useMemo(() => {
    const refIso = dateTo || dbMaxDateStr || formatYMD(new Date());
    return getCockpitSeasonLabels(refIso, seasonMapping);
  }, [dateTo, dbMaxDateStr, seasonMapping]);

  /** Avoid setState when mapping is unchanged — otherwise params recreate and refetch forever. */
  const mergeSeasonMapping = useCallback((next) => {
    if (!next || typeof next !== 'object') return;
    setSeasonMapping((prev) => {
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch {
        /* fall through */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    api.get('/bi/settings')
      .then((r) => {
        if (r.data?.seasonMapping && typeof r.data.seasonMapping === 'object') {
          mergeSeasonMapping(r.data.seasonMapping);
        }
      })
      .catch(() => { });
  }, [mergeSeasonMapping]);

  const comparisonOptions = useMemo(() => {
    const refIso = dateTo || dbMaxDateStr || formatYMD(new Date());
    return buildCockpitComparisonOptions(rangePreset, seasonMapping, refIso);
  }, [rangePreset, seasonMapping, dateTo, dbMaxDateStr]);

  useEffect(() => {
    ensureCompareSelectionValid(comparisonType, comparisonOptions, setComparisonType);
  }, [comparisonType, comparisonOptions]);

  const onCompareSelect = useCallback((nextId) => {
    applyCockpitCompareSelection({
      nextId,
      fromDate: dateFrom,
      toDate: dateTo,
      rangePreset,
      seasonMapping,
      seasonLabels,
      dataMin: dbMinDateStr,
      dataMax: dbMaxDateStr,
      setComparisonType,
    });
  }, [dateFrom, dateTo, rangePreset, seasonMapping, seasonLabels, dbMinDateStr, dbMaxDateStr]);

  /** Resolve compare From–To (milling cockpit: STD = day 1→N). */
  const resolveCompareRange = useCallback((from, to) => {
    if (!from || !to) return null;
    const resolved = resolveCockpitCompareRange(
      from,
      to,
      comparisonType,
      seasonLabels,
      seasonMapping,
      rangePreset,
    );
    if (!resolved?.start || !resolved?.end) return null;
    return {
      from: resolved.start,
      to: resolved.end,
      label: resolved.label || (comparisonType === 'PP' ? 'Prev. Period' : ''),
    };
  }, [comparisonType, rangePreset, seasonLabels, seasonMapping]);

  const activeCompareRange = useMemo(
    () => resolveCompareRange(dateFrom, dateTo),
    [resolveCompareRange, dateFrom, dateTo],
  );

  const compareBadgeLabel = activeCompareRange?.label
    ? `vs ${activeCompareRange.label}`
    : undefined;

  // ─── Field live-data state ──────────────────────────────────────
  const [fieldTestType, setFieldTestType] = useState('All');
  const [testTypes, setTestTypes] = useState([]);
  const [fieldStats, setFieldStats] = useState(null);
  const [fieldTrend, setFieldTrend] = useState([]);
  const [fieldCondTrend, setFieldCondTrend] = useState([]);
  const [fieldCropCond, setFieldCropCond] = useState([]);
  const [fieldSoilType, setFieldSoilType] = useState([]);
  const [fieldLandType, setFieldLandType] = useState([]);
  const [fieldVariety, setFieldVariety] = useState([]);
  const [fieldLoading, setFieldLoading] = useState(false);

  const fieldParams = useMemo(() => {
    const p = new URLSearchParams();
    if (fieldDates.from) p.set('from', fieldDates.from);
    if (fieldDates.to) p.set('to', fieldDates.to);
    if (fieldTestType && fieldTestType !== 'All') p.set('testType', fieldTestType);
    const cmp = resolveCompareRange(fieldDates.from, fieldDates.to);
    if (cmp?.from) p.set('pyFrom', cmp.from);
    if (cmp?.to) p.set('pyTo', cmp.to);
    return p.toString() ? `?${p.toString()}` : '';
  }, [fieldDates.from, fieldDates.to, fieldTestType, resolveCompareRange]);

  const fetchFieldData = useCallback(async (signal) => {
    setFieldLoading(true);
    let keepLoading = false;
    try {
      const cfg = signal ? { signal } : undefined;
      const { data } = await api.get(`/bi/brix-field/dashboard${fieldParams}`, cfg);
      if (signal?.aborted) return;

      if (data.seasonMapping) mergeSeasonMapping(data.seasonMapping);
      if (data.dateRange) applyStatsDateRange(data.dateRange, 'field');
      if (Array.isArray(data.testTypes) && data.testTypes.length) setTestTypes(data.testTypes);

      // First hit seeds From/To only — skip full chart work until dates exist
      if (data.seedOnly) {
        keepLoading = true;
        return;
      }

      setFieldStats(data.stats);
      setFieldTrend(data.trend || []);
      setFieldCondTrend(data.conditionTrend || []);

      const cropRaw = data.cropCondition || [];
      const colors = { Good: '#3b82f6', Diseased: '#ef4444', Dry: '#f59e0b' };
      setFieldCropCond(cropRaw.map((r) => ({
        ...r,
        name: r.condition,
        value: r.count,
        color: colors[r.condition] || '#94a3b8',
      })));

      setFieldSoilType(data.soilType || []);

      const landRaw = data.landType || [];
      const landColors = ['#1d4ed8', '#60a5fa', '#3b82f6', '#93c5fd'];
      setFieldLandType(landRaw.map((r, i) => ({
        ...r,
        value: r.samples,
        color: landColors[i % landColors.length],
      })));

      setFieldVariety(data.variety || []);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      console.error('Field data fetch failed', e);
    } finally {
      if (!signal?.aborted && !keepLoading) setFieldLoading(false);
    }
  }, [fieldParams, applyStatsDateRange, mergeSeasonMapping]);

  // Fetch Field charts only while that tab is active (debounced + abortable)
  useEffect(() => {
    if (activeTab !== 'field') return undefined;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetchFieldData(ac.signal);
    }, 80);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [activeTab, fetchFieldData]);

  // ─── Yard live-data state ───────────────────────────────────────
  const [yardDelivery, setYardDelivery] = useState('All');
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [yardStats, setYardStats] = useState(null);
  const [yardTrend, setYardTrend] = useState([]);
  const [yardVehicle, setYardVehicle] = useState([]);
  const [yardCondition, setYardCondition] = useState([]);
  const [yardCenters, setYardCenters] = useState([]);
  const [yardLoading, setYardLoading] = useState(false);

  // Build query string from filter state
  const yardParams = useMemo(() => {
    const p = new URLSearchParams();
    if (yardDates.from) p.set('from', yardDates.from);
    if (yardDates.to) p.set('to', yardDates.to);
    if (yardDelivery && yardDelivery !== 'All') p.set('deliveryPoint', yardDelivery);
    const cmp = resolveCompareRange(yardDates.from, yardDates.to);
    if (cmp?.from) p.set('pyFrom', cmp.from);
    if (cmp?.to) p.set('pyTo', cmp.to);
    return p.toString() ? `?${p.toString()}` : '';
  }, [yardDates.from, yardDates.to, yardDelivery, resolveCompareRange]);

  const fetchYardData = useCallback(async (signal) => {
    setYardLoading(true);
    let keepLoading = false;
    try {
      const cfg = signal ? { signal } : undefined;
      const { data } = await api.get(`/bi/brix-yard/dashboard${yardParams}`, cfg);
      if (signal?.aborted) return;

      if (data.seasonMapping) mergeSeasonMapping(data.seasonMapping);
      if (data.dateRange) applyStatsDateRange(data.dateRange, 'yard');
      if (Array.isArray(data.deliveryPoints) && data.deliveryPoints.length) {
        setDeliveryPoints(data.deliveryPoints);
      }

      if (data.seedOnly) {
        keepLoading = true;
        return;
      }

      setYardStats(data.stats);
      setYardTrend(data.trend || []);
      setYardVehicle(data.vehicle || []);

      const rawCond = data.condition || [];
      setYardCondition(rawCond.filter((r) => r.condition).map((r) => ({
        ...r,
        name: r.condition,
        value: r.count,
        color: CONDITION_COLORS[r.condition] || '#94a3b8',
      })));

      setYardCenters(data.centers || []);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      console.error('Yard data fetch failed', e);
    } finally {
      if (!signal?.aborted && !keepLoading) setYardLoading(false);
    }
  }, [yardParams, applyStatsDateRange, mergeSeasonMapping]);

  // Fetch Yard charts only while that tab is active (debounced + abortable)
  useEffect(() => {
    if (activeTab !== 'yard') return undefined;
    const ac = new AbortController();
    const t = setTimeout(() => {
      fetchYardData(ac.signal);
    }, 80);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [activeTab, fetchYardData]);

  const handleQuickDate = (type) => {
    try {
      const toIso = resolveDashboardToDate(null, dbMaxDateStr);
      const today = toIso ? new Date(`${toIso}T12:00:00`) : new Date();
      if (type === 'Custom') {
        setRangePreset('Custom');
        return;
      }
      const { from, to } = getCockpitPresetDateRange(type, today, seasonMapping);
      setDateFrom(clampToDb(from));
      setDateTo(clampToDb(to));
      setRangePreset(type);
    } catch (err) {
      console.error('Error in handleQuickDate:', err);
    }
  };

  // ─── Shared chart colours ───────────────────────────────────────
  const tickColor = darkMode ? '#94a3b8' : '#64748b';
  const gridStroke = darkMode ? '#334155' : '#e2e8f0';
  const lineBlue = darkMode ? '#60a5fa' : '#2563eb';
  const lineDark = darkMode ? '#93c5fd' : '#1d4ed8';

  // ─── Center-wise search ─────────────────────────────────────────
  const filteredCenters = useMemo(() =>
    yardCenters.filter(c =>
      (c.center || '').toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [searchQuery, yardCenters]
  );

  return (
    <div className={`h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      } transition-colors duration-200 font-sans`}>

      <div className="mb-2 flex shrink-0 flex-col gap-2 p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BiDashboardHeader
            title="Brix Sampling Analytics"
            subtitle="Field & Yard Intelligence · Crop Maturity"
            icon={MdGrass}
            iconColor="#059669"
            isDarkMode={darkMode}
          />
          <div className="flex items-center gap-4">
            <BiKeyMetricBox
              value={activeTab === 'field' ? (fieldStats?.totalSamples?.value ?? 0) : (yardStats?.totalSamples?.value ?? 0)}
              title={activeTab === 'field' ? "Field Samples" : "Yard Samples"}
              subtitle={rangePreset}
              isDarkMode={darkMode}
            />
          </div>
        </div>

        <BiFilterBarLayout isDarkMode={darkMode} setIsDarkMode={setDarkMode}>
          <div className={`flex min-w-0 w-full basis-full flex-wrap items-center gap-0.5 rounded-xl border p-0.5 sm:w-auto sm:basis-auto sm:flex-nowrap ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {[
              { id: 'field', icon: <Sprout className="w-3.5 h-3.5" />, label: 'Field Sampling' },
              { id: 'yard', icon: <Truck className="w-3.5 h-3.5" />, label: 'Yard Sampling' },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

          <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {['MTD', 'STD', 'WTD'].map(type => (
              <button key={type} onClick={() => handleQuickDate(type)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  rangePreset === type
                    ? 'bg-blue-600 text-white shadow-md'
                    : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}>
                {type}
              </button>
            ))}
            <button type="button" onClick={() => handleQuickDate('Custom')}
              className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                rangePreset === 'Custom'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
              }`}>
              Custom
            </button>
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-end gap-1.5 sm:gap-2">
            <div className={`flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              <span className={`ml-0.5 shrink-0 text-[9px] font-bold uppercase tracking-wide sm:ml-1 sm:text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Compare
              </span>
              <div className="flex min-w-0 flex-wrap gap-0.5 sm:gap-1">
                {comparisonOptions.map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => onCompareSelect(comp.id)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                      comparisonType === comp.id
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    {comp.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'field' && (
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Operation</span>
                <select value={fieldTestType} onChange={e => setFieldTestType(e.target.value)}
                  className={`w-[6rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    darkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                  }`}>
                  <option value="All">All</option>
                  {testTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                </select>
              </div>
            )}

            {activeTab === 'yard' && (
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Point</span>
                <select value={yardDelivery} onChange={e => setYardDelivery(e.target.value)}
                  className={`w-[6rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    darkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                  }`}>
                  <option value="All">All</option>
                  {deliveryPoints.map(dp => <option key={dp} value={dp}>{dp}</option>)}
                </select>
              </div>
            )}

            <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>From</span>
              <input type="date" value={dateFrom}
                min={dbMinDateStr || undefined}
                max={(dateTo && dbMaxDateStr ? (dateTo < dbMaxDateStr ? dateTo : dbMaxDateStr) : (dateTo || dbMaxDateStr)) || undefined}
                onChange={e => { setDateFrom(clampToDb(e.target.value)); setRangePreset('Custom'); }}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  darkMode ? 'border-slate-600 bg-slate-900 text-slate-100 [color-scheme:dark]' : 'border-slate-200 bg-white text-slate-800'
                }`} />
            </div>
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>To</span>
              <input type="date" value={dateTo}
                min={(dateFrom && dbMinDateStr ? (dateFrom > dbMinDateStr ? dateFrom : dbMinDateStr) : (dateFrom || dbMinDateStr)) || undefined}
                max={dbMaxDateStr || undefined}
                onChange={e => { setDateTo(clampToDb(e.target.value)); setRangePreset('Custom'); }}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  darkMode ? 'border-slate-600 bg-slate-900 text-slate-100 [color-scheme:dark]' : 'border-slate-200 bg-white text-slate-800'
                }`} />
            </div>
          </div>
        </BiFilterBarLayout>
      </div>

      {/* ── Main Dashboard Body ── */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-4 py-2 flex flex-col justify-between overflow-hidden gap-2 relative">

        {/* ── Loading Overlay ── */}
        {((activeTab === 'field' && fieldLoading) || (activeTab === 'yard' && yardLoading)) && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm rounded-xl transition-opacity duration-300">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-500 dark:border-t-blue-400 animate-spin" />
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase animate-pulse">
              Loading {activeTab === 'field' ? 'Field' : 'Yard'} Data…
            </p>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between overflow-hidden gap-2 min-h-0">

            {/* ════════════════════════════════════════════════════
                FIELD TAB  — Matching reference mockup design
            ════════════════════════════════════════════════════ */}
            {activeTab === 'field' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden gap-2.5 min-h-0">

                {/* ── Top KPI Row ── */}
                <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <BiKpiCard
                    title="AVG MID BRIX %"
                    value={parseFloat(fieldStats?.avgMidBrix?.value ?? 19.46)}
                    pyValue={parseFloat(fieldStats?.avgMidBrix?.pyValue ?? 0)}
                    unit="%"
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={fieldTrend.length ? fieldTrend : fieldBrixTrendData}
                    dataKey="midBrix"
                    chartType="area"
                    chartColor="#10b981"
                    formatValue={(v) => v.toFixed(2)}
                  />
                  <BiKpiCard
                    title="AVERAGE MATURITY"
                    value={parseFloat(fieldStats?.avgMaturity?.value ?? 1.0)}
                    pyValue={parseFloat(fieldStats?.avgMaturity?.pyValue ?? 0)}
                    unit="ratio"
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={fieldTrend.length ? fieldTrend : fieldBrixTrendData}
                    dataKey="midBrix"
                    chartType="line"
                    chartColor="#6366f1"
                    formatValue={(v) => v.toFixed(2)}
                  />
                  <BiKpiCard
                    title="TOTAL SAMPLES"
                    value={parseFloat(fieldStats?.totalSamples?.value ?? 2645)}
                    pyValue={parseFloat(fieldStats?.totalSamples?.pyValue ?? 0)}
                    unit="samples"
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={fieldTrend.length ? fieldTrend : fieldBrixTrendData}
                    dataKey="midBrix"
                    chartType="area"
                    chartColor="#3b82f6"
                    formatValue={(v) => Math.round(v).toLocaleString()}
                  />
                  <BiKpiCard
                    title="BOTTOM BRIX < 18%"
                    value={parseFloat(fieldStats?.pctBottomBrixLt18?.value ?? 17.0)}
                    pyValue={parseFloat(fieldStats?.pctBottomBrixLt18?.pyValue ?? 0)}
                    unit="%"
                    inverseColor
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={fieldTrend.length ? fieldTrend : fieldBrixTrendData}
                    dataKey="bottomBrix"
                    chartType="area"
                    chartColor="#f59e0b"
                    formatValue={(v) => v.toFixed(1)}
                  />
                </div>

                {/* ── Top Main Section Row (Brix Trend Across Sections + Crop Health & Land Classification) ── */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-0 overflow-hidden">

                  {/* Left: Brix Trend Across Plant Sections (~60% / col-span-7) */}
                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Brix Trend Across Plant Sections
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Top, Middle &amp; Bottom cane stalk sweetness</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold">
                        <span className="flex items-center gap-1 text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Bottom</span>
                        <span className="flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Middle</span>
                        <span className="flex items-center gap-1 text-indigo-500"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>Top</span>
                      </div>
                    </div>
                    <div className="flex-1 min-h-[140px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={fieldTrend.length ? fieldTrend : fieldBrixTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.5} />
                          <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 9, fill: tickColor }} />
                          <YAxis tickLine={false} tick={{ fontSize: 9, fill: tickColor }} domain={[0, 35]} />
                          <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          <Line type="monotone" dataKey="bottomBrix" name="Bottom Brix" stroke="#eab308" strokeWidth={2.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="midBrix" name="Mid Brix" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 2.5 }} />
                          <Line type="monotone" dataKey="topBrix" name="Top Brix" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right: Crop Health & Land Classification (Divided Vertically into 2 Side-by-Side Cards) */}
                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Left Vertical Card: Crop Standing & Health */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex flex-col justify-between min-h-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                          Crop Standing
                        </h3>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">HEALTH</span>
                      </div>

                      <div className="flex-1 w-full relative flex items-center justify-center min-h-[175px] sm:min-h-[190px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={fieldCropCond.length ? fieldCropCond : cropConditionData} cx="50%" cy="50%" innerRadius={62} outerRadius={95} dataKey="value">
                              {(fieldCropCond.length ? fieldCropCond : cropConditionData).map((entry, i) => (
                                <Cell key={`cc-${i}`} fill={entry.color || '#3b82f6'} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">99.8%</span>
                          <span className="text-[10px] font-bold text-emerald-600">Good</span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[9px] font-bold">
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-slate-500 font-medium">Good:</span>
                          <span className="text-blue-600 font-extrabold">2.64K (99.8%)</span>
                        </div>
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-slate-500 font-medium">Diseased:</span>
                          <span className="text-rose-600 font-extrabold">4 (0.2%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Vertical Card: Land Topography */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex flex-col justify-between min-h-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                          Land Topography
                        </h3>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">TYPE</span>
                      </div>

                      <div className="flex-1 w-full flex items-center justify-center min-h-[175px] sm:min-h-[190px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={fieldLandType.length ? fieldLandType : landAreaMaturityData} cx="50%" cy="50%" outerRadius={95} dataKey="value">
                              {(fieldLandType.length ? fieldLandType : landAreaMaturityData).map((entry, i) => (
                                <Cell key={`lt-${i}`} fill={entry.color || (i === 0 ? '#6366f1' : '#06b6d4')} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[9px] font-bold">
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-slate-500 font-medium">Upland:</span>
                          <span className="text-indigo-600 font-extrabold">80% (2.12K)</span>
                        </div>
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-slate-500 font-medium">Lowland:</span>
                          <span className="text-cyan-600 font-extrabold">20% (526)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Bottom Grid Row (3 Columns: Hydration Trend, Soil Type Combo, Variety Combo) ── */}
                <div className="shrink-0 grid grid-cols-1 md:grid-cols-12 gap-2.5 h-[220px] sm:h-[240px] lg:h-[260px]">

                  {/* Col 1: Brix Trend - Hydration & Field Condition (~45% / col-span-5) */}
                  <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex flex-col justify-between min-h-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                          Brix Trend - Hydration &amp; Field Condition
                        </h3>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">Impact of Waterlogged vs Regular Irrigation</p>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-bold">
                        <span className="text-amber-500">■ No Water</span>
                        <span className="text-slate-400">-- Avg</span>
                        <span className="text-cyan-500">■ Waterlogged</span>
                      </div>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={fieldCondTrend} margin={{ top: 2, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.5} />
                          <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <YAxis tickLine={false} tick={{ fontSize: 8, fill: tickColor }} domain={[0, 25]} />
                          <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          <Line type="monotone" dataKey="noWater" name="No Water" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                          <Line type="monotone" dataKey="overallAvg" name="Avg" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                          <Line type="monotone" dataKey="waterlogged" name="Waterlogged" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} connectNulls={true} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Col 2: Maturity by Soil Type (~27% / col-span-3) */}
                  <div className="md:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex flex-col justify-between min-h-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">Maturity by Soil Type</h3>
                      <span className="text-[9px] text-slate-400">Count &amp; Ratio</span>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={fieldSoilType.length ? fieldSoilType : soilTypeMaturityData} margin={{ top: 4, right: 0, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.5} />
                          <XAxis dataKey="soil" tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <YAxis yAxisId="left" tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0.8, 1.2]} tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          <Bar yAxisId="left" dataKey="samples" name="Samples" fill="#818cf8" opacity={0.3} radius={[3, 3, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="maturity" name="Maturity" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Col 3: Maturity by Crop Variety (~28% / col-span-4) */}
                  <div className="md:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex flex-col justify-between min-h-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">Maturity by Crop Variety</h3>
                      <span className="text-[9px] text-slate-400">Cultivars</span>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={fieldVariety.length ? fieldVariety : cropVarietyData} margin={{ top: 4, right: 0, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.5} />
                          <XAxis dataKey="variety" tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <YAxis yAxisId="left" tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0.8, 1.2]} tickLine={false} tick={{ fontSize: 8, fill: tickColor }} />
                          <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          <Bar yAxisId="left" dataKey="samples" name="Samples" fill="#818cf8" opacity={0.3} radius={[3, 3, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="maturity" name="Maturity" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2.5, fill: '#3b82f6' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ════════════════════════════════════════════════════
                YARD TAB  — Live data from Power BI formulas
            ════════════════════════════════════════════════════ */}
            {activeTab === 'yard' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden gap-2 min-h-0">

                {/* Section header */}
                <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Yard Intake &amp; Consignment Quality
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {yardLoading ? 'Loading…' : `${Number(yardStats?.totalSamples?.value ?? 0).toLocaleString()} Yard Samples`}
                  </span>
                </div>

                {/* KPI Cards — 5 primary measures */}
                <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <BiKpiCard
                    title="TOTAL SAMPLES"
                    value={parseFloat(yardStats?.totalSamples?.value ?? 0)}
                    pyValue={parseFloat(yardStats?.totalSamples?.pyValue ?? 0)}
                    unit="Lots"
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={yardTrend}
                    dataKey="avgBrix"
                    chartType="area"
                    chartColor="#3b82f6"
                    formatValue={(v) => Math.round(v).toLocaleString()}
                  />
                  <BiKpiCard
                    title="AVG MIDDLE BRIX %"
                    value={parseFloat(yardStats?.avgBrix?.value ?? 0)}
                    pyValue={parseFloat(yardStats?.avgBrix?.pyValue ?? 0)}
                    unit="%"
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={yardTrend}
                    dataKey="avgBrix"
                    chartType="line"
                    chartColor="#10b981"
                    formatValue={(v) => v.toFixed(2)}
                  />
                  <BiKpiCard
                    title="MIDDLE BRIX > 18"
                    value={parseFloat(yardStats?.pctBrixGt18?.value ?? 0)}
                    pyValue={parseFloat(yardStats?.pctBrixGt18?.pyValue ?? 0)}
                    unit="%"
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={yardTrend}
                    dataKey="avgBrix"
                    chartType="area"
                    chartColor="#6366f1"
                    formatValue={(v) => v.toFixed(1)}
                  />
                  <BiKpiCard
                    title="DISEASED CANE"
                    value={parseFloat(yardStats?.pctDiseased?.value ?? 0)}
                    pyValue={parseFloat(yardStats?.pctDiseased?.pyValue ?? 0)}
                    unit="%"
                    inverseColor
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={yardTrend}
                    dataKey="avgBrix"
                    chartType="line"
                    chartColor="#ef4444"
                    formatValue={(v) => v.toFixed(1)}
                  />
                  <BiKpiCard
                    title="STALE CANE"
                    value={parseFloat(yardStats?.pctStale?.value ?? 0)}
                    pyValue={parseFloat(yardStats?.pctStale?.pyValue ?? 0)}
                    unit="%"
                    inverseColor
                    comparisonLabel={compareBadgeLabel || 'Prev. Period'}
                    isDarkMode={darkMode}
                    chartData={yardTrend}
                    dataKey="avgBrix"
                    chartType="line"
                    chartColor="#f59e0b"
                    formatValue={(v) => v.toFixed(1)}
                  />
                </div>

                {/* Affected + Brix>18 rate row */}
                <div className="shrink-0 grid grid-cols-2 gap-2">
                  <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/50 p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Total Affected Cane</p>
                      <p className="text-[9px] text-rose-500">Diseased OR Stale = Yes</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">
                        {yardLoading ? '…' : `${yardStats?.pctAffected?.value ?? 0}%`}
                      </span>
                      <div className="flex items-center gap-2 justify-end mt-1">
                        <ChangeBadge
                          change={yardStats?.pctAffected?.change}
                          variance={yardStats?.pctAffected?.variance}
                          isUp={yardStats?.pctAffected?.isUp}
                          label={compareBadgeLabel}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Brix &gt; 18 Rate</p>
                      <p className="text-[9px] text-emerald-600">COUNT(MiddleBrix &gt; 18) / Total</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                        {yardLoading ? '…' : `${yardStats?.pctBrixGt18?.value ?? 0}%`}
                      </span>
                      <div className="flex items-center gap-2 justify-end mt-1">
                        <ChangeBadge
                          change={yardStats?.pctBrixGt18?.change}
                          variance={yardStats?.pctBrixGt18?.variance}
                          isUp={yardStats?.pctBrixGt18?.isUp}
                          label={compareBadgeLabel}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts row */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2.5 min-h-0 overflow-hidden">

                  {/* Combo chart — Brix daily trend */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-sm flex flex-col">
                    <div className="mb-1">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">Middle Brix % Daily Trend</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Bars = samples with Brix &gt; 18 · Line = avg Brix % (secondary axis, min 16)
                      </p>
                    </div>
                    <div className="flex-1 min-h-[120px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={yardTrend} margin={{ top: 4, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.6} />
                          <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 9, fill: tickColor }} />
                          <YAxis yAxisId="left" tickLine={false} tick={{ fontSize: 9, fill: tickColor }} />
                          <YAxis yAxisId="right" orientation="right" domain={[16, 'auto']} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} />
                          <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar yAxisId="left" dataKey="countAbove18" name="Middle Brix > 18" fill="#ec4899" opacity={0.5} radius={[3, 3, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="avgBrix" name="Avg Middle Brix %" stroke={lineDark} strokeWidth={2.5} dot={{ r: 2.5 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="flex flex-col gap-2 min-h-0">

                    {/* Vehicle bar chart */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex-1 flex flex-col">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1.5">Middle Brix % by Carrier</h3>
                      <div className="space-y-2 flex-1">
                        {yardVehicle.map(item => (
                          <div key={item.vehicleType}>
                            <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                              <span className="text-slate-700 dark:text-slate-300">{item.vehicleType}</span>
                              <span className="text-blue-600 dark:text-blue-400 font-bold">{item.avgBrix}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                                style={{ width: `${Math.min((item.avgBrix / 25) * 100, 100)}%` }} />
                            </div>
                            <p className="text-[9px] text-slate-400 mt-0.5">{item.samples} samples</p>
                          </div>
                        ))}
                        {yardVehicle.length === 0 && !yardLoading &&
                          <p className="text-[11px] text-slate-400 text-center py-4">No data</p>}
                      </div>
                    </div>

                    {/* Condition pie — excl. affected cane */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">Consignment Condition</h3>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Excl. affected cane (PBI formula)</p>
                        <div className="space-y-0.5">
                          {yardCondition.map(c => {
                            const total = yardCondition.reduce((s, x) => s + x.count, 0);
                            return (
                              <div key={c.name} className="flex items-center gap-1 text-[10px]">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                                <span className="text-slate-600 dark:text-slate-400">{c.name}:</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {total ? Math.round(c.count / total * 100) : 0}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="w-28 h-28 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={yardCondition} cx="50%" cy="50%" innerRadius={28} outerRadius={52} dataKey="value">
                              {yardCondition.map((e, i) => <Cell key={`cond-${i}`} fill={e.color} />)}
                            </Pie>
                            <Tooltip content={<CustomChartTooltip darkMode={darkMode} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center-wise pivot table */}
                <div className="shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-2.5 shadow-sm h-[150px] flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Center-wise Condition</h3>
                    <div className="relative w-36">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1.5" />
                      <input type="text" placeholder="Search center…" value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-[10px] pl-6 pr-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none" />
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 text-[11px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider sticky top-0 bg-white dark:bg-slate-900">
                          <th className="pb-1 font-semibold">Center</th>
                          <th className="pb-1 font-semibold text-right text-emerald-600">Clean</th>
                          <th className="pb-1 font-semibold text-right text-amber-500">Dry Leaves</th>
                          <th className="pb-1 font-semibold text-right text-purple-600">Muddy</th>
                          <th className="pb-1 font-semibold text-right text-blue-600">Roots</th>
                          <th className="pb-1 font-semibold text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                        {filteredCenters.map(row => (
                          <tr key={row.center}>
                            <td className="py-0.5 font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">{row.center}</td>
                            <td className="py-0.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{row.Clean || '–'}</td>
                            <td className="py-0.5 text-right text-amber-600 dark:text-amber-400">{row.DryLeaves || '–'}</td>
                            <td className="py-0.5 text-right text-purple-600 dark:text-purple-400">{row.Muddy || '–'}</td>
                            <td className="py-0.5 text-right text-blue-600 dark:text-blue-400">{row.Roots || '–'}</td>
                            <td className="py-0.5 text-right font-extrabold text-slate-900 dark:text-white">{row.Total}</td>
                          </tr>
                        ))}
                        {filteredCenters.length === 0 && !yardLoading && (
                          <tr><td colSpan={6} className="py-3 text-center text-slate-400">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
      </main>
    </div>
  );
}
