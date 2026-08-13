import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Factory,
  Flame,
  Loader2,
  Moon,
  Plug,
  Sun,
  Table2,
  TimerReset,
  Zap,
} from 'lucide-react';
import { MdHouseSiding } from 'react-icons/md';
import api from '../../api/axios';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import PowerProcessFlow from '../../components/bi/PowerProcessFlow';
import PowerSummaryView from '../../components/bi/PowerSummaryView';
import { BiKeyMetricBox, BiFilterBarLayout } from '../../components/bi/BiLayoutElements';
import {
  PowerConsumptionView,
  PowerDataView,
  PowerGenerationView,
  PowerOutageView,
  SteamConsumptionView,
  SteamSummaryView,
} from '../../components/bi/PowerHouseTabViews';
import {
  buildDailySeries,
  buildOutageDailySeries,
  computeOutageKpis,
  computePowerKpis,
  computeSteamKpis,
  groupOutageBy,
} from '../../utils/powerHouseMeasures';
import { formatYMD, getMtdRangeForDashboard, resolveDashboardToDate } from '../../utils/distilleryBiDateRange';

const TABS = [
  { id: 'summary', label: 'Power Summary', icon: Activity },
  { id: 'generation', label: 'Generation', icon: Zap },
  { id: 'consumption', label: 'Consumption', icon: Plug },
  { id: 'steam-summary', label: 'Steam Summary', icon: Flame },
  { id: 'steam-consumption', label: 'Steam Consumption', icon: Flame },
  { id: 'outage', label: 'Outage', icon: TimerReset },
  { id: 'process', label: 'Process', icon: Factory },
  { id: 'data', label: 'Data', icon: Table2 },
];

const FIT_TABS = new Set([
  'summary',
  'generation',
  'consumption',
  'steam-summary',
  'steam-consumption',
  'outage',
  'process',
  'data',
]);

function getPresetRange(preset, now = new Date()) {
  const to = formatYMD(now);
  if (preset === 'STD') {
    const seasonStartYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: formatYMD(new Date(seasonStartYear, 9, 1)), to };
  }
  if (preset === 'YTD') return { from: formatYMD(new Date(now.getFullYear(), 0, 1)), to };
  return { from: formatYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to };
}

function clampDate(value, min, max) {
  if (!value) return value;
  let v = value;
  if (min && v < min) v = min;
  if (max && v > max) v = max;
  return v;
}

function clampRange(from, to, min, max) {
  let f = clampDate(from, min, max);
  let t = clampDate(to, min, max);
  if (f && t && f > t) {
    f = t;
  }
  return { from: f, to: t };
}

export default function PowerHouseDashboard() {
  const [tab, setTab] = useState('summary');
  const [dm, setDm] = useState(false);
  const [preset, setPreset] = useState('MTD');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dateBounds, setDateBounds] = useState({ min: null, max: null });
  const [rangeReady, setRangeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [powerRows, setPowerRows] = useState([]);
  const [steamRows, setSteamRows] = useState([]);
  const [stoppageRows, setStoppageRows] = useState([]);
  const [outageSection, setOutageSection] = useState('ALL');
  const [outageCategory, setOutageCategory] = useState('ALL');
  const [dataSub, setDataSub] = useState('power');

  const fitLayout = FIT_TABS.has(tab) && !loading;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/bi/power-house');
        if (cancelled) return;
        const bounds = res.data?.meta?.dateBounds || {};
        const min = bounds.min || null;
        const max = bounds.max || null;
        setDateBounds({ min, max });

        const isos = [];
        for (const row of [
          ...(Array.isArray(res.data?.powerRows) ? res.data.powerRows : []),
          ...(Array.isArray(res.data?.steamRows) ? res.data.steamRows : []),
          ...(Array.isArray(res.data?.stoppageRows) ? res.data.stoppageRows : []),
        ]) {
          const d = row?.Date != null ? String(row.Date).slice(0, 10) : '';
          if (d) isos.push(d);
        }
        const mtd = getMtdRangeForDashboard(isos.length ? isos : null, max);
        const clamped = clampRange(mtd.from, mtd.to, min, max);
        setFrom(clamped.from || min || '');
        setTo(clamped.to || max || '');
        setPreset('MTD');
        setRangeReady(true);
      } catch (err) {
        if (!cancelled) {
          setPowerRows([]);
          setSteamRows([]);
          setStoppageRows([]);
          setError(err.response?.data?.message || err.message || 'Failed to load Power House data.');
          setRangeReady(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!rangeReady || !from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to }).toString();
      const res = await api.get(`/bi/power-house?${qs}`);
      const bounds = res.data?.meta?.dateBounds || {};
      if (bounds.min || bounds.max) {
        setDateBounds((prev) => ({
          min: bounds.min || prev.min,
          max: bounds.max || prev.max,
        }));
      }
      setPowerRows(Array.isArray(res.data?.powerRows) ? res.data.powerRows : []);
      setSteamRows(Array.isArray(res.data?.steamRows) ? res.data.steamRows : []);
      setStoppageRows(Array.isArray(res.data?.stoppageRows) ? res.data.stoppageRows : []);
    } catch (err) {
      setPowerRows([]);
      setSteamRows([]);
      setStoppageRows([]);
      setError(err.response?.data?.message || err.message || 'Failed to load Power House data.');
    } finally {
      setLoading(false);
    }
  }, [from, to, rangeReady]);

  useEffect(() => {
    if (!rangeReady || !from || !to) return;
    load();
  }, [from, to, rangeReady, load]);

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'ALL' && dateBounds.min && dateBounds.max) {
      setFrom(dateBounds.min);
      setTo(dateBounds.max);
      return;
    }
    const toIso = resolveDashboardToDate(null, dateBounds.max);
    const ref = toIso ? new Date(`${toIso}T12:00:00`) : new Date();
    const r = getPresetRange(p, ref);
    const clamped = clampRange(r.from, r.to, dateBounds.min, dateBounds.max);
    setFrom(clamped.from);
    setTo(clamped.to);
  };

  const onFromChange = (value) => {
    setPreset('CUSTOM');
    const next = clampDate(value, dateBounds.min, dateBounds.max);
    setFrom(next);
    if (to && next && next > to) setTo(next);
  };

  const onToChange = (value) => {
    setPreset('CUSTOM');
    const next = clampDate(value, dateBounds.min, dateBounds.max);
    setTo(next);
    if (from && next && next < from) setFrom(next);
  };

  const powerKpis = useMemo(() => computePowerKpis(powerRows, steamRows), [powerRows, steamRows]);
  const steamKpis = useMemo(() => computeSteamKpis(steamRows), [steamRows]);
  const outageKpis = useMemo(() => computeOutageKpis(stoppageRows), [stoppageRows]);
  const daily = useMemo(() => buildDailySeries(powerRows, steamRows), [powerRows, steamRows]);

  const filteredStoppages = useMemo(() => {
    const wantSection = outageSection === 'ALL' ? null : String(outageSection).trim();
    const wantCategory = outageCategory === 'ALL' ? null : String(outageCategory).trim();
    return stoppageRows.filter((r) => {
      if (wantSection) {
        const sec = r.section != null ? String(r.section).trim() : '';
        if (sec !== wantSection) return false;
      }
      if (wantCategory) {
        const cat = r.category != null ? String(r.category).trim() : '';
        if (cat !== wantCategory) return false;
      }
      return true;
    });
  }, [stoppageRows, outageSection, outageCategory]);

  const outageDaily = useMemo(() => buildOutageDailySeries(filteredStoppages), [filteredStoppages]);
  const outageBySection = useMemo(() => groupOutageBy(filteredStoppages, 'section'), [filteredStoppages]);

  const sections = useMemo(() => {
    const s = new Set(
      stoppageRows.map((r) => (r.section != null && String(r.section).trim() ? String(r.section).trim() : null)).filter(Boolean),
    );
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [stoppageRows]);

  const categories = useMemo(() => {
    const s = new Set(
      stoppageRows.map((r) => (r.category != null && String(r.category).trim() ? String(r.category).trim() : null)).filter(Boolean),
    );
    return ['ALL', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [stoppageRows]);

  // Keep select values valid when the range changes (otherwise charts look empty).
  useEffect(() => {
    if (outageSection !== 'ALL' && !sections.includes(outageSection)) setOutageSection('ALL');
  }, [sections, outageSection]);
  useEffect(() => {
    if (outageCategory !== 'ALL' && !categories.includes(outageCategory)) setOutageCategory('ALL');
  }, [categories, outageCategory]);

  const consumptionPie = useMemo(
    () =>
      [
        { name: 'Sugar', value: powerKpis.Export_Sugar || 0, color: '#8b5cf6' },
        { name: 'Aux / Cogen', value: powerKpis.Export_Cogen || 0, color: '#06b6d4' },
        { name: 'Dist + CPU', value: powerKpis.PowerCons_Dist_CPU_4MW || 0, color: '#10b981' },
      ].filter((d) => d.value > 0),
    [powerKpis],
  );

  const externalPie = useMemo(
    () =>
      [
        { name: 'Grid Export', value: powerKpis.ExportGrid30 || 0, color: '#3b82f6' },
        { name: 'Inhouse', value: powerKpis.Total_Internal_Con || 0, color: '#f59e0b' },
      ].filter((d) => d.value > 0),
    [powerKpis],
  );

  const pageBg = dm ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800';
  const hdr = dm ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80';

  return (
    <div className={`${pageBg} ${fitLayout ? 'h-dvh overflow-hidden flex flex-col' : 'min-h-screen'}`}>
      <div className="mb-2 flex shrink-0 flex-col gap-2 p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BiDashboardHeader
            title="Power House"
            subtitle="Generation · Steam · Outages"
            icon={MdHouseSiding}
            iconColor="#f59e0b"
            isDarkMode={dm}
          />
          <div className="flex items-center gap-4">
            <BiKeyMetricBox
              value={daily.length}
              title="Operating Days"
              subtitle={preset}
              isDarkMode={dm}
            />
          </div>
        </div>

        <BiFilterBarLayout isDarkMode={dm} setIsDarkMode={setDm}>
          <div className={`flex min-w-0 w-full basis-full flex-wrap items-center gap-0.5 rounded-xl border p-0.5 sm:w-auto sm:basis-auto sm:flex-nowrap ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] flex items-center gap-1 ${
                  tab === id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : `text-slate-500 hover:text-slate-700 ${dm ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}
              >
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${dm ? 'bg-slate-600' : 'bg-slate-200'}`} />
          <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {['ALL', 'MTD', 'YTD', 'STD'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={!dateBounds.min || !dateBounds.max}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  preset === p
                    ? 'bg-blue-600 text-white shadow-md'
                    : `text-slate-500 hover:text-slate-700 ${dm ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap items-end gap-1.5 sm:gap-2">
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>From</span>
              <input
                type="date"
                value={from}
                min={dateBounds.min || undefined}
                max={to || dateBounds.max || undefined}
                onChange={(e) => onFromChange(e.target.value)}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}
              />
            </div>
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>To</span>
              <input
                type="date"
                value={to}
                min={from || dateBounds.min || undefined}
                max={dateBounds.max || undefined}
                onChange={(e) => onToChange(e.target.value)}
                className={`w-[6.75rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7.25rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}
              />
            </div>
          </div>
        </BiFilterBarLayout>
      </div>

      <main
        className={`w-full ${
          loading
            ? 'relative min-h-[calc(100vh-8.5rem)] px-3 py-5'
            : fitLayout
              ? 'flex-1 min-h-0 px-3 py-2 overflow-hidden flex flex-col'
              : 'px-4 py-5'
        }`}
      >
        {loading && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className={`flex flex-col items-center gap-3 rounded-2xl border px-8 py-7 shadow-lg ${
                dm ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'
              }`}
            >
              <Loader2 className={`w-9 h-9 animate-spin ${dm ? 'text-blue-400' : 'text-blue-600'}`} />
              <p className={`text-sm font-bold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                Loading Power House…
              </p>
              <p className={`text-[11px] font-semibold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                Fetching power, steam &amp; outage data
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div
            className={`rounded-2xl border p-4 text-sm font-semibold ${
              dm ? 'border-rose-900 bg-rose-950/40 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {error}
          </div>
        )}

        {!loading && !error && tab === 'summary' && (
          <PowerSummaryView powerKpis={powerKpis} daily={daily} dm={dm} />
        )}

        {!loading && !error && tab === 'generation' && (
          <PowerGenerationView powerKpis={powerKpis} daily={daily} dm={dm} />
        )}

        {!loading && !error && tab === 'consumption' && (
          <PowerConsumptionView
            powerKpis={powerKpis}
            daily={daily}
            consumptionPie={consumptionPie}
            externalPie={externalPie}
            dm={dm}
          />
        )}

        {!loading && !error && tab === 'steam-summary' && (
          <SteamSummaryView steamKpis={steamKpis} daily={daily} dm={dm} />
        )}

        {!loading && !error && tab === 'steam-consumption' && (
          <SteamConsumptionView steamKpis={steamKpis} daily={daily} dm={dm} />
        )}

        {!loading && !error && tab === 'outage' && (
          <PowerOutageView
            dm={dm}
            sections={sections}
            categories={categories}
            outageSection={outageSection}
            outageCategory={outageCategory}
            setOutageSection={setOutageSection}
            setOutageCategory={setOutageCategory}
            filteredStoppages={filteredStoppages}
            outageKpis={outageKpis}
            outageDaily={outageDaily}
            outageBySection={outageBySection}
          />
        )}

        {!loading && !error && tab === 'process' && (
          <PowerProcessFlow powerKpis={powerKpis} steamKpis={steamKpis} dm={dm} />
        )}

        {!loading && !error && tab === 'data' && (
          <PowerDataView
            dm={dm}
            dataSub={dataSub}
            setDataSub={setDataSub}
            powerRows={powerRows}
            steamRows={steamRows}
            stoppageRows={stoppageRows}
          />
        )}
      </main>
    </div>
  );
}
