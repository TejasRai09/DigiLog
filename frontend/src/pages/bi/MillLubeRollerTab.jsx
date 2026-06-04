import { useEffect, useMemo, useState } from 'react';
import { MdOpacity, MdRefresh, MdThermostat, MdGridView } from 'react-icons/md';
import {
  CartesianGrid,
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
import ChartCardToolbar from '../../components/bi/ChartCardToolbar';
import MillChartExpandModal from '../../components/bi/MillChartExpandModal';
import MillRawDataTable from '../../components/bi/MillRawDataTable';
import {
  buildLogbookColumns,
  buildLogbookTableRows,
  collectVariableKeys,
} from '../../utils/millingBiRawTable';

/* ─── Sub-tabs ────────────────────────────────────────────────────────────── */
const SUB_TABS = [
  { id: 'summary',  label: 'Summary - Lube Press & Roller Temp', icon: MdOpacity,  enabled: true },
  { id: 'grid',     label: 'Lube Pump & Roller Temp Grid',        icon: MdGridView, enabled: true },
];

/* ─── Unit slicer options (Summary sub-tab) ───────────────────────────────── */
const UNIT_SLICERS = ['Lube Pump Pressure', 'Mill 0', 'Mill 1', 'Mill 2', 'Mill 3', 'Mill 4'];

/* ─── Lube Pump Pressure params (when "Lube Pump Pressure" selected) ──────── */
const PRESSURE_PARAMS = [
  { variable: 'LubePressure_ACC',   label: 'ACC Pump Line',    unit: 'kg/cm²', color: '#3b82f6' },
  { variable: 'LubePressure_MCC',   label: 'MCC Pump Line',    unit: 'kg/cm²', color: '#14b8a6' },
  { variable: 'LubePressure_M0',    label: 'Mill 0 Supply',    unit: 'kg/cm²', color: '#6366f1' },
  { variable: 'LubePressure_Shred', label: 'Shredder Line',    unit: 'kg/cm²', color: '#f43f5e' },
];

/* ─── Roller Temp params (when a Mill is selected) ────────────────────────── */
const ROLLER_PARAMS = [
  { suffix: 'gsB',  label: 'Gear Side (B)',     color: '#3b82f6' },
  { suffix: 'gsT',  label: 'Gear Side (T)',     color: '#1e3a8a' },
  { suffix: 'gsUF', label: 'Gear Side (U/F)',   color: '#f97316' },
  { suffix: 'psB',  label: 'Pintal Side (B)',   color: '#8b5cf6' },
  { suffix: 'psT',  label: 'Pintal Side (T)',   color: '#ec4899' },
  { suffix: 'psUF', label: 'Pintal Side (U/F)', color: '#4338ca' },
];

/* ─── Grid panels config ──────────────────────────────────────────────────── */
const GRID_PANELS = [
  {
    key: 'lube-pressure',
    title: 'Lube Pump Pressure (Kg/Sq.cm)',
    lines: PRESSURE_PARAMS.map((p) => ({ variable: p.variable, label: p.label, color: p.color })),
    domain: [1.5, 5],
  },
  ...['M0', 'M1', 'M2', 'M3', 'M4'].map((mill) => ({
    key: `roller-${mill}`,
    title: `${mill.replace('M', 'Mill ')} (Degree Celsius)`,
    lines: ROLLER_PARAMS.map((r) => ({ variable: `${mill}_${r.suffix}`, label: r.label, color: r.color })),
    domain: [15, 50],
  })),
];

/* ─── Data hook ───────────────────────────────────────────────────────────── */
function useLubeRollerData() {
  const [data, setData] = useState({ mapping: [], series: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: resp } = await api.get('/bi/milling-lube-roller');
        if (cancelled) return;
        setData({
          mapping: Array.isArray(resp?.mapping) ? resp.mapping : [],
          series: Array.isArray(resp?.series) ? resp.series : [],
        });
      } catch (err) {
        if (!cancelled) {
          setData({ mapping: [], series: [] });
          setError(err.response?.data?.message || err.message || 'Failed to load lube/roller data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) };
}

/* ─── Tooltip ─────────────────────────────────────────────────────────────── */
function LubeTooltip({ active, payload, label, lines, isDarkMode }) {
  if (!active || !payload?.length) return null;
  const entries = payload
    .map((p) => ({
      label: lines.find((l) => l.variable === p.dataKey)?.label || p.name || p.dataKey,
      color: p.color,
      value: p.value,
    }))
    .filter((e) => e.value != null);
  if (!entries.length) return null;
  return (
    <div className={`rounded-xl border p-2 text-[10px] font-bold shadow-xl backdrop-blur-sm ${
      isDarkMode ? 'border-slate-700 bg-slate-800/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-700'
    }`}>
      <p className={`mb-1 border-b pb-1 ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>{label}</p>
      <div className="space-y-0.5">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-2.5 rounded-full" style={{ backgroundColor: e.color }} />
              <span>{e.label}</span>
            </div>
            <span className="font-mono">{Number(e.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Summary sub-tab ─────────────────────────────────────────────────────── */
function LubeSummaryView({ series, loading, error, fromDate, toDate, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  const [selectedUnit, setSelectedUnit] = useState('Mill 3');
  const [activeLines, setActiveLines] = useState(() => new Set(ROLLER_PARAMS.map((r) => r.suffix)));
  const [activePressures, setActivePressures] = useState(() => new Set(PRESSURE_PARAMS.map((p) => p.variable)));

  const isPressureMode = selectedUnit === 'Lube Pump Pressure';

  // Reset selections when unit changes
  const handleUnitChange = (unit) => {
    setSelectedUnit(unit);
    if (unit === 'Lube Pump Pressure') {
      setActivePressures(new Set(PRESSURE_PARAMS.map((p) => p.variable)));
    } else {
      setActiveLines(new Set(ROLLER_PARAMS.map((r) => r.suffix)));
    }
  };

  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  // Compute averages for the selected unit params
  const avgValues = useMemo(() => {
    const sums = {}, counts = {};
    for (const row of filteredSeries) {
      for (const [k, v] of Object.entries(row.values || {})) {
        if (v != null && Number.isFinite(v)) {
          sums[k] = (sums[k] || 0) + v;
          counts[k] = (counts[k] || 0) + 1;
        }
      }
    }
    const out = {};
    for (const k of Object.keys(sums)) out[k] = sums[k] / counts[k];
    return out;
  }, [filteredSeries]);

  // Get the mill prefix from selectedUnit
  const millPrefix = useMemo(() => {
    if (isPressureMode) return null;
    return selectedUnit.replace('Mill ', 'M');
  }, [selectedUnit, isPressureMode]);

  // Build chart lines based on mode
  const chartLines = useMemo(() => {
    if (isPressureMode) {
      return PRESSURE_PARAMS
        .filter((p) => activePressures.has(p.variable))
        .map((p) => ({ variable: p.variable, label: p.label, color: p.color }));
    }
    return ROLLER_PARAMS
      .filter((r) => activeLines.has(r.suffix))
      .map((r) => ({ variable: `${millPrefix}_${r.suffix}`, label: r.label, color: r.color }));
  }, [isPressureMode, activePressures, activeLines, millPrefix]);

  // Build chart data
  const chartData = useMemo(() => {
    if (loading || chartLines.length === 0) return [];
    const allVars = chartLines.map((l) => l.variable);
    return filteredSeries
      .filter((row) => allVars.some((v) => row.values?.[v] != null && Number.isFinite(row.values[v])))
      .map((row) => {
        const pt = { label: row.dateIso ? row.dateIso.slice(5).replace('-', '/') : '', timeIso: row.timeIso };
        for (const { variable } of chartLines) {
          const v = row.values?.[variable];
          pt[variable] = v != null && Number.isFinite(v) ? Number(v) : null;
        }
        return pt;
      })
      .sort((a, b) => (a.timeIso || '').localeCompare(b.timeIso || ''));
  }, [filteredSeries, chartLines, loading]);

  // Params for the LHS card
  const paramItems = useMemo(() => {
    if (isPressureMode) {
      return PRESSURE_PARAMS.map((p) => ({
        key: p.variable,
        label: p.label,
        color: p.color,
        value: avgValues[p.variable],
        unit: p.unit,
        isActive: activePressures.has(p.variable),
      }));
    }
    return ROLLER_PARAMS.map((r) => {
      const variable = `${millPrefix}_${r.suffix}`;
      return {
        key: r.suffix,
        label: r.label,
        color: r.color,
        value: avgValues[variable],
        unit: '°C',
        isActive: activeLines.has(r.suffix),
      };
    });
  }, [isPressureMode, avgValues, activePressures, activeLines, millPrefix]);

  const toggleParam = (key) => {
    if (isPressureMode) {
      setActivePressures((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    } else {
      setActiveLines((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }
  };

  if (error) return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
      isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
    }`}>{error}</div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Unit slicer row */}
      <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-2xl border px-3 py-2 ${cardClasses}`}>
        <span className={`shrink-0 pr-2 text-[10px] font-black uppercase tracking-widest ${textClasses.muted}`}>Unit Slicer:</span>
        {UNIT_SLICERS.map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => handleUnitChange(unit)}
            className={`shrink-0 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
              selectedUnit === unit
                ? isDarkMode
                  ? 'bg-slate-700 text-white shadow-md font-black'
                  : 'bg-slate-800 text-white shadow-md font-black'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {unit}
          </button>
        ))}
      </div>

      {/* Main layout: col-4 param card + col-8 chart — fill remaining viewport height */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        {/* LHS: click-to-filter param card */}
        <div className="col-span-12 flex min-h-0 lg:col-span-4">
          <div className={`flex h-full min-h-0 w-full flex-col rounded-2xl border p-4 ${cardClasses}`}>
            {/* Header */}
            <div className={`mb-2 shrink-0 border-b pb-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>
                  {isPressureMode ? 'System Hydraulics' : 'Average Temp (Degree Celsius)'}
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-500'
                }`}>Click to filter</span>
              </div>
              <h3 className={`mt-1 text-sm font-black ${textClasses.title}`}>
                {isPressureMode ? 'Lube Pump Pressure' : `${selectedUnit} Bearings`}
              </h3>
            </div>

            {/* Selectable params */}
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 overflow-y-auto py-1">
              {paramItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleParam(item.key)}
                  className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition-all ${
                    item.isActive
                      ? isDarkMode
                        ? 'border-slate-700 bg-slate-800/60 text-white'
                        : 'border-slate-100 bg-slate-50 text-slate-800'
                      : 'border-transparent opacity-50 hover:opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border transition-all"
                      style={{
                        backgroundColor: item.isActive ? item.color : 'transparent',
                        borderColor: item.color,
                      }}
                    />
                    <span className={`text-xs font-semibold ${item.isActive ? textClasses.title : textClasses.muted}`}>
                      {item.label}
                    </span>
                  </div>
                  <span className={`font-mono text-xs font-black ${item.isActive ? textClasses.title : textClasses.muted}`}>
                    {loading
                      ? '—'
                      : item.value != null
                        ? `${item.value.toFixed(2)} ${item.unit}`
                        : `— ${item.unit}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RHS: Trend chart */}
        <div className={`col-span-12 flex min-h-0 flex-col rounded-2xl border p-4 lg:col-span-8 ${cardClasses}`}>
          {/* Chart header */}
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h3 className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>
              {selectedUnit} — Daily Trend Curves
            </h3>
            <div className="flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
              }`}>{loading ? 'Loading…' : `${chartData.length} pts`}</span>
              <ChartCardToolbar
                isDarkMode={isDarkMode}
                onExpand={() => onExpand?.({
                  title: `${selectedUnit} — Daily Trend Curves`,
                  lines: chartLines,
                  chartData,
                })}
              />
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex h-full items-center justify-center"><Spinner size="md" /></div>
            ) : chartData.length === 0 ? (
              <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-[11px] font-semibold ${
                isDarkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'
              }`}>No data in range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} {...gridStyle} />
                  <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 9 }} stroke={isDarkMode ? '#334155' : '#cbd5e1'} interval="preserveStartEnd" />
                  <YAxis tick={{ ...axisStyle, fontSize: 9 }} stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                    domain={isPressureMode ? [1.5, 5] : [15, 65]} />
                  <Tooltip content={(props) => <LubeTooltip {...props} lines={chartLines} isDarkMode={isDarkMode} />} />
                  <Legend wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} iconType="circle" />
                  {chartLines.map((l) => (
                    <Line key={l.variable} type="monotone" dataKey={l.variable} name={l.label}
                      stroke={l.color} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Grid sub-tab ────────────────────────────────────────────────────────── */
function LubeGridView({ series, loading, error, fromDate, toDate, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  if (error) return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
      isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
    }`}>{error}</div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-12 gap-3">
      {GRID_PANELS.map((panel) => {
        const chartData = loading ? [] : filteredSeries
          .filter((row) => panel.lines.some(({ variable }) => {
            const v = row.values?.[variable];
            return v != null && Number.isFinite(v);
          }))
          .map((row) => {
            const pt = { label: row.dateIso ? row.dateIso.slice(5).replace('-', '/') : '', timeIso: row.timeIso };
            for (const { variable } of panel.lines) {
              const v = row.values?.[variable];
              pt[variable] = v != null && Number.isFinite(v) ? Number(v) : null;
            }
            return pt;
          })
          .sort((a, b) => (a.timeIso || '').localeCompare(b.timeIso || ''));

        return (
          <div key={panel.key} className={`col-span-12 flex min-h-0 flex-col rounded-2xl border p-4 md:col-span-6 ${cardClasses}`}>
            {/* Header */}
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h3 className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>{panel.title}</h3>
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                }`}>{loading ? 'Loading…' : `${chartData.length} pts`}</span>
                <ChartCardToolbar
                  isDarkMode={isDarkMode}
                  onExpand={() => onExpand?.({ title: panel.title, lines: panel.lines, chartData })}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="flex h-full items-center justify-center"><Spinner size="md" /></div>
              ) : chartData.length === 0 ? (
                <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-[11px] font-semibold ${
                  isDarkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'
                }`}>No data in range</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} {...gridStyle} />
                    <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 8 }} stroke={isDarkMode ? '#334155' : '#cbd5e1'} interval="preserveStartEnd" />
                    <YAxis tick={{ ...axisStyle, fontSize: 8 }} stroke={isDarkMode ? '#334155' : '#cbd5e1'} domain={panel.domain} />
                    <Tooltip content={(props) => <LubeTooltip {...props} lines={panel.lines} isDarkMode={isDarkMode} />} />
                    {panel.lines.map((l) => (
                      <Line key={l.variable} type="monotone" dataKey={l.variable} name={l.label}
                        stroke={l.color} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend */}
            <div className="mt-2 flex shrink-0 flex-wrap gap-x-3 gap-y-0.5">
              {panel.lines.map((l) => (
                <div key={l.variable} className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

/* ─── Tab wrapper ─────────────────────────────────────────────────────────── */
export default function MillLubeRollerTab({
  fromDate,
  toDate,
  isDarkMode,
  cardClasses,
  textClasses,
  axisStyle,
  gridStyle,
  periodLabel,
  viewMode = 'dashboard',
}) {
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [selectedShift, setSelectedShift] = useState('All');
  const [expandedChart, setExpandedChart] = useState(null);
  const { data, loading, error, reload } = useLubeRollerData();

  const availableShifts = useMemo(() => {
    const set = new Set();
    for (const r of data.series) {
      const s = (r.shift || '').trim().toUpperCase();
      if (s) set.add(s);
    }
    return ['All', ...[...set].sort()];
  }, [data.series]);

  const filteredByShift = useMemo(() =>
    selectedShift === 'All'
      ? data.series
      : data.series.filter((r) => (r.shift || '').trim().toUpperCase() === selectedShift),
    [data.series, selectedShift]);

  const subLabel = SUB_TABS.find((t) => t.id === activeSubTab)?.label || '';
  const variableKeys = useMemo(() => collectVariableKeys(filteredByShift), [filteredByShift]);
  const rawColumns = useMemo(
    () => buildLogbookColumns(data.mapping, variableKeys),
    [data.mapping, variableKeys],
  );
  const rawRows = useMemo(
    () => buildLogbookTableRows(filteredByShift, variableKeys, fromDate, toDate, selectedShift),
    [filteredByShift, variableKeys, fromDate, toDate, selectedShift],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      {/* Sub-nav strip */}
      <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${cardClasses}`}>
        <div className="flex flex-wrap gap-4">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeSubTab === t.id;
            return (
              <button key={t.id} type="button"
                onClick={() => setActiveSubTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 pb-1 text-[11px] font-black transition-colors ${
                  active ? 'border-blue-500 text-blue-500'
                         : `border-transparent ${textClasses.muted} ${textClasses.hover}`
                }`}>
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Shift chips */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-black uppercase tracking-widest ${textClasses.muted}`}>Shift</span>
          {availableShifts.map((sh) => (
            <button key={sh} type="button" onClick={() => setSelectedShift(sh)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all ${
                selectedShift === sh
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {sh}
            </button>
          ))}
        </div>

        <button type="button" onClick={reload}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
            isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}>
          <MdRefresh className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {viewMode === 'table' ? (
          error ? (
            <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}>{error}</div>
          ) : (
            <MillRawDataTable
              title={`Lube & Roller Temp — ${subLabel}`}
              periodLabel={periodLabel}
              columns={rawColumns}
              rows={rawRows}
              loading={loading}
              isDarkMode={isDarkMode}
              cardClasses={cardClasses}
              textClasses={textClasses}
            />
          )
        ) : activeSubTab === 'summary' ? (
          <LubeSummaryView
            series={filteredByShift}
            loading={loading}
            error={error}
            fromDate={fromDate}
            toDate={toDate}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            onExpand={setExpandedChart}
          />
        ) : (
          <LubeGridView
            series={filteredByShift}
            loading={loading}
            error={error}
            fromDate={fromDate}
            toDate={toDate}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            onExpand={setExpandedChart}
          />
        )}
      </div>

      {expandedChart && (
        <MillChartExpandModal
          title={expandedChart.title}
          lines={expandedChart.lines}
          chartData={expandedChart.chartData}
          isDarkMode={isDarkMode}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onClose={() => setExpandedChart(null)}
        />
      )}
    </div>
  );
}
