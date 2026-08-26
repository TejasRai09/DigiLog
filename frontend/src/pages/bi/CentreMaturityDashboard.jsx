import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MdNaturePeople } from 'react-icons/md';
import api from '../../api/axios';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiKeyMetricBox, BiFilterBarLayout } from '../../components/bi/BiLayoutElements';
import {
  resolveDashboardToDate,
  formatYMD,
} from '../../utils/distilleryBiDateRange';
import {
  applyCockpitCompareSelection,
  buildCockpitComparisonOptions,
  ensureCompareSelectionValid,
  getCockpitPresetDateRange,
  getCockpitSeasonLabels,
  resolveCockpitCompareRange,
} from '../../utils/biCockpitDateFilters';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Award,
  Search,
  Wheat,
  ShoppingCart,
} from 'lucide-react';

// ─── Maturity gradient helper (Power BI: #D64550 → #33DE41) ─────
function maturityColor(val) {
  const clamped = Math.max(0, Math.min(1, val));
  const r = Math.round(214 + (51 - 214) * clamped);
  const g = Math.round(69 + (222 - 69) * clamped);
  const b = Math.round(80 + (65 - 80) * clamped);
  return `rgb(${r},${g},${b})`;
}

function maturityTextColor(val) {
  const clamped = Math.max(0, Math.min(1, val));
  return clamped < 0.3 || clamped > 0.85 ? '#ffffff' : '#1e293b';
}

function maturityBadgeTone(val) {
  const clamped = Math.max(0, Math.min(1, val));
  const hue = Math.round(clamped * 130); // red -> green
  const start = `hsl(${hue} 88% 78%)`;
  const mid = `hsl(${Math.max(0, hue - 8)} 82% 56%)`;
  const end = `hsl(${Math.max(0, hue - 16)} 76% 38%)`;
  return {
    bg: `linear-gradient(135deg,${start} 0%,${mid} 48%,${end} 100%)`,
    text: clamped < 0.3 || clamped > 0.82 ? '#ffffff' : '#0f172a',
    shadow: `0 8px 16px -10px hsla(${Math.max(0, hue - 8)},82%,48%,.85)`,
  };
}

const TopTenBadge = ({ rank }) => {
  if (!rank || rank > 10) return null;
  const tones = {
    1: { bg: 'linear-gradient(135deg,#fde68a 0%,#f59e0b 52%,#d97706 100%)', text: '#0f172a' },
    2: { bg: 'linear-gradient(135deg,#f8fafc 0%,#cbd5e1 45%,#94a3b8 100%)', text: '#0f172a' },
    3: { bg: 'linear-gradient(135deg,#fed7aa 0%,#fb923c 45%,#ea580c 100%)', text: '#ffffff' },
    4: { bg: 'linear-gradient(135deg,#bfdbfe 0%,#60a5fa 45%,#2563eb 100%)', text: '#ffffff' },
    5: { bg: 'linear-gradient(135deg,#bbf7d0 0%,#4ade80 45%,#16a34a 100%)', text: '#0f172a' },
    6: { bg: 'linear-gradient(135deg,#ddd6fe 0%,#a78bfa 45%,#7c3aed 100%)', text: '#ffffff' },
    7: { bg: 'linear-gradient(135deg,#fecdd3 0%,#fb7185 45%,#e11d48 100%)', text: '#ffffff' },
    8: { bg: 'linear-gradient(135deg,#a7f3d0 0%,#2dd4bf 45%,#0f766e 100%)', text: '#ffffff' },
    9: { bg: 'linear-gradient(135deg,#fde68a 0%,#facc15 45%,#ca8a04 100%)', text: '#0f172a' },
    10: { bg: 'linear-gradient(135deg,#fbcfe8 0%,#f472b6 45%,#be185d 100%)', text: '#ffffff' },
  };
  const tone = tones[rank];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black shrink-0 shadow-md"
      style={{ background: tone.bg, color: tone.text }}
    >
      <Award className="w-2.5 h-2.5" />
      #{rank}
    </span>
  );
};

const InfoBadge = ({ text, darkMode }) => (
  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
    ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
    <Info className="w-2.5 h-2.5" />
    {text}
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

// ═══════════════════════════════════════════════════════════════════
// KPI Card Component
// ═══════════════════════════════════════════════════════════════════
const KpiCard = ({ title, value, change, variance, isUp, icon: Icon, darkMode, accentColor, subtitle, showChange }) => (
  <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
    ${darkMode
      ? 'bg-slate-900/80 border-slate-700/50 hover:border-slate-600'
      : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'}`}>
    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
      style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />

    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className={`text-[11px] font-semibold tracking-wide uppercase mb-1
          ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {title}
        </p>
        <p className={`text-2xl font-extrabold tracking-tight
          ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {value}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {showChange && change != null ? (
            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold
              ${isUp
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
              {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {variance != null && (
                <span className="mr-0.5">{formatVariance(variance)}</span>
              )}
              ({Number(change).toFixed(2)}%)
            </span>
          ) : (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
              ${darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
              No prior data
            </span>
          )}
          <span className={`text-[10px] font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {subtitle || 'vs Prev. Season'}
          </span>
        </div>
      </div>
      <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
        style={{ color: accentColor }}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// Maturity Table Component
// ═══════════════════════════════════════════════════════════════════
const MaturityTable = ({ data, tableIndex, darkMode, searchQuery, topRankMap }) => {
  const filtered = useMemo(() => {
    if (!searchQuery) return data;
    return data.filter(r => r.center.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data, searchQuery]);

  const totalIndent = useMemo(() => filtered.reduce((s, r) => s + (r.indent || 0), 0), [filtered]);
  const totalPurchase = useMemo(() => filtered.reduce((s, r) => s + (r.purchase || 0), 0), [filtered]);
  const avgMaturity = useMemo(() => {
    if (totalIndent === 0) return 0;
    return totalPurchase / totalIndent;
  }, [totalIndent, totalPurchase]);

  return (
    <div className={`flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg
      ${darkMode
        ? 'bg-slate-900/80 border-slate-700/50'
        : 'bg-white border-slate-200/80 shadow-sm'}`}>

      {/* Table header info */}
      <div className={`px-3 py-2 border-b flex items-center justify-between
        ${darkMode ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-100 bg-slate-50/80'}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider
          ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Section {tableIndex + 1}
        </span>
        <span className={`text-[10px] font-medium
          ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {filtered.length} centers
        </span>
      </div>

      {/* Column headers */}
      <div className={`grid grid-cols-[1fr_70px_75px] px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b
        ${darkMode
          ? 'text-slate-400 border-slate-700/50 bg-slate-800/30'
          : 'text-slate-500 border-slate-100 bg-slate-50/40'}`}>
        <span>Center Name</span>
        <span className="text-right">Indent</span>
        <span className="text-right">Maturity</span>
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)', minHeight: '360px' }}>
        {filtered.length === 0 ? (
          <div className={`text-center py-8 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            No centers found
          </div>
        ) : (
          filtered.map((row, i) => (
            <div key={row.center + i}
              className={`grid grid-cols-[1fr_70px_75px] px-3 py-[7px] items-center text-[12px] border-b transition-colors duration-150
                ${darkMode
                  ? `border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/60'} hover:bg-slate-800/80`
                  : `border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30`}`}>
              <span className={`font-medium truncate pr-1 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}
                title={row.center}>
                <span className="flex items-center gap-2 min-w-0">
                  <TopTenBadge rank={topRankMap.get(row.center)} />
                  <span className="truncate">{row.center}</span>
                </span>
              </span>
              <span className={`text-right tabular-nums font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {row.indent.toLocaleString('en-IN')}
              </span>
              <span
                className="text-right tabular-nums font-bold rounded-md px-1.5 py-0.5 text-[11px]"
                style={{
                  background: maturityBadgeTone(row.maturity).bg,
                  color: maturityBadgeTone(row.maturity).text,
                  boxShadow: maturityBadgeTone(row.maturity).shadow,
                }}>
                {(row.maturity * 100).toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>

      {/* Summary footer */}
      <div className={`grid grid-cols-[1fr_70px_75px] px-3 py-2 text-[11px] font-bold border-t
        ${darkMode
          ? 'border-slate-700/50 bg-slate-800/60 text-slate-300'
          : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        <span>Total / Avg</span>
        <span className="text-right tabular-nums">{totalIndent.toLocaleString('en-IN')}</span>
        <span className="text-right tabular-nums"
          style={{ color: maturityColor(avgMaturity) }}>
          {(avgMaturity * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Main Dashboard Component
// ═══════════════════════════════════════════════════════════════════
export default function CentreMaturityDashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rangePreset, setRangePreset] = useState('STD'); // MTD | STD | WTD | Custom
  const [comparisonType, setComparisonType] = useState('PP');

  // API Live Data State
  const [centers, setCenters] = useState([]);
  const [seasonKpi, setSeasonKpi] = useState({
    indentQty: { value: '0', change: null, variance: null, isUp: true },
    purchaseQty: { value: '0', change: null, variance: null, isUp: true },
    maturity: { value: 0, variance: null, change: null, isUp: true },
    hasCompare: false,
    compareLabel: '',
  });
  const [seasonMapping, setSeasonMapping] = useState({});
  const [dbMaxDate, setDbMaxDate] = useState(null);
  const [dbMinDateStr, setDbMinDateStr] = useState('');
  const [dbMaxDateStr, setDbMaxDateStr] = useState('');
  const [loading, setLoading] = useState(true);
  const dateSeededRef = useRef(false);
  const fetchGenRef = useRef(0);
  const dateFromRef = useRef(dateFrom);
  const dateToRef = useRef(dateTo);
  const rangePresetRef = useRef(rangePreset);
  dateFromRef.current = dateFrom;
  dateToRef.current = dateTo;
  rangePresetRef.current = rangePreset;

  const clampToData = useCallback((iso) => {
    if (!iso) return iso;
    if (dbMinDateStr && iso < dbMinDateStr) return dbMinDateStr;
    if (dbMaxDateStr && iso > dbMaxDateStr) return dbMaxDateStr;
    return iso;
  }, [dbMinDateStr, dbMaxDateStr]);

  const seasonLabels = useMemo(() => {
    const refIso = dateTo || dbMaxDateStr || formatYMD(new Date());
    return getCockpitSeasonLabels(refIso, seasonMapping);
  }, [dateTo, dbMaxDateStr, seasonMapping]);

  /** Avoid setState when mapping is unchanged — otherwise params recreate and refetch forever. */
  const mergeSeasonMapping = useCallback((next) => {
    if (!next || typeof next !== 'object') return;
    setSeasonMapping((prev) => {
      const merged = { ...prev, ...next };
      try {
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
      } catch {
        /* fall through */
      }
      return merged;
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

  const compareBadgeLabel = useMemo(() => {
    const cmp = resolveCompareRange(dateFrom, dateTo);
    return cmp?.label ? `vs ${cmp.label}` : 'vs Prev. Period';
  }, [resolveCompareRange, dateFrom, dateTo]);

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      const cmp = resolveCompareRange(dateFrom, dateTo);
      if (cmp?.from) params.append('pyFrom', cmp.from);
      if (cmp?.to) params.append('pyTo', cmp.to);
      if (cmp?.label) params.append('compareLabel', cmp.label);

      const res = await api.get(`/bi/centre-maturity/data?${params.toString()}`);
      if (gen !== fetchGenRef.current) return;
      if (!res.data) return;

      const mappingFromApi = (res.data.seasonMapping && typeof res.data.seasonMapping === 'object')
        ? res.data.seasonMapping
        : null;
      if (mappingFromApi) {
        mergeSeasonMapping(mappingFromApi);
      }
      if (res.data.dateRange?.maxDate) setDbMaxDate(new Date(res.data.dateRange.maxDate));

      const minStr = res.data.dateRange?.minDate
        ? String(res.data.dateRange.minDate).slice(0, 10)
        : '';
      const maxStr = res.data.dateRange?.maxDate
        ? String(res.data.dateRange.maxDate).slice(0, 10)
        : '';
      if (minStr) setDbMinDateStr(minStr);
      if (maxStr) setDbMaxDateStr(maxStr);

      const userAlreadyPickedDates = Boolean(dateFromRef.current && dateToRef.current);

      // First response often has no From/To yet. Seed STD dates and wait —
      // do not paint the unfiltered (all-time) totals as STD.
      if (!dateFrom && !dateTo) {
        if (!userAlreadyPickedDates && minStr && maxStr && rangePresetRef.current === 'STD') {
          dateSeededRef.current = true;
          const toIso = resolveDashboardToDate(null, maxStr);
          const ref = toIso ? new Date(`${toIso}T12:00:00`) : new Date();
          const mappingForSeed = mappingFromApi
            ? { ...seasonMapping, ...mappingFromApi }
            : seasonMapping;
          const std = getCockpitPresetDateRange('STD', ref, mappingForSeed);
          const clamp = (iso) => {
            if (!iso) return iso;
            if (iso < minStr) return minStr;
            if (iso > maxStr) return maxStr;
            return iso;
          };
          setDateFrom(clamp(std.from) || minStr);
          setDateTo(clamp(std.to) || maxStr);
        }
        return;
      }

      dateSeededRef.current = true;
      setCenters(res.data.centers || []);
      if (res.data.seasonKpi) setSeasonKpi(res.data.seasonKpi);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      console.error('Failed to load Centre Maturity BI data:', err);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [dateFrom, dateTo, resolveCompareRange, mergeSeasonMapping]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleQuickDate = (type) => {
    if (type === 'Custom') {
      setRangePreset('Custom');
      return;
    }
    const toIso = resolveDashboardToDate(null, dbMaxDateStr);
    const today = toIso
      ? new Date(`${toIso}T12:00:00`)
      : (dbMaxDate || new Date());
    const { from, to } = getCockpitPresetDateRange(type, today, seasonMapping);
    setDateFrom(clampToData(from));
    setDateTo(clampToData(to));
    setRangePreset(type);
  };

  // Split center data into 4 columns for display
  const tables = useMemo(() => {
    if (!centers.length) return [[], [], [], []];
    const quarter = Math.ceil(centers.length / 4);
    return [
      centers.slice(0, quarter),
      centers.slice(quarter, quarter * 2),
      centers.slice(quarter * 2, quarter * 3),
      centers.slice(quarter * 3)
    ];
  }, [centers]);
  const globalTopRankMap = useMemo(() => {
    const source = searchQuery
      ? centers.filter(r => r.center.toLowerCase().includes(searchQuery.toLowerCase()))
      : centers;
    return new Map(
      [...source]
        .sort((a, b) => (b.maturity || 0) - (a.maturity || 0))
        .slice(0, 10)
        .map((r, idx) => [r.center, idx + 1])
    );
  }, [centers, searchQuery]);

  // Grand totals
  const grandTotalIndent = useMemo(() => centers.reduce((s, r) => s + (r.indent || 0), 0), [centers]);
  const grandTotalPurchase = useMemo(() => centers.reduce((s, r) => s + (r.purchase || 0), 0), [centers]);
  const grandAvgMaturity = useMemo(() => {
    if (grandTotalIndent === 0) return 0;
    return grandTotalPurchase / grandTotalIndent;
  }, [grandTotalIndent, grandTotalPurchase]);
  const totalCentersCount = centers.length;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode
        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900'}`}>

      <div className="mb-2 flex shrink-0 flex-col gap-2 p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BiDashboardHeader
            title="Centre Maturity Dashboard"
            subtitle={`SPE 26 · ${totalCentersCount} Centers${loading ? ' · Loading…' : ''}`}
            icon={MdNaturePeople}
            iconColor="#16a34a"
            isDarkMode={darkMode}
          />
          <div className="flex items-center gap-4">
            <BiKeyMetricBox
              value={totalCentersCount}
              title="Centers Evaluated"
              subtitle={rangePreset}
              isDarkMode={darkMode}
            />
          </div>
        </div>

        <BiFilterBarLayout isDarkMode={darkMode} setIsDarkMode={setDarkMode}>
          <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-1.5 sm:gap-2">
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Search</span>
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-sm w-[9rem] sm:w-[12rem]
                ${darkMode ? 'bg-slate-900 border-slate-600 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                <Search className="w-3.5 h-3.5 opacity-50" />
                <input type="text" placeholder="Center name..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className={`bg-transparent outline-none w-full text-[10px] sm:text-[11px] placeholder:text-slate-400
                    ${darkMode ? 'text-white' : 'text-slate-900'}`} />
              </div>
            </div>

            <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              {['MTD', 'STD', 'WTD'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleQuickDate(type)}
                  aria-pressed={rangePreset === type}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                    rangePreset === type
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                  }`}
                >
                  {type}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleQuickDate('Custom')}
                aria-pressed={rangePreset === 'Custom'}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  rangePreset === 'Custom'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                    : `text-slate-500 hover:text-slate-700 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}
              >
                Custom
              </button>
            </div>

            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>From</span>
              <input type="date" value={dateFrom}
                onChange={e => { setRangePreset('Custom'); setDateFrom(e.target.value); }}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px]
                  ${darkMode ? 'bg-slate-900 border-slate-600 text-slate-100 [color-scheme:dark]' : 'bg-white border-slate-200 text-slate-800'}`} />
            </div>

            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>To</span>
              <input type="date" value={dateTo}
                onChange={e => { setRangePreset('Custom'); setDateTo(e.target.value); }}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px]
                  ${darkMode ? 'bg-slate-900 border-slate-600 text-slate-100 [color-scheme:dark]' : 'bg-white border-slate-200 text-slate-800'}`} />
            </div>

            <div className={`flex min-w-0 w-full basis-full flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:w-auto sm:basis-auto sm:gap-2 sm:p-1.5 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
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

          </div>
        </BiFilterBarLayout>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* ─── Top KPI Cards (Indent & Purchase Qty) ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            title="Indent Qty (Qtl)"
            value={seasonKpi.indentQty.value}
            change={seasonKpi.indentQty.change}
            variance={seasonKpi.indentQty.variance}
            isUp={seasonKpi.indentQty.isUp}
            showChange={seasonKpi.hasCompare && seasonKpi.indentQty.change != null}
            icon={Wheat}
            darkMode={darkMode}
            accentColor="#3b82f6"
            subtitle={seasonKpi.compareLabel ? `vs ${seasonKpi.compareLabel}` : compareBadgeLabel}
          />
          <KpiCard
            title="Purchase Qty (Qtl)"
            value={seasonKpi.purchaseQty.value}
            change={seasonKpi.purchaseQty.change}
            variance={seasonKpi.purchaseQty.variance}
            isUp={seasonKpi.purchaseQty.isUp}
            showChange={seasonKpi.hasCompare && seasonKpi.purchaseQty.change != null}
            icon={ShoppingCart}
            darkMode={darkMode}
            accentColor="#10b981"
            subtitle={seasonKpi.compareLabel ? `vs ${seasonKpi.compareLabel}` : compareBadgeLabel}
          />

          {/* Average Maturity Card — use season KPI (same formula as PBI) */}
          <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
            ${darkMode ? 'bg-slate-900/80 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'}`}>
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${maturityColor((seasonKpi.maturity?.value || 0) / 100)}, ${maturityColor((seasonKpi.maturity?.value || 0) / 100)}88)` }} />
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={`text-[11px] font-semibold tracking-wide uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Maturity %
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-extrabold tracking-tight" style={{ color: maturityColor((seasonKpi.maturity?.value || grandAvgMaturity * 100) / 100) }}>
                    {(seasonKpi.maturity?.value != null
                      ? seasonKpi.maturity.value
                      : grandAvgMaturity * 100
                    ).toFixed(2)}%
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {seasonKpi.hasCompare && seasonKpi.maturity?.change != null ? (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold
                      ${seasonKpi.maturity.isUp
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                      {seasonKpi.maturity.isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {seasonKpi.maturity.variance != null && (
                        <span className="mr-0.5">{formatVariance(seasonKpi.maturity.variance)}</span>
                      )}
                      ({Number(seasonKpi.maturity.change).toFixed(2)}%)
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                      ${darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                      No prior data
                    </span>
                  )}
                  <span className={`text-[10px] font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {seasonKpi.compareLabel ? `vs ${seasonKpi.compareLabel}` : compareBadgeLabel}
                  </span>
                </div>
              </div>
              <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`} style={{ color: maturityColor((seasonKpi.maturity?.value || grandAvgMaturity * 100) / 100) }}>
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4 Tables Side-by-Side ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {tables.map((tableData, idx) => (
            <MaturityTable
              key={idx}
              data={tableData}
              tableIndex={idx}
              darkMode={darkMode}
              searchQuery={searchQuery}
              topRankMap={globalTopRankMap}
            />
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <InfoBadge
            text={`Live DB Connection • Connected to MySQL centre_indent_data & centre_purchase_data`}
            darkMode={darkMode}
          />
        </div>
      </main>
    </div>
  );
}
