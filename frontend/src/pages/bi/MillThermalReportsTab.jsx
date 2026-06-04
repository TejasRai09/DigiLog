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
import ChartCardToolbar from '../../components/bi/ChartCardToolbar';
import MillChartExpandModal from '../../components/bi/MillChartExpandModal';
import MillRawDataTable from '../../components/bi/MillRawDataTable';
import {
  buildLogbookColumns,
  buildLogbookTableRows,
  collectVariableKeys,
  isOtgVariable,
  isShredderVariable,
} from '../../utils/millingBiRawTable';

const SUB_TABS = [
  { id: 'summary-temp',  label: 'Summary - Equipment Temp', icon: MdThermostat, enabled: true  },
  { id: 'equip-temp-1',  label: 'Equipment Temp 1',         icon: MdSettings,   enabled: true  },
  { id: 'equip-temp-2',  label: 'Equipment Temp 2',         icon: MdSettings,   enabled: true  },
  { id: 'shredder-temp', label: 'Shredder Temp',             icon: MdFactory,    enabled: true  },
  { id: 'otg-temp',     label: 'OTG Bearing Temp',          icon: MdSettings,   enabled: true  },
];

/** All 13 equipment units recorded in mill_logbook1, ordered as they appear in the form. */
const EQUIP_LIST = [
  { key: 'CaneKeig',  label: 'Cane Kicker' },
  { key: 'CardDrum1', label: 'Cardian Drum 1' },
  { key: 'CardDrum2', label: 'Cardian Drum 2' },
  { key: 'FeedDrum',  label: 'Feeder Drum' },
  { key: 'CaneCar',   label: 'Cane Carrier' },
  { key: 'ShredCar',  label: 'Shred. Carrier' },
  { key: 'BeltConvy', label: 'Belt Convy' },
  { key: 'IRC1',      label: 'IRC 1' },
  { key: 'IRC2',      label: 'IRC 2' },
  { key: 'IRC3',      label: 'IRC 3' },
  { key: 'IRC4',      label: 'IRC 4' },
  { key: 'Mill0',     label: 'Mill 0' },
  { key: 'Mill4',     label: 'Mill 4' },
];

/** The 5 temperature measurement types captured for every equipment unit. */
const TEMP_TYPES = [
  { suffix: 'MtrTemp',    label: 'Motor Temp',      color: '#3b82f6' },
  { suffix: 'GearTempDE', label: 'Gear Temp (DE)',   color: '#f43f5e' },
  { suffix: 'GearTempNDE',label: 'Gear Temp (NDE)',  color: '#f59e0b' },
  { suffix: 'BearTempDE', label: 'Bearing Temp (DE)',color: '#10b981' },
  { suffix: 'BearTempNDE',label: 'Bearing Temp (NDE)',color: '#a855f7' },
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

/** Hook that fetches the shredder + OTG dataset from mill_logbook2. */
function useShredderData() {
  const [data, setData] = useState({ mapping: [], series: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!fetched && reloadKey === 0) return; // lazy – only fetch when first activated
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: resp } = await api.get('/bi/milling-shredder');
        if (cancelled) return;
        setData({
          mapping: Array.isArray(resp?.mapping) ? resp.mapping : [],
          series: Array.isArray(resp?.series) ? resp.series : [],
        });
      } catch (err) {
        if (!cancelled) {
          setData({ mapping: [], series: [] });
          setError(err.response?.data?.message || err.message || 'Failed to load shredder data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey, fetched]);

  const activate = () => { if (!fetched) setFetched(true); };
  const reload = () => setReloadKey((k) => k + 1);
  return { data, loading, error, activate, reload };
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
  viewMode = 'dashboard',
}) {
  const [activeSubTab, setActiveSubTab] = useState('summary-temp');
  const [selectedShift, setSelectedShift] = useState('All');
  const [expandedChart, setExpandedChart] = useState(null); // { title, lines, chartData }
  const { data, loading, error, reload } = useEquipmentTempData();
  const shredder = useShredderData();

  // Lazy-load shredder data the first time either shredder sub-tab is opened
  const handleSubTabClick = (id) => {
    if (id === 'shredder-temp' || id === 'otg-temp') shredder.activate();
    setActiveSubTab(id);
  };

  // Distinct, sorted shift values across both datasets
  const availableShifts = useMemo(() => {
    const set = new Set();
    for (const r of [...data.series, ...shredder.data.series]) {
      const s = (r.shift || '').trim().toUpperCase();
      if (s) set.add(s);
    }
    return ['All', ...[...set].sort()];
  }, [data.series, shredder.data.series]);

  // Pre-filter series by selected shift before passing to sub-views
  const shiftFilter = (arr) =>
    selectedShift === 'All'
      ? arr
      : arr.filter((r) => (r.shift || '').trim().toUpperCase() === selectedShift);

  const millSeries   = useMemo(() => shiftFilter(data.series),           [data.series, selectedShift]);
  const shredSeries  = useMemo(() => shiftFilter(shredder.data.series),  [shredder.data.series, selectedShift]);

  const rawTableConfig = useMemo(() => {
    const subLabel = SUB_TABS.find((t) => t.id === activeSubTab)?.label || '';

    if (['summary-temp', 'equip-temp-1', 'equip-temp-2'].includes(activeSubTab)) {
      const variableKeys = collectVariableKeys(millSeries);
      return {
        title: `Equipment Temperature — ${subLabel}`,
        mapping: data.mapping,
        series: millSeries,
        variableKeys,
        loading,
        error,
      };
    }
    if (activeSubTab === 'shredder-temp') {
      const variableKeys = collectVariableKeys(shredSeries, isShredderVariable);
      return {
        title: `Shredder Log — ${subLabel}`,
        mapping: shredder.data.mapping,
        series: shredSeries,
        variableKeys,
        loading: shredder.loading,
        error: shredder.error,
      };
    }
    if (activeSubTab === 'otg-temp') {
      const variableKeys = collectVariableKeys(shredSeries, isOtgVariable);
      return {
        title: `OTG Bearing Log — ${subLabel}`,
        mapping: shredder.data.mapping,
        series: shredSeries,
        variableKeys,
        loading: shredder.loading,
        error: shredder.error,
      };
    }
    return null;
  }, [
    activeSubTab,
    data.mapping,
    millSeries,
    shredSeries,
    loading,
    error,
    shredder.loading,
    shredder.error,
    shredder.data.mapping,
  ]);

  const rawColumns = useMemo(
    () => (rawTableConfig ? buildLogbookColumns(rawTableConfig.mapping, rawTableConfig.variableKeys) : []),
    [rawTableConfig],
  );

  const rawRows = useMemo(
    () => (rawTableConfig
      ? buildLogbookTableRows(
        rawTableConfig.series,
        rawTableConfig.variableKeys,
        fromDate,
        toDate,
        selectedShift,
      )
      : []),
    [rawTableConfig, fromDate, toDate, selectedShift],
  );

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      {/* Sub-nav strip */}
      <div
        className={`flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${cardClasses}`}
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
                onClick={() => (disabled ? null : handleSubTabClick(t.id))}
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
        {/* Shift filter chips */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-black uppercase tracking-widest ${textClasses.muted}`}>Shift</span>
          {availableShifts.map((sh) => (
            <button
              key={sh}
              type="button"
              onClick={() => setSelectedShift(sh)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all ${
                selectedShift === sh
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : isDarkMode
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sh}
            </button>
          ))}
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

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${
        viewMode === 'table' || activeSubTab === 'shredder-temp' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}>
      {viewMode === 'table' ? (
        rawTableConfig?.error ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {rawTableConfig.error}
          </div>
        ) : (
          <MillRawDataTable
            title={rawTableConfig?.title || 'Equipment Temperature'}
            periodLabel={periodLabel}
            columns={rawColumns}
            rows={rawRows}
            loading={rawTableConfig?.loading}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
          />
        )
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
          series={millSeries}
          loading={loading}
          fromDate={fromDate}
          toDate={toDate}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          periodLabel={periodLabel}
          onExpand={setExpandedChart}
        />
      ) : activeSubTab === 'equip-temp-1' ? (
        <EquipTemp1View
          series={millSeries}
          loading={loading}
          fromDate={fromDate}
          toDate={toDate}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onExpand={setExpandedChart}
        />
      ) : activeSubTab === 'equip-temp-2' ? (
        <EquipTemp2View
          series={millSeries}
          loading={loading}
          fromDate={fromDate}
          toDate={toDate}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onExpand={setExpandedChart}
        />
      ) : activeSubTab === 'shredder-temp' ? (
        <ShredTempView
          series={shredSeries}
          loading={shredder.loading}
          error={shredder.error}
          fromDate={fromDate}
          toDate={toDate}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onExpand={setExpandedChart}
        />
      ) : activeSubTab === 'otg-temp' ? (
        <OtgBearingTempView
          series={shredSeries}
          loading={shredder.loading}
          error={shredder.error}
          fromDate={fromDate}
          toDate={toDate}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onExpand={setExpandedChart}
        />
      ) : null}
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

/* ──────────────────────────────────────────────────────────────────────────
 * Summary – Equipment Temp view
 * ────────────────────────────────────────────────────────────────────────── */
function SummaryEquipmentTempView({
  mapping,
  series,
  loading,
  fromDate,
  toDate,
  isDarkMode,
  cardClasses,
  textClasses,
  axisStyle,
  gridStyle,
  periodLabel,
  onExpand,
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
            {loading ? (
              <div className="flex h-[200px] items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : (
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
            )}
          </div>
        </div>

        {/* Daily temp curve chart */}
        <div className={`col-span-12 flex flex-col rounded-2xl border p-4 lg:col-span-7 ${cardClasses}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center">
              <h3 className={`text-sm font-black ${textClasses.title}`}>Daily Temp Curve</h3>
              <InfoTooltip definition="Time-series temperature readings for the selected machine. One line per variable. Readings are pulled from the Equipment Temperature form (mill_logbook1)." />
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
              }`}>
                {dailyCurve.length} readings
              </span>
              <ChartCardToolbar
                isDarkMode={isDarkMode}
                onExpand={() => onExpand?.({
                  title: `${selectedMachine} — Daily Temp Curve`,
                  lines: readingRows.map((r) => ({ variable: r.variable, label: r.label, color: r.color })),
                  chartData: dailyCurve,
                })}
              />
            </div>
          </div>
          <div className="h-[420px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : dailyCurve.length === 0 ? (
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

/**
 * Equipment Temp 1 — 6-panel grid (3×2).
 * Each panel is a small multi-line chart for one equipment unit showing all
 * 5 temperature types (Motor, Gear DE/NDE, Bearing DE/NDE).
 * Mirrors the reference design: Belt Convy, Cane Carrier, Cardian Drum 1,
 * Cardian Drum 2, Cane Kicker, Feeder Drum.
 */

const EQUIP_TEMP1_PANELS = [
  { key: 'BeltConvy',  title: 'Belt Convy (Daily Trend - Temp)' },
  { key: 'CaneCar',   title: 'Cane Carrier (Daily Trend - Temp)' },
  { key: 'CardDrum1', title: 'Cardian Drum 1 (Daily Trend - Temp)' },
  { key: 'CardDrum2', title: 'Cardian Drum 2 (Daily Trend - Temp)' },
  { key: 'CaneKeig',  title: 'Cane Kicker (Daily Trend - Temp)' },
  { key: 'FeedDrum',  title: 'Feeder Drum (Daily Trend - Temp)' },
];

const TEMP1_LINES = [
  { suffix: 'BearTempDE',  label: 'Bearing Temp (DE)',  color: '#3b82f6' },
  { suffix: 'BearTempNDE', label: 'Bearing Temp (NDE)', color: '#1e3a8a' },
  { suffix: 'GearTempDE',  label: 'Gear Temp (DE)',     color: '#f97316' },
  { suffix: 'GearTempNDE', label: 'Gear Temp (NDE)',    color: '#8b5cf6' },
  { suffix: 'MtrTemp',     label: 'Motor Temp',         color: '#ec4899' },
];

function EquipTemp1View({ series, loading, fromDate, toDate, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  return (
    <div className="grid grid-cols-12 gap-3">
      {EQUIP_TEMP1_PANELS.map((panel) => {
        const vars = TEMP1_LINES.map((t) => ({ ...t, variable: `${panel.key}_${t.suffix}` }));

        const chartData = loading ? [] : filteredSeries
          .filter((row) => vars.some(({ variable }) => {
            const v = row.values?.[variable];
            return v != null && Number.isFinite(v);
          }))
          .map((row) => {
            const point = {
              label: row.dateIso ? row.dateIso.slice(5).replace('-', '/') : '',
              dateIso: row.dateIso,
              timeIso: row.timeIso,
            };
            for (const { variable } of vars) {
              const v = row.values?.[variable];
              point[variable] = v != null && Number.isFinite(v) ? Number(v) : null;
            }
            return point;
          })
          .sort((a, b) => (a.timeIso || a.dateIso || '').localeCompare(b.timeIso || b.dateIso || ''));

        return (
          <div
            key={panel.key}
            className={`col-span-12 md:col-span-6 lg:col-span-4 flex flex-col rounded-2xl border p-4 ${cardClasses}`}
            style={{ height: 280 }}
          >
            {/* Panel header */}
            <div className="mb-2 flex items-center justify-between shrink-0">
              <h3 className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>
                {panel.title}
              </h3>
              <div className="flex items-center gap-1.5">
                {loading ? (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>Loading…</span>
                ) : (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {chartData.length} pts
                  </span>
                )}
                <ChartCardToolbar
                  isDarkMode={isDarkMode}
                  onExpand={() => onExpand?.({ title: panel.title, lines: vars, chartData })}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : chartData.length === 0 ? (
                <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-[11px] font-semibold ${
                  isDarkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'
                }`}>
                  No data in range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} {...gridStyle} />
                    <XAxis
                      dataKey="label"
                      tick={{ ...axisStyle, fontSize: 8 }}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ ...axisStyle, fontSize: 8 }}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      domain={[15, 55]}
                    />
                    <Tooltip
                      content={(props) => <PanelTooltip {...props} vars={vars} isDarkMode={isDarkMode} />}
                    />
                    {vars.map((v) => (
                      <Line
                        key={v.variable}
                        type="monotone"
                        dataKey={v.variable}
                        name={v.label}
                        stroke={v.color}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend strip */}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 shrink-0">
              {TEMP1_LINES.map((t) => (
                <div key={t.suffix} className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Equipment Temp 2 — 7-panel grid.
 * IRC 1–4  (full: 5 lines, col-span-6 → 2 per row)
 * Mill 0, Mill 4, Shred. Carrier  (col-span-4 → 3 per row)
 * Mill 0 & Mill 4 have no bearing temp sensors → show only 3 lines.
 */

const EQUIP_TEMP2_PANELS = [
  { key: 'IRC1',     title: 'IRC 1 (Daily Trend - Temp)',              full: true  },
  { key: 'IRC2',     title: 'IRC 2 (Daily Trend - Temp)',              full: true  },
  { key: 'IRC3',     title: 'IRC 3 (Daily Trend - Temp)',              full: true  },
  { key: 'IRC4',     title: 'IRC 4 (Daily Trend - Temp)',              full: true  },
  { key: 'Mill0',    title: 'Mill 0 (Daily Trend - Temp)',             full: false },
  { key: 'Mill4',    title: 'Mill 4 (Daily Trend - Temp)',             full: false },
  { key: 'ShredCar', title: 'Shredder Carrier (Daily Trend - Temp)',   full: true  },
];

// full=true → all 5 lines; full=false → no bearing sensors (3 lines only)
const TEMP2_LINES_FULL = [
  { suffix: 'BearTempDE',  label: 'Bearing Temp (DE)',  color: '#3b82f6' },
  { suffix: 'BearTempNDE', label: 'Bearing Temp (NDE)', color: '#1e3a8a' },
  { suffix: 'GearTempDE',  label: 'Gear Temp (DE)',     color: '#f97316' },
  { suffix: 'GearTempNDE', label: 'Gear Temp (NDE)',    color: '#8b5cf6' },
  { suffix: 'MtrTemp',     label: 'Motor Temp',         color: '#ec4899' },
];
const TEMP2_LINES_PARTIAL = [
  { suffix: 'GearTempDE',  label: 'Gear Temp (DE)',  color: '#f97316' },
  { suffix: 'GearTempNDE', label: 'Gear Temp (NDE)', color: '#8b5cf6' },
  { suffix: 'MtrTemp',     label: 'Motor Temp',      color: '#ec4899' },
];

function EquipTemp2View({ series, loading, fromDate, toDate, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  return (
    <div className="grid grid-cols-12 gap-3">
      {EQUIP_TEMP2_PANELS.map((panel, index) => {
        const lineSet = panel.full ? TEMP2_LINES_FULL : TEMP2_LINES_PARTIAL;
        const vars = lineSet.map((t) => ({ ...t, variable: `${panel.key}_${t.suffix}` }));

        // IRC 1–4 → half-width (col-span-6), last 3 panels → third-width (col-span-4)
        const colClass = index < 4
          ? 'col-span-12 md:col-span-6'
          : 'col-span-12 md:col-span-6 lg:col-span-4';

        const chartData = loading ? [] : filteredSeries
          .filter((row) => vars.some(({ variable }) => {
            const v = row.values?.[variable];
            return v != null && Number.isFinite(v);
          }))
          .map((row) => {
            const point = {
              label: row.dateIso ? row.dateIso.slice(5).replace('-', '/') : '',
              dateIso: row.dateIso,
              timeIso: row.timeIso,
            };
            for (const { variable } of vars) {
              const v = row.values?.[variable];
              point[variable] = v != null && Number.isFinite(v) ? Number(v) : null;
            }
            return point;
          })
          .sort((a, b) => (a.timeIso || a.dateIso || '').localeCompare(b.timeIso || b.dateIso || ''));

        return (
          <div
            key={panel.key}
            className={`${colClass} flex flex-col rounded-2xl border p-4 ${cardClasses}`}
            style={{ height: 280 }}
          >
            {/* Header */}
            <div className="mb-2 flex items-center justify-between shrink-0">
              <h3 className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>
                {panel.title}
              </h3>
              <div className="flex items-center gap-1.5">
                {loading ? (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>Loading…</span>
                ) : (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>{chartData.length} pts</span>
                )}
                <ChartCardToolbar
                  isDarkMode={isDarkMode}
                  onExpand={() => onExpand?.({ title: panel.title, lines: vars, chartData })}
                />
              </div>
            </div>

            {/* Chart area */}
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : chartData.length === 0 ? (
                <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-[11px] font-semibold ${
                  isDarkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'
                }`}>
                  No data in range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} {...gridStyle} />
                    <XAxis
                      dataKey="label"
                      tick={{ ...axisStyle, fontSize: 8 }}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ ...axisStyle, fontSize: 8 }}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      domain={[15, 60]}
                    />
                    <Tooltip
                      content={(props) => <PanelTooltip {...props} vars={vars} isDarkMode={isDarkMode} />}
                    />
                    {vars.map((v) => (
                      <Line
                        key={v.variable}
                        type="monotone"
                        dataKey={v.variable}
                        name={v.label}
                        stroke={v.color}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend */}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 shrink-0">
              {lineSet.map((t) => (
                <div key={t.suffix} className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className={`text-[9px] font-bold ${textClasses.muted}`}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Shredder Temp sub-tab  (mill_logbook2 → shredR_* / shredL_*)
 * Layout: LHS params card | two stacked trend charts | RHS params card
 * ────────────────────────────────────────────────────────────────────────── */

const SHRED_LHS_PARAMS = [
  { variable: 'shredL_BearTempDCS',  label: 'Bearing Temp (DCS)',   unit: '°C',   color: '#3b82f6' },
  { variable: 'shredL_BearTempSite', label: 'Bearing Temp (Site)',  unit: '°C',   color: '#1e3a8a' },
  { variable: 'shredL_MtrTemp',      label: 'Motor Temp',           unit: '°C',   color: '#ec4899' },
  { variable: 'shredL_VibA',         label: 'Vibrations - Accel (A)', unit: 'g',  color: '#f59e0b' },
  { variable: 'shredL_VibV',         label: 'Vibrations - Vel (V)', unit: 'mm/s', color: '#10b981' },
  { variable: 'shredL_VibH',         label: 'Vibrations - Horiz (H)', unit: 'mm/s', color: '#06b6d4' },
];

const SHRED_RHS_PARAMS = [
  { variable: 'shredR_BearTempDCS',  label: 'Bearing Temp (DCS)',   unit: '°C',   color: '#f97316' },
  { variable: 'shredR_BearTempSite', label: 'Bearing Temp (Site)',  unit: '°C',   color: '#a855f7' },
  { variable: 'shredR_MtrTemp',      label: 'Motor Temp',           unit: '°C',   color: '#8b5cf6' },
  { variable: 'shredR_VibA',         label: 'Vibrations - Accel (A)', unit: 'g',  color: '#f43f5e' },
  { variable: 'shredR_VibV',         label: 'Vibrations - Vel (V)', unit: 'mm/s', color: '#14b8a6' },
  { variable: 'shredR_VibH',         label: 'Vibrations - Horiz (H)', unit: 'mm/s', color: '#84cc16' },
];

/** All 12 chart lines split into temp and vib groups for the two center charts. */
const SHRED_TEMP_LINES = [
  { variable: 'shredL_BearTempDCS',  label: 'L Bearing DCS',  color: '#3b82f6', side: 'L' },
  { variable: 'shredL_BearTempSite', label: 'L Bearing Site', color: '#1e3a8a', side: 'L' },
  { variable: 'shredL_MtrTemp',      label: 'L Motor Temp',   color: '#ec4899', side: 'L' },
  { variable: 'shredR_BearTempDCS',  label: 'R Bearing DCS',  color: '#f97316', side: 'R' },
  { variable: 'shredR_BearTempSite', label: 'R Bearing Site', color: '#a855f7', side: 'R' },
  { variable: 'shredR_MtrTemp',      label: 'R Motor Temp',   color: '#8b5cf6', side: 'R' },
];

const SHRED_VIB_LINES = [
  { variable: 'shredL_VibA', label: 'L Accel (A)',  color: '#f59e0b', side: 'L' },
  { variable: 'shredL_VibV', label: 'L Vel (V)',    color: '#10b981', side: 'L' },
  { variable: 'shredL_VibH', label: 'L Horiz (H)',  color: '#06b6d4', side: 'L' },
  { variable: 'shredR_VibA', label: 'R Accel (A)',  color: '#f43f5e', side: 'R' },
  { variable: 'shredR_VibV', label: 'R Vel (V)',    color: '#14b8a6', side: 'R' },
  { variable: 'shredR_VibH', label: 'R Horiz (H)',  color: '#84cc16', side: 'R' },
];

function buildShredChartData(filteredSeries, lines) {
  const allVars = lines.map((l) => l.variable);
  return filteredSeries
    .filter((row) => allVars.some((v) => row.values?.[v] != null && Number.isFinite(row.values[v])))
    .map((row) => {
      const point = {
        label: row.dateIso ? row.dateIso.slice(5).replace('-', '/') : '',
        timeIso: row.timeIso,
      };
      for (const { variable } of lines) {
        const v = row.values?.[variable];
        point[variable] = v != null && Number.isFinite(v) ? Number(v) : null;
      }
      return point;
    })
    .sort((a, b) => (a.timeIso || '').localeCompare(b.timeIso || ''));
}

function ShredParamCard({ title, subtitle, params, avgValues, selectedVars, onToggleVar, onToggleAll, loading, isDarkMode, cardClasses, textClasses, fullHeight = false }) {
  const allSelected = params.every((p) => selectedVars.has(p.variable));
  const noneSelected = params.every((p) => !selectedVars.has(p.variable));

  return (
    <div className={`flex flex-col rounded-2xl border p-4 ${fullHeight ? 'h-full w-full' : ''} ${cardClasses}`}>
      {/* Header */}
      <div className="mb-1 flex items-center justify-between shrink-0">
        <span className={`text-[9px] font-black uppercase tracking-widest ${textClasses.muted}`}>{title}</span>
        <button
          type="button"
          onClick={() => onToggleAll(params, noneSelected ? true : !allSelected)}
          className={`text-[9px] font-black uppercase tracking-wider transition-colors ${
            isDarkMode ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'
          }`}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <h3 className={`mb-3 text-sm font-black ${textClasses.title}`}>{subtitle}</h3>

      {/* Selectable rows */}
      <div className="flex flex-1 flex-col justify-between gap-1">
        {params.map((p) => {
          const selected = selectedVars.has(p.variable);
          return (
            <button
              key={p.variable}
              type="button"
              onClick={() => onToggleVar(p.variable)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                selected
                  ? isDarkMode
                    ? 'bg-slate-700/60 ring-1 ring-slate-600'
                    : 'bg-white shadow-sm ring-1 ring-slate-200'
                  : isDarkMode
                    ? 'bg-slate-900/20 opacity-40 hover:opacity-60'
                    : 'bg-slate-100/60 opacity-40 hover:opacity-70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full transition-opacity ${selected ? '' : 'opacity-30'}`}
                  style={{ backgroundColor: p.color }}
                />
                <span className={`text-xs font-semibold ${textClasses.title}`}>{p.label}</span>
              </div>
              <span className={`font-mono text-sm font-black tabular-nums ${selected ? textClasses.title : textClasses.muted}`}>
                {loading
                  ? '—'
                  : avgValues[p.variable] != null
                    ? (
                      <>
                        {avgValues[p.variable].toFixed(2)}{' '}
                        <span className={`text-[10px] font-bold ${textClasses.muted}`}>{p.unit}</span>
                      </>
                    )
                    : <span className={textClasses.muted}>— {p.unit}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShredTrendChart({ title, lines, chartData, loading, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  return (
    <div className={`flex flex-1 min-h-0 flex-col rounded-2xl border p-4 ${cardClasses}`}>
      <div className="mb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <h3 className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
          }`}>{loading ? 'Loading…' : `${chartData.length} pts`}</span>
          <ChartCardToolbar isDarkMode={isDarkMode} onExpand={() => onExpand?.({ title, lines, chartData })} />
        </div>
      </div>

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
              <YAxis tick={{ ...axisStyle, fontSize: 8 }} stroke={isDarkMode ? '#334155' : '#cbd5e1'} />
              <Tooltip content={(props) => <ShredTooltip {...props} lines={lines} isDarkMode={isDarkMode} />} />
              {lines.map((l) => (
                <Line key={l.variable} type="monotone" dataKey={l.variable} name={l.label}
                  stroke={l.color} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const SHRED_ALL_VARS = new Set([
  ...SHRED_LHS_PARAMS.map((p) => p.variable),
  ...SHRED_RHS_PARAMS.map((p) => p.variable),
]);

function ShredTempView({ series, loading, error, fromDate, toDate, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  // All vars selected by default (every line visible)
  const [selectedVars, setSelectedVars] = useState(() => new Set(SHRED_ALL_VARS));

  const toggleVar = (variable) =>
    setSelectedVars((prev) => {
      const next = new Set(prev);
      if (next.has(variable)) next.delete(variable);
      else next.add(variable);
      return next;
    });

  const toggleAll = (params, select) =>
    setSelectedVars((prev) => {
      const next = new Set(prev);
      for (const p of params) {
        if (select) next.add(p.variable);
        else next.delete(p.variable);
      }
      return next;
    });

  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  // Average of each variable across the filtered period
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
    const result = {};
    for (const k of Object.keys(sums)) result[k] = sums[k] / counts[k];
    return result;
  }, [filteredSeries]);

  // Only show lines whose variable is in selectedVars
  const activeTempLines = useMemo(
    () => SHRED_TEMP_LINES.filter((l) => selectedVars.has(l.variable)),
    [selectedVars],
  );
  const activeVibLines = useMemo(
    () => SHRED_VIB_LINES.filter((l) => selectedVars.has(l.variable)),
    [selectedVars],
  );

  const tempChartData = useMemo(
    () => (loading || activeTempLines.length === 0 ? [] : buildShredChartData(filteredSeries, activeTempLines)),
    [filteredSeries, activeTempLines, loading],
  );
  const vibChartData = useMemo(
    () => (loading || activeVibLines.length === 0 ? [] : buildShredChartData(filteredSeries, activeVibLines)),
    [filteredSeries, activeVibLines, loading],
  );

  if (error) {
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
        isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
      }`}>{error}</div>
    );
  }

  return (
    <div className="grid h-full grid-cols-12 items-stretch gap-3">
      {/* LHS params — full height, selectable rows */}
      <div className="col-span-12 flex lg:col-span-3">
        <ShredParamCard
          title="Shredder LHS Parameters"
          subtitle="Left Hand Side"
          params={SHRED_LHS_PARAMS}
          avgValues={avgValues}
          selectedVars={selectedVars}
          onToggleVar={toggleVar}
          onToggleAll={toggleAll}
          loading={loading}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          fullHeight
        />
      </div>

      {/* Center: two charts split equally */}
      <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-6">
        <ShredTrendChart
          title="Shredder Temp — Daily Trend"
          lines={activeTempLines}
          chartData={tempChartData}
          loading={loading}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onExpand={onExpand}
        />
        <ShredTrendChart
          title="Shredder Vibrations — Daily Trend"
          lines={activeVibLines}
          chartData={vibChartData}
          loading={loading}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          axisStyle={axisStyle}
          gridStyle={gridStyle}
          onExpand={onExpand}
        />
      </div>

      {/* RHS params — full height, selectable rows */}
      <div className="col-span-12 flex lg:col-span-3">
        <ShredParamCard
          title="Shredder RHS Parameters"
          subtitle="Right Hand Side"
          params={SHRED_RHS_PARAMS}
          avgValues={avgValues}
          selectedVars={selectedVars}
          onToggleVar={toggleVar}
          onToggleAll={toggleAll}
          loading={loading}
          isDarkMode={isDarkMode}
          cardClasses={cardClasses}
          textClasses={textClasses}
          fullHeight
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * OTG Bearing Temp sub-tab  (mill_logbook2 → M1–M4_*)
 * ────────────────────────────────────────────────────────────────────────── */

const OTG_TEMP_PANELS = [
  ...[1, 2, 3, 4].map((n) => ({
    key: `M${n}`,
    title: `Mill ${n} (Degree Celsius)`,
    col: 'col-span-12 md:col-span-6',
    lines: [
      { variable: `M${n}_InpM`, label: 'Input-M',        color: '#f59e0b' },
      { variable: `M${n}_InpT`, label: 'Input-T',        color: '#d97706' },
      { variable: `M${n}_IntM`, label: 'Intermediate-M', color: '#8b5cf6' },
      { variable: `M${n}_IntT`, label: 'Intermediate-T', color: '#6d28d9' },
      { variable: `M${n}_OutM`, label: 'Output-M',       color: '#3b82f6' },
      { variable: `M${n}_OutT`, label: 'Output-T',       color: '#1e3a8a' },
    ],
  })),
];

/** Generic panel-grid renderer shared by ShredTempView and OtgBearingTempView. */
function ShredPanelGrid({ panels, series, loading, error, fromDate, toDate, isDarkMode, cardClasses, textClasses, axisStyle, gridStyle, onExpand }) {
  const filteredSeries = useMemo(() => {
    if (!fromDate || !toDate) return series;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
  }, [series, fromDate, toDate]);

  if (error) {
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
        isDarkMode ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900'
      }`}>{error}</div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-3">
      {panels.map((panel) => {
        const chartData = loading ? [] : filteredSeries
          .filter((row) => panel.lines.some(({ variable }) => {
            const v = row.values?.[variable];
            return v != null && Number.isFinite(v);
          }))
          .map((row) => {
            const point = {
              label: row.dateIso ? row.dateIso.slice(5).replace('-', '/') : '',
              timeIso: row.timeIso,
            };
            for (const { variable } of panel.lines) {
              const v = row.values?.[variable];
              point[variable] = v != null && Number.isFinite(v) ? Number(v) : null;
            }
            return point;
          })
          .sort((a, b) => (a.timeIso || '').localeCompare(b.timeIso || ''));

        return (
          <div
            key={panel.key}
            className={`${panel.col} flex flex-col rounded-2xl border p-4 ${cardClasses}`}
            style={{ height: 280 }}
          >
            {/* Header */}
            <div className="mb-2 flex items-center justify-between shrink-0">
              <h3 className={`text-[10px] font-black uppercase tracking-wider ${textClasses.muted}`}>
                {panel.title}
              </h3>
              <div className="flex items-center gap-1.5">
                {loading ? (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>Loading…</span>
                ) : (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}>{chartData.length} pts</span>
                )}
                <ChartCardToolbar
                  isDarkMode={isDarkMode}
                  onExpand={() => onExpand?.({ title: panel.title, lines: panel.lines, chartData })}
                />
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : chartData.length === 0 ? (
                <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-[11px] font-semibold ${
                  isDarkMode ? 'border-slate-700 text-slate-600' : 'border-slate-200 text-slate-400'
                }`}>
                  No data in range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} {...gridStyle} />
                    <XAxis
                      dataKey="label"
                      tick={{ ...axisStyle, fontSize: 8 }}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ ...axisStyle, fontSize: 8 }}
                      stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                    />
                    <Tooltip
                      content={(props) => <ShredTooltip {...props} lines={panel.lines} isDarkMode={isDarkMode} />}
                    />
                    {panel.lines.map((l) => (
                      <Line
                        key={l.variable}
                        type="monotone"
                        dataKey={l.variable}
                        name={l.label}
                        stroke={l.color}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend */}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 shrink-0">
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
  );
}

function OtgBearingTempView(props) {
  return <ShredPanelGrid panels={OTG_TEMP_PANELS} {...props} />;
}

function ShredTooltip({ active, payload, label, lines, isDarkMode }) {
  if (!active || !payload?.length) return null;
  const entries = payload
    .map((p) => ({ label: lines.find((l) => l.variable === p.dataKey)?.label || p.dataKey, color: p.color, value: p.value }))
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

function PanelTooltip({ active, payload, label, vars, isDarkMode }) {
  if (!active || !payload || !payload.length) return null;
  const present = payload.filter((p) => p.value != null && Number.isFinite(p.value));
  if (!present.length) return null;
  return (
    <div
      className={`max-w-[220px] rounded-xl border p-2.5 text-[11px] font-bold shadow-xl ${
        isDarkMode ? 'border-slate-700 bg-slate-800/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-700'
      }`}
    >
      <p className={`mb-1.5 border-b pb-1.5 text-[10px] ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        {label}
      </p>
      <div className="space-y-1">
        {present.map((entry, i) => {
          const meta = vars.find((v) => v.variable === entry.dataKey);
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{meta?.label || entry.dataKey}:</span>
              </div>
              <span className="font-mono">{Number(entry.value).toFixed(1)}°</span>
            </div>
          );
        })}
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

export { useEquipmentTempData };
