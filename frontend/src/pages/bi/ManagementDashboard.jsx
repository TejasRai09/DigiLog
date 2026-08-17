import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaIndustry, FaLeaf, FaCubes } from 'react-icons/fa';
import {
  MdElectricBolt,
  MdFilterList,
  MdInsights,
  MdOutlineCalendarMonth,
  MdScience,
} from 'react-icons/md';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiFilterBarLayout } from '../../components/bi/BiLayoutElements';
import ManagementKpiCell from '../../components/bi/ManagementKpiCell';
import ManagementKpiExpandModal from '../../components/bi/ManagementKpiExpandModal';
import {
  buildManagementDashboardStatic,
  filterKpiSeries,
} from '../../data/managementDashboardStaticData';
import { MANAGEMENT_DATE_BOUNDS } from '../../data/managementDashboardMeta';
import { formatYMD } from '../../utils/distilleryBiDateRange';

const PRESETS = [
  { id: 'STD', label: 'STD' },
  { id: 'MTD', label: 'MTD' },
  { id: 'YTD', label: 'YTD' },
  { id: 'ALL', label: 'All' },
];

function getPresetRange(preset, ref = new Date()) {
  const to = formatYMD(ref);
  if (preset === 'STD') {
    const seasonStartYear = ref.getMonth() >= 9 ? ref.getFullYear() : ref.getFullYear() - 1;
    return { from: formatYMD(new Date(seasonStartYear, 9, 1)), to };
  }
  if (preset === 'YTD') return { from: formatYMD(new Date(ref.getFullYear(), 0, 1)), to };
  if (preset === 'ALL') return { from: null, to: null };
  return { from: formatYMD(new Date(ref.getFullYear(), ref.getMonth(), 1)), to };
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
        className="h-14 w-14 object-contain drop-shadow-sm sm:h-16 sm:w-16"
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
  const staticData = useMemo(() => buildManagementDashboardStatic(), []);
  const dateBounds = staticData.dateBounds;

  const [dm, setDm] = useState(false);
  const [preset, setPreset] = useState('STD');
  const [from, setFrom] = useState(MANAGEMENT_DATE_BOUNDS.from);
  const [to, setTo] = useState(MANAGEMENT_DATE_BOUNDS.to);
  const [expandedKpi, setExpandedKpi] = useState(null);
  const [expandedSeries, setExpandedSeries] = useState([]);

  const dma = staticData.dma;

  const rowsWithFilteredSeries = useMemo(() => {
    return staticData.rows.map((row) => ({
      ...row,
      kpis: row.kpis.map((kpi) => ({
        ...kpi,
        filteredSeries: filterKpiSeries(kpi.series, from, to),
      })),
    }));
  }, [staticData.rows, from, to]);

  const applyPreset = useCallback(
    (p) => {
      setPreset(p);
      if (p === 'ALL') {
        setFrom(dateBounds.min || dateBounds.from);
        setTo(dateBounds.max || dateBounds.to);
        return;
      }
      const ref = new Date(`${MANAGEMENT_DATE_BOUNDS.to}T12:00:00`);
      const r = getPresetRange(p, ref);
      const min = dateBounds.min || dateBounds.from;
      const max = dateBounds.max || dateBounds.to;
      const clamped = clampRange(r.from, r.to, min, max);
      setFrom(clamped.from || min);
      setTo(clamped.to || max);
    },
    [dateBounds],
  );

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

  return (
    <div className={`${shell} flex h-[calc(100dvh-4rem)] flex-col overflow-hidden`}>
      <div className="shrink-0 space-y-2 p-2 sm:p-3">
        <BiDashboardHeader
          title="Management Dashboard"
          subtitle="Executive KPI summary — season values with PBI trend charts"
          icon={MdInsights}
          iconColor="#6366f1"
          isDarkMode={dm}
        />

        <BiFilterBarLayout isDarkMode={dm} setIsDarkMode={setDm}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
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

            <div className={`hidden h-6 w-px sm:block ${dm ? 'bg-slate-600' : 'bg-slate-200'}`} />

            <label className={`flex items-center gap-1 text-[11px] font-bold ${dm ? 'text-slate-300' : 'text-slate-600'}`}>
              <MdOutlineCalendarMonth className="h-4 w-4" />
              <input
                type="date"
                value={from}
                min={dateBounds.from}
                max={to || dateBounds.to}
                onChange={(e) => {
                  setPreset('CUSTOM');
                  setFrom(e.target.value);
                }}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                  dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}
              />
            </label>
            <span className={`text-[11px] font-bold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>to</span>
            <input
              type="date"
              value={to}
              min={from || dateBounds.from}
              max={dateBounds.to}
              onChange={(e) => {
                setPreset('CUSTOM');
                setTo(e.target.value);
              }}
              className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
              }`}
            />

            <span className={`ml-1 rounded-lg px-2 py-1 text-[11px] font-black ${dm ? 'bg-red-950 text-red-300' : 'bg-red-50 text-red-600'}`}>
              {dma} DMA
            </span>
          </div>
        </BiFilterBarLayout>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 sm:px-3 sm:pb-3">
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm ${
            dm ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white'
          }`}
        >
          <div
            className={`flex shrink-0 items-center justify-between border-b px-3 py-1.5 sm:px-4 sm:py-2 ${
              dm ? 'border-slate-700' : 'border-slate-100'
            }`}
          >
            <div className="min-w-0">
              <h2 className={`truncate text-xs font-black sm:text-sm ${dm ? 'text-slate-100' : 'text-slate-800'}`}>
                Operations Summary
              </h2>
              <p className={`truncate text-[10px] sm:text-xs ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                {periodLabel || 'Select a date range'}
              </p>
            </div>
            <MdFilterList className={`h-4 w-4 shrink-0 ${dm ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col gap-1.5 p-1.5 sm:gap-2 sm:p-2 ${
              dm ? 'bg-slate-950/40' : 'bg-slate-50/80'
            }`}
          >
            {rowsWithFilteredSeries.map((row) => (
              <div key={row.id} className="flex min-h-0 flex-1 gap-1.5 sm:gap-2">
                <div
                  className={`${row.color} flex w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2 shadow-sm sm:w-28 sm:rounded-2xl sm:px-3`}
                >
                  <RowIcon iconName={row.icon} />
                  <span className="text-center text-[10px] font-black capitalize leading-tight tracking-wide text-slate-800 sm:text-xs">
                    {row.title}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 gap-1.5 sm:gap-2">
                  {row.kpis.map((kpi) => (
                    <ManagementKpiCell
                      key={kpi.id}
                      kpi={kpi}
                      isDarkMode={dm}
                      onExpand={handleExpand}
                      filteredSeries={kpi.filteredSeries}
                    />
                  ))}
                </div>
              </div>
            ))}
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
