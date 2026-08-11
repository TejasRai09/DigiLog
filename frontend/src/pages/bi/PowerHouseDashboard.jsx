import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
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
import api from '../../api/axios';
import PowerProcessFlow from '../../components/bi/PowerProcessFlow';
import PowerSummaryView from '../../components/bi/PowerSummaryView';
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
import { formatYMD } from '../../utils/distilleryBiDateRange';

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
  const [preset, setPreset] = useState('ALL');
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
        const nextFrom = res.data?.meta?.from || min || '';
        const nextTo = res.data?.meta?.to || max || '';
        setFrom(nextFrom);
        setTo(nextTo);
        setPreset('ALL');
        setRangeReady(true);
        setPowerRows(Array.isArray(res.data?.powerRows) ? res.data.powerRows : []);
        setSteamRows(Array.isArray(res.data?.steamRows) ? res.data.steamRows : []);
        setStoppageRows(Array.isArray(res.data?.stoppageRows) ? res.data.stoppageRows : []);
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

  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (!rangeReady || !from || !to) return;
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      return;
    }
    load();
  }, [from, to, rangeReady, load]);

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'ALL' && dateBounds.min && dateBounds.max) {
      setFrom(dateBounds.min);
      setTo(dateBounds.max);
      return;
    }
    const r = getPresetRange(p);
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
      <header className={`shrink-0 z-30 border-b shadow-sm ${hdr}`}>
        <div className={`px-4 flex flex-wrap items-center gap-3 justify-between ${fitLayout ? 'py-2.5' : 'py-3'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/bi"
              className={`inline-flex items-center gap-1 text-xs font-bold ${dm ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <ArrowLeft className="w-4 h-4" /> BI
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight">Power House</h1>
              <p className={`text-[11px] font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                Generation · Steam · Outages
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'MTD', 'YTD', 'STD'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={!dateBounds.min || !dateBounds.max}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                  preset === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : dm
                      ? 'border-slate-700 text-slate-300'
                      : 'border-slate-200 text-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
            <input
              type="date"
              value={from}
              min={dateBounds.min || undefined}
              max={to || dateBounds.max || undefined}
              onChange={(e) => onFromChange(e.target.value)}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${dm ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            />
            <span className="text-xs opacity-50">→</span>
            <input
              type="date"
              value={to}
              min={from || dateBounds.min || undefined}
              max={dateBounds.max || undefined}
              onChange={(e) => onToChange(e.target.value)}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${dm ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            />
            <button
              type="button"
              onClick={() => setDm((v) => !v)}
              className={`p-2 rounded-lg border ${dm ? 'border-slate-700' : 'border-slate-200'}`}
              aria-label="Toggle theme"
            >
              {dm ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className={`px-4 flex gap-1 overflow-x-auto ${fitLayout ? 'pb-2' : 'pb-2'}`}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                tab === id
                  ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/30'
                  : dm
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

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
