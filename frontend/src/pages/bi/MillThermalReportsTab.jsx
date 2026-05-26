import { useEffect, useMemo, useState } from 'react';
import {
  MdInfoOutline,
  MdThermostat,
  MdFactory,
  MdRefresh,
  MdSettings,
} from 'react-icons/md';
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

/**
 * Sub-tabs inside the "Thermal Reports" main tab. Only the Summary view is
 * implemented right now — the rest are placeholders so the layout matches the
 * final UX. Add a new entry here when wiring follow-up sub-views.
 */
const SUB_TABS = [
  { id: 'summary-temp', label: 'Summary - Equipment Temp', icon: MdThermostat, enabled: true },
  { id: 'equip-temp-1', label: 'Equipment Temp 1', icon: MdSettings, enabled: false },
  { id: 'equip-temp-2', label: 'Equipment Temp 2', icon: MdSettings, enabled: false },
  { id: 'equip-temp-3', label: 'Equipment Temp 3', icon: MdSettings, enabled: false },
];

/** Distinct, color-stable palette assigned per variable for the daily temp curve. */
const TEMP_LINE_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#0ea5e9', '#8b5cf6',
  '#22c55e', '#eab308', '#ef4444', '#14b8a6', '#6366f1',
];

function colorForIndex(i) {
  return TEMP_LINE_COLORS[i % TEMP_LINE_COLORS.length];
}

function InfoTooltip({ definition }) {
  return (
    <div className="group relative z-10 ml-1.5 inline-flex cursor-help items-center">
      <MdInfoOutline className="h-3.5 w-3.5 text-slate-400 transition-colors hover:text-blue-500" />
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-center text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-700">
        {definition}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
      </div>
    </div>
  );
}

function isoToShortLabel(dateIso, timeIso) {
  // Prefer timestamp when available so multiple shift readings show distinctly.
  const source = timeIso || (dateIso ? `${dateIso}T12:00:00` : '');
  if (!source) return '';
  const d = new Date(source);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateOnlyLabel(dateIso) {
  if (!dateIso) return '';
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

/** Hook that fetches the equipment-temp dataset once and caches it in component state. */
function useEquipmentTempData() {
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
        const { data: resp } = await api.get('/bi/milling-equipment-temp');
        if (cancelled) return;
        setData({
          mapping: Array.isArray(resp?.mapping) ? resp.mapping : [],
          series: Array.isArray(resp?.series) ? resp.series : [],
        });
      } catch (err) {
        if (!cancelled) {
          setData({ mapping: [], series: [] });
          setError(err.response?.data?.message || err.message || 'Failed to load equipment temperature data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tab wrapper – owns the sub-nav and routes between sub-views.
 * ────────────────────────────────────────────────────────────────────────── */
export default function MillThermalReportsTab({
  fromDate,
  toDate,
  isDarkMode,
  cardClasses,
  textClasses,
  axisStyle,
  gridStyle,
  periodLabel,
}) {
  const [activeSubTab, setActiveSubTab] = useState('summary-temp');
  const { data, loading, error, reload } = useEquipmentTempData();

  return (
    <div className="space-y-3">
      {/* Sub-nav strip */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${cardClasses}`}
      >
        <div className="flex flex-wrap gap-4">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeSubTab === t.id;
            const disabled = !t.enabled;
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                title={disabled ? 'Coming soon' : undefined}
                onClick={() => (disabled ? null : setActiveSubTab(t.id))}
                className={`flex items-center gap-1.5 border-b-2 pb-1 text-[11px] font-black transition-colors ${
                  active
                    ? 'border-blue-500 text-blue-500'
                    : disabled
                      ? `cursor-not-allowed border-transparent ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`
                      : `border-transparent ${textClasses.muted} ${textClasses.hover}`
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {disabled && (
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                      isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={reload}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
            isDarkMode
              ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          <MdRefresh className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className={`flex h-[300px] items-center justify-center rounded-2xl border ${cardClasses}`}>
          <Spinner size="md" />
        </div>
      ) : error ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {error}
        </div>
      ) : activeSubTab === 'summary-temp' ? (
        <SummaryEquipmentTempView
          mapping={data.mapping}
          series={data.series}
          fromDate={fromDate}
          toDate={toDate}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          periodLabel={periodLabel}
        />
      ) : (
        <SubTabComingSoon
          tab={SUB_TABS.find((t) => t.id === activeSubTab)?.label || ''}
          cardClasses={cardClasses}
          textClasses={textClasses}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Summary – Equipment Temp view
 * ────────────────────────────────────────────────────────────────────────── */
function SummaryEquipmentTempView({
  mapping,
  series,
  fromDate,
  toDate,
  isDarkMode,
  cardClasses,
  textClasses,
  axisStyle,
  gridStyle,
  periodLabel,
}) {
  /** All distinct machines in mapping order (preserves Data_Mill sort_order). */
  const machines = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const m of mapping) {
      if (m.machine && !seen.has(m.machine)) {
        seen.add(m.machine);
        out.push(m.machine);
      }
    }
    return out;
  }, [mapping]);

  const [selectedMachine, setSelectedMachine] = useState('');

  useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      setSelectedMachine(machines[0]);
    } else if (selectedMachine && !machines.includes(selectedMachine) && machines.length > 0) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, selectedMachine]);

  /** Variables (with display name) attached to the active machine, in source order. */
  const machineVariables = useMemo(() => {
    if (!selectedMachine) return [];
    return mapping
      .filter((m) => m.machine === selectedMachine)
      .map((m) => ({ variable: m.variable, label: m.equipmentName }));
  }, [mapping, selectedMachine]);

  /** mill_logbook1 rows that fall inside the date range (inclusive). */
  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  /** Per-variable latest non-null reading + simple stats inside the active window. */
  const readingRows = useMemo(() => {
    if (machineVariables.length === 0) return [];
    return machineVariables.map(({ variable, label }, idx) => {
      let latest = null;
      let latestKey = '';
      let min = null;
      let max = null;
      let sum = 0;
      let count = 0;
      for (const row of filteredSeries) {
        const v = row.values?.[variable];
        if (v == null || !Number.isFinite(v)) continue;
        const k = row.timeIso || row.dateIso || '';
        if (latest === null || k >= latestKey) {
          latest = v;
          latestKey = k;
        }
        if (min === null || v < min) min = v;
        if (max === null || v > max) max = v;
        sum += v;
        count += 1;
      }
      const avg = count > 0 ? sum / count : null;
      return {
        variable,
        label: label || variable,
        latest,
        latestAt: latestKey,
        min,
        max,
        avg,
        readings: count,
        color: colorForIndex(idx),
      };
    });
  }, [machineVariables, filteredSeries]);

  /** Chart points: one entry per source row (only when at least one var has a value). */
  const dailyCurve = useMemo(() => {
    if (machineVariables.length === 0) return [];
    return filteredSeries
      .filter((row) => machineVariables.some(({ variable }) => {
        const v = row.values?.[variable];
        return v != null && Number.isFinite(v);
      }))
      .map((row) => {
        const point = {
          label: isoToShortLabel(row.dateIso, row.timeIso),
          dateIso: row.dateIso,
          timeIso: row.timeIso,
          shift: row.shift,
        };
        for (const { variable } of machineVariables) {
          const v = row.values?.[variable];
          point[variable] = v == null || !Number.isFinite(v) ? null : Number(v);
        }
        return point;
      })
      .sort((a, b) => {
        const ka = a.timeIso || a.dateIso || '';
        const kb = b.timeIso || b.dateIso || '';
        return ka.localeCompare(kb);
      });
  }, [machineVariables, filteredSeries]);

  if (machines.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border p-10 text-center ${cardClasses}`}
      >
        <MdFactory className={`mb-2 h-8 w-8 ${textClasses.muted}`} />
        <h3 className={`text-sm font-black ${textClasses.title}`}>No machine reference data</h3>
        <p className={`mt-2 max-w-md text-xs font-semibold ${textClasses.muted}`}>
          Upload <code>Data_Mill.xlsx</code> from the Data Upload module, then run{' '}
          <code className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>npm run db:mill-mapping</code>{' '}
          to refresh the equipment mapping.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Unit slicer */}
      <div className={`rounded-2xl border p-3 ${cardClasses}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center">
            <h3 className={`text-xs font-black uppercase tracking-wider ${textClasses.muted}`}>Unit Slicer</h3>
            <InfoTooltip definition="Pick a machine to focus its temperature readings. Machines come from the Data_Mill reference file." />
          </div>
          <span className={`text-[10px] font-bold ${textClasses.muted}`}>
            {machines.length} machines · {periodLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {machines.map((m) => {
            const isActive = m === selectedMachine;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMachine(m)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : isDarkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Readings + chart */}
      <div className="grid grid-cols-12 gap-3">
        {/* Readings list */}
        <div className={`col-span-12 flex flex-col rounded-2xl border p-4 lg:col-span-5 ${cardClasses}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center">
              <h3 className={`text-sm font-black ${textClasses.title}`}>{selectedMachine} Reading Equipments</h3>
              <InfoTooltip definition="Latest, average, min and max temperature for every variable mapped to the selected machine inside the active period." />
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
            }`}>
              {readingRows.length} variables
            </span>
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`} style={{ maxHeight: 420 }}>
            <table className="w-full text-left text-xs">
              <thead
                className={`sticky top-0 z-10 border-b text-[10px] uppercase tracking-wide ${
                  isDarkMode ? 'border-slate-700 bg-slate-900/90 text-slate-500' : 'border-slate-200 bg-slate-50/90 text-slate-400'
                }`}
              >
                <tr>
                  <th className="px-3 py-2 font-bold">Equipment</th>
                  <th className="px-3 py-2 text-right font-bold">Latest</th>
                  <th className="px-3 py-2 text-right font-bold">Avg</th>
                  <th className="px-3 py-2 text-right font-bold">Max</th>
                </tr>
              </thead>
              <tbody className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {readingRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-3 py-12 text-center font-semibold ${textClasses.muted}`}>
                      No variables mapped to this machine.
                    </td>
                  </tr>
                ) : (
                  readingRows.map((row) => {
                    const isHot = row.latest != null && row.latest >= 70;
                    return (
                      <tr
                        key={row.variable}
                        className={isDarkMode ? 'transition-colors hover:bg-slate-800/50' : 'transition-colors hover:bg-slate-50'}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                            <div>
                              <div className={`font-bold ${textClasses.title}`}>{row.label}</div>
                              <div className={`mt-0.5 text-[9px] font-bold uppercase tracking-wider ${textClasses.muted}`}>
                                {row.variable}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-right font-mono font-black ${
                            row.latest == null ? textClasses.muted : isHot ? 'text-rose-500' : isDarkMode ? 'text-slate-100' : 'text-slate-800'
                          }`}
                        >
                          {row.latest == null ? '—' : `${row.latest.toFixed(1)}°`}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${textClasses.muted}`}>
                          {row.avg == null ? '—' : `${row.avg.toFixed(1)}°`}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${
                          row.max == null ? textClasses.muted : isDarkMode ? 'text-amber-400' : 'text-amber-600'
                        }`}>
                          {row.max == null ? '—' : `${row.max.toFixed(1)}°`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily temp curve chart */}
        <div className={`col-span-12 flex flex-col rounded-2xl border p-4 lg:col-span-7 ${cardClasses}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center">
              <h3 className={`text-sm font-black ${textClasses.title}`}>Daily Temp Curve</h3>
              <InfoTooltip definition="Time-series temperature readings for the selected machine. One line per variable. Readings are pulled from the Equipment Temperature form (mill_logbook1)." />
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
            }`}>
              {dailyCurve.length} readings
            </span>
          </div>
          <div className="h-[420px] w-full">
            {dailyCurve.length === 0 ? (
              <CurveEmptyState isDarkMode={isDarkMode} textClasses={textClasses} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyCurve} margin={{ top: 8, right: 16, left: -18, bottom: 24 }}>
                  <CartesianGrid vertical={false} {...gridStyle} />
                  <XAxis
                    dataKey="label"
                    tick={{ ...axisStyle, fontSize: 9 }}
                    stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                    interval="preserveStartEnd"
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    tick={axisStyle}
                    stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                    domain={['auto', 'auto']}
                    unit="°"
                  />
                  <Tooltip
                    content={(props) => <CurveTooltip {...props} readingRows={readingRows} isDarkMode={isDarkMode} />}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} iconType="circle" />
                  {readingRows.map((r) => (
                    <Line
                      key={r.variable}
                      type="monotone"
                      name={r.label}
                      dataKey={r.variable}
                      stroke={r.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className={`mt-2 text-[10px] font-semibold ${textClasses.muted}`}>
            Equipment column from <code>Data_Mill</code> · values from Equipment Temperature form (<code>mill_logbook1</code>).
          </p>
        </div>
      </div>
    </div>
  );
}

function CurveTooltip({ active, payload, label, readingRows, isDarkMode }) {
  if (!active || !payload || !payload.length) return null;
  // Filter to lines that actually have a value at this point.
  const present = payload.filter((p) => p.value != null && Number.isFinite(p.value));
  if (present.length === 0) return null;
  return (
    <div
      className={`max-w-[260px] rounded-xl border p-3 text-[11px] font-bold shadow-xl backdrop-blur-sm ${
        isDarkMode ? 'border-slate-700 bg-slate-800/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-700'
      }`}
    >
      <p className={`mb-2 border-b pb-2 ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        {label}
      </p>
      <div className="space-y-1.5">
        {present.map((entry, i) => {
          const meta = readingRows.find((r) => r.variable === entry.dataKey);
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                  {meta?.label || entry.dataKey}:
                </span>
              </div>
              <span className="font-mono">{Number(entry.value).toFixed(1)}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurveEmptyState({ isDarkMode, textClasses }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed text-xs font-semibold ${
        isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'
      }`}
    >
      <span>No equipment temperature data in this window.</span>
      <span className={`mt-1 text-[10px] font-semibold ${textClasses.muted}`}>
        Try widening the date range or submitting an Equipment Temperature entry.
      </span>
    </div>
  );
}

function SubTabComingSoon({ tab, cardClasses, textClasses }) {
  return (
    <div className={`flex h-[400px] flex-col items-center justify-center rounded-2xl border ${cardClasses}`}>
      <span className={`text-xs font-black uppercase tracking-widest ${textClasses.muted}`}>{tab}</span>
      <h2 className={`mt-2 text-xl font-black ${textClasses.title}`}>Coming soon</h2>
      <p className={`mt-1 max-w-md text-center text-xs font-semibold ${textClasses.muted}`}>
        This sub-view is still on the roadmap. The Summary - Equipment Temp tab is fully live and reads the
        Data_Mill mapping plus the Equipment Temperature form submissions.
      </p>
    </div>
  );
}

export { useEquipmentTempData };
