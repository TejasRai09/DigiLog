import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  BarChart3,
  Table,
  Sun,
  Moon,
  Sprout,
  Truck,
  X
} from 'lucide-react';
import {
  getPresetDateRange,
  computePriorPeriodRange,
  getSeasonComparisonLabels,
  alignSeasonCompareRange,
  isSeasonComparisonType,
  seasonLabelForComparisonType,
  formatYMD,
} from '../../utils/distilleryBiDateRange';

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
  const [activeView, setActiveView] = useState('visual');
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Shared Filter State ────────────────────────────────────────
  // Per-tab From/To so Field and Yard each show their own sampling span
  const [fieldDates, setFieldDates] = useState({ from: '', to: '' });
  const [yardDates, setYardDates] = useState({ from: '', to: '' });
  const [baseSeason, setBaseSeason] = useState('');
  const [rangePreset, setRangePreset] = useState('Custom'); // MTD | STD | YTD | Custom
  const [comparisonType, setComparisonType] = useState('PP'); // PP | S1 | S2 | S3
  const [thirdSeasonEnabled, setThirdSeasonEnabled] = useState(false);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [seasonMapping, setSeasonMapping] = useState({});
  // Per-tab sampling date bounds (field → brix_field_sampling.Date, yard → brix_yard_sampling.Date)
  const [fieldDateRange, setFieldDateRange] = useState({ min: '', max: '' });
  const [yardDateRange, setYardDateRange] = useState({ min: '', max: '' });

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

    setRange((prev) => {
      const next = { min: minStr || prev.min, max: maxStr || prev.max };
      if (prev.min === next.min && prev.max === next.max) return prev;
      return next;
    });

    // Always default/clamp this tab’s From–To to its own sampling min/max
    setDates((prev) => {
      const min = minStr || '';
      const max = maxStr || '';
      const from = prev.from ? clampIso(prev.from, min, max) : min;
      const to = prev.to ? clampIso(prev.to, min, max) : max;
      // First load (empty): use full table span so each tab shows its own min/max
      const nextFrom = prev.from ? from : min;
      const nextTo = prev.to ? to : max;
      if (prev.from === nextFrom && prev.to === nextTo) return prev;
      return { from: nextFrom, to: nextTo };
    });
  }, []);

  // Distillery-style season compare labels + third-season setting
  const seasonLabels = useMemo(() => {
    const ref = dbMaxDateStr ? new Date(`${dbMaxDateStr}T12:00:00`) : new Date();
    return getSeasonComparisonLabels(ref);
  }, [dbMaxDateStr]);

  useEffect(() => {
    api.get('/bi/settings')
      .then((r) => setThirdSeasonEnabled(Boolean(r.data?.thirdSeasonCompareEnabled)))
      .catch(() => setThirdSeasonEnabled(false));
  }, []);

  useEffect(() => {
    if (!thirdSeasonEnabled && comparisonType === 'S3') setComparisonType('PP');
  }, [thirdSeasonEnabled, comparisonType]);

  const dynamicPPLabel = useMemo(() => {
    if (rangePreset === 'MTD') return 'Prev. Month';
    if (rangePreset === 'STD') return 'Prev. Season';
    if (rangePreset === 'YTD') return 'Prev. Year';
    return 'Prev. Period';
  }, [rangePreset]);

  const comparisonOptions = useMemo(() => {
    const opts = [
      { id: 'PP', label: dynamicPPLabel },
      { id: 'S1', label: seasonLabels.season1 },
      { id: 'S2', label: seasonLabels.season2 },
    ];
    if (thirdSeasonEnabled) opts.push({ id: 'S3', label: seasonLabels.season3 });
    return opts;
  }, [dynamicPPLabel, seasonLabels, thirdSeasonEnabled]);

  /** Resolve compare From–To for a current window (Distillery PP / S1 / S2 / S3). */
  const resolveCompareRange = useCallback((from, to) => {
    if (!from || !to) return null;
    if (comparisonType === 'PP') {
      const pp = computePriorPeriodRange(from, to, rangePreset);
      return { from: pp.start, to: pp.end, label: pp.label };
    }
    if (isSeasonComparisonType(comparisonType)) {
      const seasonLabel = seasonLabelForComparisonType(comparisonType, seasonLabels);
      if (!seasonLabel) return null;
      const aligned = alignSeasonCompareRange(from, to, seasonLabel);
      return { from: aligned.start, to: aligned.end, label: seasonLabel };
    }
    return null;
  }, [comparisonType, rangePreset, seasonLabels]);

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
  const [fieldTableData, setFieldTableData] = useState([]);
  const [fieldLoading, setFieldLoading] = useState(false);

  const fieldParams = useMemo(() => {
    const p = new URLSearchParams();
    if (fieldDates.from) p.set('from', fieldDates.from);
    if (fieldDates.to) p.set('to', fieldDates.to);
    if (baseSeason) p.set('baseSeason', baseSeason);
    if (fieldTestType && fieldTestType !== 'All') p.set('testType', fieldTestType);
    const cmp = resolveCompareRange(fieldDates.from, fieldDates.to);
    if (cmp?.from) p.set('pyFrom', cmp.from);
    if (cmp?.to) p.set('pyTo', cmp.to);
    return p.toString() ? `?${p.toString()}` : '';
  }, [fieldDates.from, fieldDates.to, baseSeason, fieldTestType, resolveCompareRange]);

  const fetchFieldData = useCallback(async () => {
    setFieldLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get(`/bi/brix-field/stats${fieldParams}`),
        api.get(`/bi/brix-field/brix-trend${fieldParams}`),
        api.get(`/bi/brix-field/field-condition-trend${fieldParams}`),
        api.get(`/bi/brix-field/crop-condition${fieldParams}`),
        api.get(`/bi/brix-field/by-soil-type${fieldParams}`),
        api.get(`/bi/brix-field/by-land-type${fieldParams}`),
        api.get(`/bi/brix-field/by-variety${fieldParams}`),
        api.get(`/bi/brix-field/table-data${fieldParams}`),
      ]);

      if (results[0].status === 'fulfilled') {
        const d = results[0].value.data;
        if (d.availableSeasons) setAvailableSeasons(d.availableSeasons);
        if (d.seasonMapping) setSeasonMapping(d.seasonMapping);
        applyStatsDateRange(d.dateRange, 'field');
        setFieldStats(d.stats);
      }
      if (results[1].status === 'fulfilled') setFieldTrend(results[1].value.data);
      if (results[2].status === 'fulfilled') setFieldCondTrend(results[2].value.data);
      if (results[3].status === 'fulfilled') {
        const raw = results[3].value.data || [];
        const colors = { Good: '#3b82f6', Diseased: '#ef4444', Dry: '#f59e0b' };
        setFieldCropCond(raw.map(r => ({
          ...r,
          name: r.condition,
          value: r.count,
          color: colors[r.condition] || '#94a3b8',
        })));
      }
      if (results[4].status === 'fulfilled') setFieldSoilType(results[4].value.data);
      if (results[5].status === 'fulfilled') {
        const raw = results[5].value.data || [];
        const landColors = ['#1d4ed8', '#60a5fa', '#3b82f6', '#93c5fd'];
        setFieldLandType(raw.map((r, i) => ({
          ...r,
          value: r.samples,
          color: landColors[i % landColors.length],
        })));
      }
      if (results[6].status === 'fulfilled') setFieldVariety(results[6].value.data);
      if (results[7] && results[7].status === 'fulfilled') setFieldTableData(results[7].value.data);
    } catch (e) {
      console.error('Field data fetch failed', e);
    } finally {
      setFieldLoading(false);
    }
  }, [fieldParams, applyStatsDateRange]);

  // Fetch test-type options once on mount
  useEffect(() => {
    api.get('/bi/brix-field/test-types')
      .then(r => setTestTypes(r.data))
      .catch(() => { });
  }, []);

  // Re-fetch field data whenever filters change
  useEffect(() => {
    fetchFieldData();
  }, [fetchFieldData]);

  // ─── Yard live-data state ───────────────────────────────────────
  const [yardDelivery, setYardDelivery] = useState('All');
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [yardStats, setYardStats] = useState(null);
  const [yardTrend, setYardTrend] = useState([]);
  const [yardVehicle, setYardVehicle] = useState([]);
  const [yardCondition, setYardCondition] = useState([]);
  const [yardCenters, setYardCenters] = useState([]);
  const [yardTableData, setYardTableData] = useState([]);
  const [yardLoading, setYardLoading] = useState(false);

  // Build query string from filter state
  const yardParams = useMemo(() => {
    const p = new URLSearchParams();
    if (yardDates.from) p.set('from', yardDates.from);
    if (yardDates.to) p.set('to', yardDates.to);
    if (baseSeason) p.set('baseSeason', baseSeason);
    if (yardDelivery && yardDelivery !== 'All') p.set('deliveryPoint', yardDelivery);
    const cmp = resolveCompareRange(yardDates.from, yardDates.to);
    if (cmp?.from) p.set('pyFrom', cmp.from);
    if (cmp?.to) p.set('pyTo', cmp.to);
    return p.toString() ? `?${p.toString()}` : '';
  }, [yardDates.from, yardDates.to, baseSeason, yardDelivery, resolveCompareRange]);

  const fetchYardData = useCallback(async () => {
    setYardLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get(`/bi/brix-yard/stats${yardParams}`),
        api.get(`/bi/brix-yard/brix-trend${yardParams}`),
        api.get(`/bi/brix-yard/by-vehicle${yardParams}`),
        api.get(`/bi/brix-yard/condition-distribution${yardParams}`),
        api.get(`/bi/brix-yard/center-wise${yardParams}`),
        api.get(`/bi/brix-yard/table-data${yardParams}`),
      ]);

      if (results[0].status === 'fulfilled') {
        const d = results[0].value.data;
        if (d.availableSeasons) setAvailableSeasons(d.availableSeasons);
        if (d.seasonMapping) setSeasonMapping(d.seasonMapping);
        applyStatsDateRange(d.dateRange, 'yard');
        setYardStats(d.stats);
      }
      if (results[1].status === 'fulfilled') setYardTrend(results[1].value.data);
      if (results[2].status === 'fulfilled') setYardVehicle(results[2].value.data);
      if (results[3].status === 'fulfilled') {
        const rawCond = results[3].value.data || [];
        setYardCondition(rawCond.filter(r => r.condition).map(r => ({
          ...r,
          name: r.condition,
          value: r.count,
          color: CONDITION_COLORS[r.condition] || '#94a3b8',
        })));
      }
      if (results[4].status === 'fulfilled') setYardCenters(results[4].value.data);
      if (results[5] && results[5].status === 'fulfilled') setYardTableData(results[5].value.data);
    } catch (e) {
      console.error('Yard data fetch failed', e);
    } finally {
      setYardLoading(false);
    }
  }, [yardParams, applyStatsDateRange]);

  // Fetch delivery-point slicer options once on mount
  useEffect(() => {
    api.get('/bi/brix-yard/delivery-points')
      .then(r => setDeliveryPoints(r.data))
      .catch(() => { });
  }, []);

  // Re-fetch whenever filter params change
  useEffect(() => {
    fetchYardData();
  }, [fetchYardData]);

  const handleQuickDate = (type) => {
    try {
      let today = new Date();
      if (dbMaxDate instanceof Date && !isNaN(dbMaxDate)) {
        today = dbMaxDate;
      }

      const formatDate = (d) => {
        if (!(d instanceof Date) || isNaN(d)) return '';
        return formatYMD(d);
      };

      if (type === 'MTD' || type === 'YTD') {
        // Distillery-style: MTD = month start; YTD = Indian FY (1 Apr)
        const { from, to } = getPresetDateRange(type, today);
        setDateFrom(clampToDb(from));
        setDateTo(clampToDb(to));
      } else if (type === 'STD') {
        const year = today.getFullYear();
        const month = today.getMonth();
        let activeSeasonLabel = baseSeason;
        if (!activeSeasonLabel && seasonMapping && Object.keys(seasonMapping).length > 0) {
          for (const [label, mapping] of Object.entries(seasonMapping)) {
            const sStart = new Date(mapping.startDate);
            const sEnd = new Date(mapping.endDate);
            if (today >= sStart && today <= sEnd) {
              activeSeasonLabel = label;
              break;
            }
          }
          if (!activeSeasonLabel) {
            const sorted = Object.keys(seasonMapping).sort().reverse();
            activeSeasonLabel = sorted[0];
          }
        }

        let stdStart;
        if (activeSeasonLabel && seasonMapping && seasonMapping[activeSeasonLabel]) {
          stdStart = new Date(seasonMapping[activeSeasonLabel].startDate);
        } else {
          // Crushing season fallback: Oct 1
          let stdYear = year;
          if (month < 9) stdYear -= 1;
          stdStart = new Date(stdYear, 9, 1);
        }

        setDateTo(clampToDb(formatDate(today)));
        setDateFrom(clampToDb(formatDate(stdStart)));
      }

      setBaseSeason('');
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
              value={activeTab === 'field' ? (fieldStats?.totalSamples?.value ?? 0) : (yardStats?.totalVehicles?.value ?? 0)}
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
            {['MTD', 'STD', 'YTD'].map(type => (
              <button key={type} onClick={() => handleQuickDate(type)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  rangePreset === type
                    ? 'bg-blue-600 text-white shadow-md'
                    : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}>
                {type}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-end gap-1.5 sm:gap-2">
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Base Season</span>
              <select value={baseSeason} onChange={e => {
                  const next = e.target.value;
                  setBaseSeason(next);
                  setRangePreset('Custom');
                  if (next && seasonMapping[next]) {
                    const start = toInputDate(seasonMapping[next].startDate);
                    const end = toInputDate(seasonMapping[next].endDate);
                    setFieldDates({
                      from: clampIso(start, fieldDateRange.min, fieldDateRange.max),
                      to: clampIso(end, fieldDateRange.min, fieldDateRange.max),
                    });
                    setYardDates({
                      from: clampIso(start, yardDateRange.min, yardDateRange.max),
                      to: clampIso(end, yardDateRange.min, yardDateRange.max),
                    });
                  } else {
                    setFieldDates({ from: fieldDateRange.min, to: fieldDateRange.max });
                    setYardDates({ from: yardDateRange.min, to: yardDateRange.max });
                  }
                }}
                className={`w-[6rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  darkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}>
                <option value="">-- Custom --</option>
                {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Compare</span>
              <select value={comparisonType} onChange={e => setComparisonType(e.target.value)}
                className={`w-[6rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  darkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}>
                {comparisonOptions.map((comp) => (
                  <option key={comp.id} value={comp.id}>{comp.label}</option>
                ))}
              </select>
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

            <div className={`flex items-center gap-1 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              {[
                { id: 'visual', icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'Visual' },
                { id: 'raw', icon: <Table className="h-3.5 w-3.5" />, label: 'Data' }
              ].map(v => (
                <button key={v.id} onClick={() => setActiveView(v.id)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                    activeView === v.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                  }`}>
                  {v.icon}{v.label}
                </button>
              ))}
            </div>

            <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>From</span>
              <input type="date" value={dateFrom}
                min={dbMinDateStr || undefined}
                max={(dateTo && dbMaxDateStr ? (dateTo < dbMaxDateStr ? dateTo : dbMaxDateStr) : (dateTo || dbMaxDateStr)) || undefined}
                onChange={e => { setDateFrom(clampToDb(e.target.value)); setBaseSeason(''); setRangePreset('Custom'); }}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  darkMode ? 'border-slate-600 bg-slate-900 text-slate-100 [color-scheme:dark]' : 'border-slate-200 bg-white text-slate-800'
                }`} />
            </div>
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>To</span>
              <input type="date" value={dateTo}
                min={(dateFrom && dbMinDateStr ? (dateFrom > dbMinDateStr ? dateFrom : dbMinDateStr) : (dateFrom || dbMinDateStr)) || undefined}
                max={dbMaxDateStr || undefined}
                onChange={e => { setDateTo(clampToDb(e.target.value)); setBaseSeason(''); setRangePreset('Custom'); }}
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

        {activeView === 'visual' ? (
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
        ) : (
          /* ── Raw Data Table view ── */
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm overflow-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Raw Brix Sampling Data Records ({activeTab === 'field' ? 'Field' : 'Yard'})</h3>
            <div className="overflow-x-auto">
              {activeTab === 'field' ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px]">
                      <th className="pb-2">Sampling Date</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2 text-right">Top Brix %</th>
                      <th className="pb-2 text-right">Middle Brix %</th>
                      <th className="pb-2 text-right">Bottom Brix %</th>
                      <th className="pb-2 text-right">Maturity Index</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {fieldTableData.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 font-semibold">{d.date}</td>
                        <td className="py-2">{d.location}</td>
                        <td className="py-2 text-right text-blue-600 font-bold">{d.topBrix}%</td>
                        <td className="py-2 text-right text-emerald-600 font-bold">{d.midBrix}%</td>
                        <td className="py-2 text-right text-orange-600 font-bold">{d.bottomBrix}%</td>
                        <td className="py-2 text-right font-mono font-bold">{d.maturity}</td>
                      </tr>
                    ))}
                    {fieldTableData.length === 0 && !fieldLoading && (
                      <tr><td colSpan={6} className="text-center py-4 text-slate-500">No field data found for this date range</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px]">
                      <th className="pb-2">Sampling Date</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Delivery Point</th>
                      <th className="pb-2 text-right">Middle Brix %</th>
                      <th className="pb-2 text-center">Vehicle</th>
                      <th className="pb-2 text-center">Diseased</th>
                      <th className="pb-2 text-center">Stale</th>
                      <th className="pb-2">Condition</th>
                      <th className="pb-2">Variety</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {yardTableData.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 font-semibold">{d.date}</td>
                        <td className="py-2">{d.name}</td>
                        <td className="py-2">{d.location}</td>
                        <td className="py-2 text-right text-emerald-600 font-bold">{d.midBrix}%</td>
                        <td className="py-2 text-center">{d.vehicleType}</td>
                        <td className="py-2 text-center">
                          {d.diseased === 'Yes' ? <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">Yes</span> : 'No'}
                        </td>
                        <td className="py-2 text-center">
                          {d.stale === 'Yes' ? <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">Yes</span> : 'No'}
                        </td>
                        <td className="py-2">{d.consignmentCondition}</td>
                        <td className="py-2">{d.variety}</td>
                      </tr>
                    ))}
                    {yardTableData.length === 0 && !yardLoading && (
                      <tr><td colSpan={9} className="text-center py-4 text-slate-500">No yard data found for this date range</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
