import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaIndustry, FaLeaf, FaCubes } from 'react-icons/fa';
import {
  MdElectricBolt,
  MdFilterList,
  MdInsights,
  MdOutlineCalendarMonth,
  MdScience,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiFilterBarLayout, BiKeyMetricBox } from '../../components/bi/BiLayoutElements';
import ManagementKpiCell from '../../components/bi/ManagementKpiCell';
import ManagementKpiExpandModal from '../../components/bi/ManagementKpiExpandModal';
import Spinner from '../../components/Spinner';
import { filterKpiSeries } from '../../data/managementDashboardStaticData';
import { MANAGEMENT_DATE_BOUNDS } from '../../data/managementDashboardMeta';
import { mergeManagementDashboardApi } from '../../utils/mergeManagementDashboardApi';
import {
  formatYMD,
  computePriorPeriodRange,
  getSeasonComparisonLabels,
  alignCrushingSeasonCompareRange,
  seasonLabelForComparisonType,
} from '../../utils/distilleryBiDateRange';

const PRESETS = [
  { id: 'STD', label: 'STD' },
  { id: 'MTD', label: 'MTD' },
  { id: 'YTD', label: 'YTD' },
  { id: 'ALL', label: 'All' },
];

function getPresetRange(preset, ref = new Date(), bounds = {}) {
  const to = formatYMD(ref);
  const min = bounds.min || bounds.from;
  const max = bounds.max || bounds.to || to;

  if (preset === 'STD') {
    const seasonStartYear = ref.getMonth() >= 9 ? ref.getFullYear() : ref.getFullYear() - 1;
    return clampRange(
      formatYMD(new Date(seasonStartYear, 9, 1)),
      to,
      min,
      max,
    );
  }
  if (preset === 'YTD') {
    return clampRange(formatYMD(new Date(ref.getFullYear(), 0, 1)), to, min, max);
  }
  if (preset === 'ALL') return { from: min, to: max };
  return clampRange(formatYMD(new Date(ref.getFullYear(), ref.getMonth(), 1)), to, min, max);
}

function clampRange(from, to, min, max) {
  let f = from;
  let t = to;
  if (min && f && f < min) f = min;
  if (max && t && t > max) t = max;
  if (max && f && f > max) f = max;
  if (min && t && t < min) t = min;
  if (f && t && f > t) f = t;
  return { from: f, to: t };
}

const ROW_ICON_FILES = {
  cane: '/images/dashboard-icons/sugarcane%20(3).png',
  milling: '/images/dashboard-icons/milling.png',
  sugar: '/images/dashboard-icons/sugar.png',
  power: '/images/dashboard-icons/power-industry.png',
  distillery: '/images/dashboard-icons/distillary.png',
};

function RowIcon({ iconName }) {
  const src = ROW_ICON_FILES[iconName];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-10 w-10 object-contain drop-shadow-sm sm:h-11 sm:w-11 lg:h-12 lg:w-12"
        draggable={false}
      />
    );
  }
  switch (iconName) {
    case 'cane':
      return <FaLeaf className="h-10 w-10 text-green-700" />;
    case 'milling':
      return <FaIndustry className="h-10 w-10 text-orange-700" />;
    case 'sugar':
      return <FaCubes className="h-10 w-10 text-amber-600" />;
    case 'power':
      return <MdElectricBolt className="h-10 w-10 text-yellow-600" />;
    case 'distillery':
      return <MdScience className="h-10 w-10 text-pink-600" />;
    default:
      return <MdInsights className="h-10 w-10 text-slate-500" />;
  }
}

export default function ManagementDashboard() {
  const [dm, setDm] = useState(false);
  const [preset, setPreset] = useState('STD');
  const [from, setFrom] = useState(MANAGEMENT_DATE_BOUNDS.from);
  const [to, setTo] = useState(MANAGEMENT_DATE_BOUNDS.to);
  const [expandedKpi, setExpandedKpi] = useState(null);
  const [expandedSeries, setExpandedSeries] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Compare toggle — always one of 'PP'/'S1'/'S2'
  const [compareType, setCompareType] = useState('PP');
  const [pyData, setPyData] = useState(null);
  const [pyLoading, setPyLoading] = useState(false);

  const dateBounds = dashboardData?.dateBounds || MANAGEMENT_DATE_BOUNDS;
  const dma = dashboardData?.dma ?? 7;

  const fetchDashboard = useCallback(async (fromDate, toDate) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      params.set('dma', String(dma));
      const { data } = await api.get(`/bi/management-dashboard?${params.toString()}`);
      const merged = mergeManagementDashboardApi(data);
      setDashboardData(merged);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load Management Dashboard.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dma]);

  useEffect(() => {
    fetchDashboard(from, to);
  }, [from, to, fetchDashboard]);

  // ── Prior-period range ──────────────────────────────────────────────
  const priorRange = useMemo(() => {
    if (compareType === 'PP') {
      return computePriorPeriodRange(from, to, preset);
    }
    // Season comparison — crushing season Oct–Sep (matches STD preset)
    const seasonLabel = seasonLabelForComparisonType(compareType, seasonLabels);
    if (!seasonLabel) return null;
    const { start, end } = alignCrushingSeasonCompareRange(from, to, seasonLabel);
    return { start, end, label: seasonLabel };
  }, [compareType, from, to, preset]);

  // Compute compare label for display
  const compareLabel = useMemo(() => {
    if (!priorRange) return null;
    const fmt = (d) => {
      if (!d) return '';
      const dt = new Date(`${d}T12:00:00`);
      return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    return `${priorRange.label} (${fmt(priorRange.start)} – ${fmt(priorRange.end)})`;
  }, [compareType, priorRange]);

  // Fetch prior-period data whenever priorRange changes
  useEffect(() => {
    if (!priorRange) {
      setPyData(null);
      return;
    }
    let cancelled = false;
    setPyLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('from', priorRange.start);
        params.set('to', priorRange.end);
        params.set('dma', String(dma));
        const { data } = await api.get(`/bi/management-dashboard?${params.toString()}`);
        const merged = mergeManagementDashboardApi(data);
        if (!cancelled) setPyData(merged);
      } catch {
        if (!cancelled) setPyData(null);
      } finally {
        if (!cancelled) setPyLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [priorRange, dma]);

  // ── Season labels for the compare toggle ────────────────────────────
  const seasonLabels = useMemo(() => {
    const ref = dateBounds.max ? new Date(`${dateBounds.max}T12:00:00`) : new Date();
    return getSeasonComparisonLabels(ref);
  }, [dateBounds.max]);

  const compareOptions = useMemo(() => [
    { id: 'PP', label: preset === 'MTD' ? 'Prev. Month' : preset === 'STD' ? 'Prev. Season' : preset === 'YTD' ? 'Prev. Year' : 'Prev. Period' },
    { id: 'S1', label: seasonLabels.season1 },
    { id: 'S2', label: seasonLabels.season2 },
  ], [preset, seasonLabels]);

  const calcDelta = useCallback((curValue, prevValue) => {
    const parseCompareNum = (value) => {
      if (value == null || value === '' || value === '(Blank)') return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      const n = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
      return Number.isFinite(n) ? n : null;
    };
    const cur = parseCompareNum(curValue);
    const prev = parseCompareNum(prevValue);
    if (cur == null || prev == null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }, []);

  // ── Rows with filtered series + compare delta injected ────────────────
  const rowsWithFilteredSeries = useMemo(() => {
    if (!dashboardData?.rows) return [];

    const pyRows = pyData?.rows ?? null;

    return dashboardData.rows.map((row) => {
      const pyRow = pyRows ? pyRows.find((r) => r.id === row.id) : null;

      return {
        ...row,
        kpis: row.kpis.map((kpi) => {
          const pyKpi = pyRow ? pyRow.kpis.find((k) => k.id === kpi.id) : null;

          const compareVal = pyKpi != null ? calcDelta(kpi.value, pyKpi.value) : null;
          const subValues = Array.isArray(kpi.subValues)
            ? kpi.subValues.map((sub) => {
                const prevSub = pyKpi?.subValues?.find((s) => s.label === sub.label);
                return {
                  ...sub,
                  compareVal: prevSub ? calcDelta(sub.value, prevSub.value) : null,
                };
              })
            : [];

          return {
            ...kpi,
            compareVal,
            subValues,
            filteredSeries: filterKpiSeries(kpi.series, from, to),
          };
        }),
      };
    });
  }, [dashboardData?.rows, pyData, from, to, calcDelta]);

  const applyPreset = useCallback(
    (p) => {
      setPreset(p);
      const ref = dateBounds.max ? new Date(`${dateBounds.max}T12:00:00`) : new Date();
      const r = getPresetRange(p, ref, dateBounds);
      setFrom(r.from || dateBounds.min);
      setTo(r.to || dateBounds.max);
    },
    [dateBounds],
  );

  useEffect(() => {
    if (!dashboardData?.dateBounds?.min) return;
    if (preset === 'STD' && from === MANAGEMENT_DATE_BOUNDS.from) {
      applyPreset('STD');
    }
  }, [dashboardData?.dateBounds?.min]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExpand = useCallback(
    (kpi) => {
      setExpandedKpi(kpi);
      setExpandedSeries(filterKpiSeries(kpi.series, from, to));
    },
    [from, to],
  );

  const handleCloseExpand = useCallback(() => {
    setExpandedKpi(null);
    setExpandedSeries([]);
  }, []);

  useEffect(() => {
    if (expandedKpi) {
      setExpandedSeries(filterKpiSeries(expandedKpi.series, from, to));
    }
  }, [from, to, expandedKpi]);

  const shell = useMemo(
    () =>
      dm
        ? 'bg-slate-950 text-slate-100'
        : 'bg-slate-50 text-slate-900',
    [dm],
  );

  const periodLabel = from && to ? `${from} → ${to}` : '';
  const daysElapsed = dashboardData?.daysElapsed ?? null;

  if (loading && !dashboardData) {
    return (
      <div className={`${shell} flex h-[calc(100dvh-3rem)] items-center justify-center`}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`${shell} flex h-[calc(100dvh-3rem)] flex-col overflow-hidden`}>
      <div className="shrink-0 space-y-1 px-1.5 py-1 sm:px-2">
        <BiDashboardHeader
          title="Management Dashboard"
          icon={MdInsights}
          iconColor="#6366f1"
          isDarkMode={dm}
          compact
          actions={
        <BiFilterBarLayout isDarkMode={dm} setIsDarkMode={setDm} compact alignEnd>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-black transition ${
                  preset === p.id
                    ? 'bg-indigo-600 text-white'
                    : dm
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}

            <div className={`hidden h-4 w-px sm:block ${dm ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <label className={`flex items-center gap-0.5 text-[10px] font-bold ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
              <MdOutlineCalendarMonth className="h-3.5 w-3.5" />
              <input
                type="date"
                value={from || ''}
                min={dateBounds.min || dateBounds.from}
                max={to || dateBounds.max || dateBounds.to}
                onChange={(e) => {
                  setPreset('CUSTOM');
                  setFrom(e.target.value);
                }}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                  dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}
              />
            </label>
            <span className={`text-[10px] font-bold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>to</span>
            <input
              type="date"
              value={to || ''}
              min={from || dateBounds.min || dateBounds.from}
              max={dateBounds.max || dateBounds.to}
              onChange={(e) => {
                setPreset('CUSTOM');
                setTo(e.target.value);
              }}
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
              }`}
            />

            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${dm ? 'bg-red-950 text-red-300' : 'bg-red-50 text-red-600'}`}>
              {dma} DMA
            </span>

            {loading && <Spinner size="sm" />}

            <div className={`hidden h-4 w-px sm:block ${dm ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <span className={`shrink-0 whitespace-nowrap text-[8px] font-bold uppercase tracking-wider ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
              Compare:
            </span>
            <div className={`flex min-w-0 flex-wrap gap-0.5 rounded-md border p-0.5 ${dm ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              {compareOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCompareType(opt.id)}
                  className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-black transition-all sm:text-[9px] ${
                    compareType === opt.id
                      ? dm ? 'bg-slate-700 text-slate-100 shadow-sm' : 'bg-slate-800 text-white shadow-sm'
                      : `text-slate-500 ${dm ? 'hover:bg-slate-700/50 hover:text-slate-300' : 'hover:bg-slate-100 hover:text-slate-700'}`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {pyLoading && <Spinner size="sm" />}
          </div>

          {daysElapsed != null && (
            <BiKeyMetricBox
              value={daysElapsed}
              title="Days"
              isDarkMode={dm}
              compact
              tooltip={`Days elapsed · ${periodLabel || ''}`}
            />
          )}
        </BiFilterBarLayout>
          }
        />
      </div>

      {error && (
        <div className={`mx-3 mb-2 rounded-lg px-3 py-2 text-xs ${dm ? 'bg-red-950 text-red-300' : 'bg-red-50 text-red-700'}`}>
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 pb-1.5 sm:px-2 sm:pb-2">
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-sm ${
            dm ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white'
          }`}
        >
          {/* Responsive zoom-out so 5 rows × 7 KPIs fit without clutter on laptop/monitor */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className={`flex h-[122%] w-[122%] origin-top-left scale-[0.82] flex-col gap-1 p-1 lg:h-[114%] lg:w-[114%] lg:scale-[0.88] xl:h-[109%] xl:w-[109%] xl:scale-[0.92] 2xl:h-[104%] 2xl:w-[104%] 2xl:scale-[0.96] ${
                dm ? 'bg-slate-950/40' : 'bg-slate-50/80'
              }`}
            >
              {rowsWithFilteredSeries.map((row) => (
                <div key={row.id} className="flex min-h-0 flex-1 gap-1">
                  <div
                    className={`${row.color} flex w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 shadow-sm sm:w-[4.75rem] lg:w-20`}
                  >
                    <RowIcon iconName={row.icon} />
                    <span className="text-center text-[8px] font-black capitalize leading-tight tracking-wide text-slate-800 sm:text-[9px]">
                      {row.title}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 gap-1">
                    {row.kpis.map((kpi) => (
                      <ManagementKpiCell
                        key={kpi.id}
                        kpi={kpi}
                        isDarkMode={dm}
                        onExpand={handleExpand}
                        filteredSeries={kpi.filteredSeries}
                        showCompare
                        compareLabel={compareLabel}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ManagementKpiExpandModal
        kpi={expandedKpi}
        series={expandedSeries}
        periodLabel={periodLabel}
        isDarkMode={dm}
        onClose={handleCloseExpand}
      />
    </div>
  );
}
