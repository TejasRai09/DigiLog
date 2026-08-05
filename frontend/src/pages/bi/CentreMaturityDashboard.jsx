import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import api from '../../api/axios';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Award,
  Sun,
  Moon,
  Calendar,
  Search,
  Wheat,
  ShoppingCart,
  RefreshCw
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
  const [rangePreset, setRangePreset] = useState('Custom'); // MTD | STD | YTD | Custom
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedCompSeason, setSelectedCompSeason] = useState('');
  
  // API Live Data State
  const [centers, setCenters] = useState([]);
  const [seasonKpi, setSeasonKpi] = useState({
    indentQty: { value: '0', change: null, variance: null, isUp: true },
    purchaseQty: { value: '0', change: null, variance: null, isUp: true },
    maturity: { value: 0, variance: null, change: null, isUp: true },
    baseSeason: '',
    compSeason: '',
    hasCompare: false,
  });
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [compSeasons, setCompSeasons] = useState([]);
  const [seasonMapping, setSeasonMapping] = useState({});
  const [dbMaxDate, setDbMaxDate] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch Live Data from Backend
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (selectedSeason) params.append('season', selectedSeason);
      if (selectedCompSeason) params.append('compSeason', selectedCompSeason);

      const res = await api.get(`/bi/centre-maturity/data?${params.toString()}`);
      if (res.data) {
        setCenters(res.data.centers || []);
        if (res.data.seasonKpi) setSeasonKpi(res.data.seasonKpi);
        if (res.data.availableSeasons) setAvailableSeasons(res.data.availableSeasons);
        if (res.data.compSeasons) setCompSeasons(res.data.compSeasons);
        if (res.data.seasonMapping) setSeasonMapping(res.data.seasonMapping);
        if (res.data.dateRange?.maxDate) setDbMaxDate(new Date(res.data.dateRange.maxDate));
      }
    } catch (err) {
      console.error('Failed to load Centre Maturity BI data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedSeason, selectedCompSeason]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleQuickDate = (type) => {
    const today = dbMaxDate || new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed: 9 is October
    
    // Find the relevant season (either selected or the one that contains 'today')
    let activeSeasonLabel = selectedSeason;
    if (!activeSeasonLabel && Object.keys(seasonMapping).length > 0) {
      // Find which season today falls into
      for (const [label, mapping] of Object.entries(seasonMapping)) {
        const sStart = new Date(mapping.startDate);
        const sEnd = new Date(mapping.endDate);
        if (today >= sStart && today <= sEnd) {
          activeSeasonLabel = label;
          break;
        }
      }
      // Fallback to the latest season if today doesn't fall in any
      if (!activeSeasonLabel) {
        const sorted = Object.keys(seasonMapping).sort().reverse();
        activeSeasonLabel = sorted[0];
      }
    }

    // STD: Starts from the exact start_date of the active season, OR Oct 1st fallback
    let stdStart;
    if (activeSeasonLabel && seasonMapping[activeSeasonLabel]) {
      stdStart = new Date(seasonMapping[activeSeasonLabel].startDate);
    } else {
      let stdYear = year;
      if (month < 9) stdYear -= 1; 
      stdStart = new Date(stdYear, 9, 1);
    }

    // YTD: Starts from Jan 1st of the current calendar year
    const ytdStart = new Date(year, 0, 1);
    
    // MTD: Starts 1st of current month
    const mtdStart = new Date(year, month, 1);

    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    setRangePreset(type);
    setDateTo(formatDate(today));
    if (type === 'YTD') setDateFrom(formatDate(ytdStart));
    if (type === 'STD') setDateFrom(formatDate(stdStart));
    if (type === 'MTD') setDateFrom(formatDate(mtdStart));
    setSelectedSeason(''); // Clear season so date takes precedence
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

      {/* ─── Top Bar ───────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-300
        ${darkMode
          ? 'bg-slate-950/80 border-slate-800/50'
          : 'bg-white/80 border-slate-200/60'}`}>
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/bi"
              className={`p-1.5 rounded-lg transition-colors ${darkMode
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}>
              <MdArrowBack className="w-5 h-5" />
            </Link>
            <div>
              <h1 className={`text-lg font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Centre Maturity Dashboard
              </h1>
              <p className={`text-[10px] font-medium tracking-wide uppercase flex items-center gap-2
                ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>SPE 26 • {totalCentersCount} Centers</span>
                {loading && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
              </p>
            </div>
          </div>

          <button onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-xl transition-all duration-200 ${darkMode
                ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

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
            subtitle={seasonKpi.compSeason ? `vs ${seasonKpi.compSeason}` : 'Base Season'}
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
            subtitle={seasonKpi.compSeason ? `vs ${seasonKpi.compSeason}` : 'Base Season'}
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
                    {seasonKpi.compSeason ? `vs ${seasonKpi.compSeason}` : 'Purchase / Indent Ratio'}
                  </span>
                </div>
              </div>
              <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`} style={{ color: maturityColor((seasonKpi.maturity?.value || grandAvgMaturity * 100) / 100) }}>
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Filter Bar ────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-3.5 transition-colors duration-300
          ${darkMode
            ? 'bg-slate-900/60 border-slate-700/50'
            : 'bg-white border-slate-200/80 shadow-sm'}`}>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            {/* Search */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm flex-1 min-w-[200px] max-w-xs
              ${darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <Search className="w-3.5 h-3.5 opacity-50" />
              <input type="text" placeholder="Search center..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`bg-transparent outline-none w-full text-sm placeholder:text-slate-400
                  ${darkMode ? 'text-white' : 'text-slate-900'}`} />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Season Selector Filter */}
              {availableSeasons.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Base:
                    </span>
                    <select
                      value={selectedSeason}
                      onChange={e => { setRangePreset('Custom'); setSelectedSeason(e.target.value); }}
                      className={`px-3 py-1.5 rounded-xl border text-sm outline-none font-semibold transition-colors
                        ${darkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-200 text-slate-800'}`}>
                      <option value="">Latest</option>
                      {availableSeasons.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Comp:
                    </span>
                    <select
                      value={selectedCompSeason}
                      onChange={e => setSelectedCompSeason(e.target.value)}
                      className={`px-3 py-1.5 rounded-xl border text-sm outline-none font-semibold transition-colors
                        ${darkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-white border-slate-200 text-slate-800'}`}>
                      <option value="">Previous</option>
                      {(compSeasons.length ? compSeasons : availableSeasons).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

              {/* Quick Date Buttons */}
              <div className="flex items-center gap-1.5">
                {['MTD', 'STD', 'YTD'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleQuickDate(type)}
                    aria-pressed={rangePreset === type}
                    className={`px-2.5 py-1 text-xs font-extrabold tracking-wide rounded-lg transition-all
                      ${rangePreset === type
                        ? 'bg-blue-600 text-white border border-blue-600 shadow-sm ring-2 ring-blue-300/70'
                        : darkMode
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 border border-slate-200'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Date From */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm
                ${darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <Calendar className="w-3.5 h-3.5 opacity-50" />
                <input type="date" value={dateFrom}
                  onChange={e => { setRangePreset('Custom'); setDateFrom(e.target.value); }}
                  className={`bg-transparent outline-none text-sm
                    ${darkMode ? 'text-white [color-scheme:dark]' : 'text-slate-900'}`} />
              </div>

              <span className={`text-xs font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>to</span>

              {/* Date To */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm
                ${darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <Calendar className="w-3.5 h-3.5 opacity-50" />
                <input type="date" value={dateTo}
                  onChange={e => { setRangePreset('Custom'); setDateTo(e.target.value); }}
                  className={`bg-transparent outline-none text-sm
                    ${darkMode ? 'text-white [color-scheme:dark]' : 'text-slate-900'}`} />
              </div>

              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-blue-500 hover:underline font-semibold">
                  Clear
                </button>
              )}
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
