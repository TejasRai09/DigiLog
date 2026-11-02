import { useEffect, useState } from 'react';
import { MdSave, MdCalculate, MdStorage, MdSensors, MdSync } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';
import { APP_CONSTANT_DEFAULTS } from '../../../hooks/useAppConstants';

function tripleFrom(src, fallback = APP_CONSTANT_DEFAULTS) {
  const y = typeof src?.theoreticalYield === 'number' && src.theoreticalYield > 0
    ? src.theoreticalYield : fallback.theoreticalYield;
  const t = typeof src?.powerTariffRate === 'number' && src.powerTariffRate > 0
    ? src.powerTariffRate : fallback.powerTariffRate;
  const b = typeof src?.brixThreshold === 'number' && src.brixThreshold > 0
    ? src.brixThreshold : fallback.brixThreshold;
  return { theoreticalYield: y, powerTariffRate: t, brixThreshold: b };
}

function toFieldStrings(triple) {
  return {
    theoreticalYield: String(triple.theoreticalYield),
    powerTariffRate: String(triple.powerTariffRate),
    brixThreshold: String(triple.brixThreshold),
  };
}

/**
 * BI Dashboards config: calculation constants per sugar season.
 * Compare season chips come from Config → Season Mapping (all seasons except current).
 */
export default function BiDashboardSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [defaults, setDefaults] = useState(APP_CONSTANT_DEFAULTS);
  const [valuesBySeason, setValuesBySeason] = useState({});
  const [theoreticalYield, setTheoreticalYield] = useState(String(APP_CONSTANT_DEFAULTS.theoreticalYield));
  const [powerTariffRate, setPowerTariffRate] = useState(String(APP_CONSTANT_DEFAULTS.powerTariffRate));
  const [brixThreshold, setBrixThreshold] = useState(String(APP_CONSTANT_DEFAULTS.brixThreshold));
  const [constantsError, setConstantsError] = useState({});
  const [savingConstants, setSavingConstants] = useState(false);
  const [canePerformanceDataSource, setCanePerformanceDataSource] = useState('db');
  const [savingDataSource, setSavingDataSource] = useState(false);
  const [caneSyncInfo, setCaneSyncInfo] = useState(null);
  const [manualSyncing, setManualSyncing] = useState(false);

  const applyTripleToFields = (triple) => {
    const fields = toFieldStrings(triple);
    setTheoreticalYield(fields.theoreticalYield);
    setPowerTariffRate(fields.powerTariffRate);
    setBrixThreshold(fields.brixThreshold);
  };

  const valuesForSeason = (label, bySeason, fallback) => (
    tripleFrom(label && bySeason?.[label], fallback)
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data }, seasonsRes] = await Promise.all([
          api.get('/admin/bi-settings'),
          api.get('/admin/season-mapping').catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        if (data?.canePerformanceDataSource) {
          setCanePerformanceDataSource(data.canePerformanceDataSource);
        }
        if (data?.caneSyncInfo) {
          setCaneSyncInfo(data.caneSyncInfo);
        }
        const fallback = tripleFrom(data?.defaults || data, APP_CONSTANT_DEFAULTS);
        setDefaults(fallback);

        const seasonRows = Array.isArray(seasonsRes?.data) ? seasonsRes.data : [];
        const newestFirst = [...seasonRows].sort((a, b) => {
          const as = String(a.start_date || '').slice(0, 10);
          const bs = String(b.start_date || '').slice(0, 10);
          return bs.localeCompare(as);
        });
        setSeasons(newestFirst);

        const bySeason = {};
        newestFirst.forEach((s) => {
          const label = s.season_label;
          bySeason[label] = valuesForSeason(label, data?.constantsBySeason, fallback);
        });
        setValuesBySeason(bySeason);

        const today = new Date().toISOString().slice(0, 10);
        const current = newestFirst.find((s) => {
          const start = String(s.start_date || '').slice(0, 10);
          const end = String(s.end_date || '').slice(0, 10);
          return start && end && today >= start && today <= end;
        });
        const initialLabel = current?.season_label || newestFirst[0]?.season_label || '';
        setSelectedSeason(initialLabel);

        if (initialLabel) {
          applyTripleToFields(bySeason[initialLabel] || fallback);
        } else {
          applyTripleToFields(fallback);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load BI dashboard settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isCurrentSeason = (row) => {
    const today = new Date().toISOString().slice(0, 10);
    const start = String(row.start_date || '').slice(0, 10);
    const end = String(row.end_date || '').slice(0, 10);
    return Boolean(start && end && today >= start && today <= end);
  };

  const selectedRow = seasons.find((s) => s.season_label === selectedSeason) || null;
  const hasSeasons = seasons.length > 0;

  const onSeasonChange = (nextLabel) => {
    const draft = {
      theoreticalYield: parseFloat(theoreticalYield) || defaults.theoreticalYield,
      powerTariffRate: parseFloat(powerTariffRate) || defaults.powerTariffRate,
      brixThreshold: parseFloat(brixThreshold) || defaults.brixThreshold,
    };
    const nextMap = selectedSeason
      ? { ...valuesBySeason, [selectedSeason]: draft }
      : valuesBySeason;
    setValuesBySeason(nextMap);
    setSelectedSeason(nextLabel);
    applyTripleToFields(valuesForSeason(nextLabel, nextMap, defaults));
    setConstantsError({});
  };

  const handleManualSync = async () => {
    setManualSyncing(true);
    try {
      const { data } = await api.post('/admin/bi-settings/sync-cane-live');
      toast.success(data.message || 'Live data synced successfully.');
      if (data.syncInfo) {
        setCaneSyncInfo({
          lastSyncedAt: data.syncInfo.lastSyncTime,
          lastSyncStatus: data.syncInfo.lastSyncResult,
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Manual live sync failed.');
    } finally {
      setManualSyncing(false);
    }
  };

  const handleDataSourceChange = async (nextSource) => {
    if (nextSource === canePerformanceDataSource || savingDataSource) return;
    setCanePerformanceDataSource(nextSource);
    setSavingDataSource(true);
    try {
      await api.put('/admin/bi-settings', { canePerformanceDataSource: nextSource });
      toast.success(
        nextSource === 'live'
          ? 'Cane Performance switched to Live airacanedb (SQL Server).'
          : 'Cane Performance switched to Local Database (MySQL).'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update Cane Performance data source.');
    } finally {
      setSavingDataSource(false);
    }
  };

  const saveConstants = async () => {
    const yVal = parseFloat(theoreticalYield);
    const tVal = parseFloat(powerTariffRate);
    const bVal = parseFloat(brixThreshold);
    const errs = {};
    if (!Number.isFinite(yVal) || yVal <= 0) errs.yield = 'Must be a positive number (e.g. 64.4)';
    if (!Number.isFinite(tVal) || tVal <= 0) errs.tariff = 'Must be a positive number (e.g. 4.85)';
    if (!Number.isFinite(bVal) || bVal <= 0) errs.brix = 'Must be a positive number (e.g. 18)';
    if (Object.keys(errs).length) {
      setConstantsError(errs);
      return;
    }
    setSavingConstants(true);
    try {
      const body = {
        theoreticalYield: yVal,
        powerTariffRate: tVal,
        brixThreshold: bVal,
      };
      if (hasSeasons && selectedSeason) body.seasonLabel = selectedSeason;
      const { data } = await api.put('/admin/bi-settings', body);
      const saved = tripleFrom(data, { theoreticalYield: yVal, powerTariffRate: tVal, brixThreshold: bVal });
      applyTripleToFields(saved);
      if (hasSeasons && selectedSeason) {
        setValuesBySeason((prev) => ({ ...prev, [selectedSeason]: saved }));
      } else {
        setDefaults(saved);
      }
      try {
        sessionStorage.removeItem('app_constants_cache');
      } catch (_) { /* ignore */ }
      toast.success(hasSeasons && selectedSeason
        ? `Constants saved for ${selectedSeason}.`
        : 'Calculation constants saved.');
      setConstantsError({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save constants.');
    } finally {
      setSavingConstants(false);
    }
  };

  return (
    <ConfigSectionPanel
      title="BI Dashboards"
      description="Data source mode for Cane Performance, plus calculation constants for Distillery, Power House, and Brix Sampling set per sugar season. Compare seasons are managed under Season Mapping."
      actions={
        loading ? (
          <Spinner size="sm" />
        ) : (
          <button
            type="button"
            onClick={saveConstants}
            disabled={savingConstants}
            className="btn-primary shrink-0 gap-2"
          >
            <MdSave className="h-4 w-4" />
            {savingConstants ? 'Saving…' : 'Save Constants'}
          </button>
        )
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-300">
          To add or remove Compare options, use <strong>Season Mapping</strong>. Selecting a season with no data shows a light toast on the dashboard.
        </div>

                {/* Cane Performance Data Source Selection */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                <MdStorage className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Cane Performance Data Source
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    canePerformanceDataSource === 'live'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  }`}>
                    {canePerformanceDataSource === 'live' ? 'Live airacanedb' : 'Local Database'}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Choose whether the Cane Performance Dashboard displays imported records from the local MySQL database or streams live weighment data directly from the factory airacanedb (MSSQL).
                </p>
              </div>
            </div>
            {savingDataSource && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-center">
                <Spinner size="xs" /> Updating…
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {/* Option 1: Local DB */}
            <div
              onClick={() => handleDataSourceChange('db')}
              role="button"
              tabIndex={0}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                canePerformanceDataSource === 'db'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${canePerformanceDataSource === 'db' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    <MdStorage className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      Local Database (MySQL)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Imported tables: g_ctc &amp; cnt_performance
                    </span>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-1 ${
                  canePerformanceDataSource === 'db'
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {canePerformanceDataSource === 'db' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                Loads imported data from the local database. Ideal for offline work, historical season datasets, and imported Excel sheets.
              </p>
            </div>

            {/* Option 2: Live MSSQL */}
            <div
              onClick={() => handleDataSourceChange('live')}
              role="button"
              tabIndex={0}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                canePerformanceDataSource === 'live'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${canePerformanceDataSource === 'live' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    <MdSensors className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      Live airacanedb (SQL Server)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      MSSQL: airacanedb.dbo.G_CTC &amp; CntPerformance
                    </span>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-1 ${
                  canePerformanceDataSource === 'live'
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {canePerformanceDataSource === 'live' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                Connects directly to factory SQL Server. Delivers live weighment timestamps, token-to-gross intervals, and centre arrivals in real-time.
              </p>
            </div>
          </div>

          {/* Sync status & Manual sync button */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Live Sync &amp; Season Comparison:</span>
              <span>
                {caneSyncInfo?.lastSyncedAt
                  ? `Last synced: ${caneSyncInfo.lastSyncedAt}`
                  : 'Continuous sync when dashboard is active'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={manualSyncing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium text-xs shadow-sm disabled:opacity-50 transition-colors shrink-0"
            >
              <MdSync className={`w-3.5 h-3.5 ${manualSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              {manualSyncing ? 'Syncing…' : 'Sync airacanedb Now'}
            </button>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5 border border-slate-200/60 dark:border-slate-800/60 leading-relaxed">
            <strong>Seamless Comparison:</strong> Live weighments and centre dispatches from <code>airacanedb</code> are synced into the application database. This ensures real-time operational visibility while maintaining all historical seasons for previous-year comparison, even when factory live tables are purged before each new season.
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MdCalculate className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Calculation Constants
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hasSeasons
                  ? 'Pick a sugar season, then save its constants. Unsaved seasons keep the global defaults until first save.'
                  : 'Business constants used in live dashboard calculations. Add seasons under Season Mapping to configure them per campaign.'}
              </p>
            </div>
          </div>

          {hasSeasons && (
            <div className="space-y-1.5 max-w-md">
              <label htmlFor="admin-bi-season" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sugar Season
              </label>
              <select
                id="admin-bi-season"
                value={selectedSeason}
                disabled={loading || savingConstants}
                onChange={(e) => onSeasonChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                {seasons.map((s) => (
                  <option key={s.season_label} value={s.season_label}>
                    {s.season_label}{isCurrentSeason(s) ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
              {selectedRow && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {String(selectedRow.start_date || '').slice(0, 10)} – {String(selectedRow.end_date || '').slice(0, 10)}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-theoretical-yield" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Theoretical Yield Factor
              </label>
              <input
                id="admin-theoretical-yield"
                type="number"
                step="0.1"
                min="1"
                value={theoreticalYield}
                disabled={loading || savingConstants}
                onChange={(e) => {
                  setTheoreticalYield(e.target.value);
                  setConstantsError((prev) => ({ ...prev, yield: '' }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-mono ${
                  constantsError.yield
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                } focus:outline-none focus:ring-2 focus:ring-amber-400/50`}
              />
              {constantsError.yield && (
                <p className="text-[11px] text-red-600 dark:text-red-400">{constantsError.yield}</p>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Litres of alcohol per 100 kg fermentable sugar. Used in Distillery Operations. Default:{' '}
                <strong>64.4</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-power-tariff" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Power Export Tariff (₹ / kWh)
              </label>
              <input
                id="admin-power-tariff"
                type="number"
                step="0.01"
                min="0.01"
                value={powerTariffRate}
                disabled={loading || savingConstants}
                onChange={(e) => {
                  setPowerTariffRate(e.target.value);
                  setConstantsError((prev) => ({ ...prev, tariff: '' }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-mono ${
                  constantsError.tariff
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                } focus:outline-none focus:ring-2 focus:ring-amber-400/50`}
              />
              {constantsError.tariff && (
                <p className="text-[11px] text-red-600 dark:text-red-400">{constantsError.tariff}</p>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Used in Power House for export ₹ revenue. Default: <strong>₹4.85</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-brix-threshold" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Brix Ripeness Threshold
              </label>
              <input
                id="admin-brix-threshold"
                type="number"
                step="0.1"
                min="1"
                value={brixThreshold}
                disabled={loading || savingConstants}
                onChange={(e) => {
                  setBrixThreshold(e.target.value);
                  setConstantsError((prev) => ({ ...prev, brix: '' }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-mono ${
                  constantsError.brix
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                } focus:outline-none focus:ring-2 focus:ring-amber-400/50`}
              />
              {constantsError.brix && (
                <p className="text-[11px] text-red-600 dark:text-red-400">{constantsError.brix}</p>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Used in Brix Sampling (Field &amp; Yard) for the "Brix &gt;/&lt; threshold" rate tiles and charts. Default:{' '}
                <strong>18</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ConfigSectionPanel>
  );
}
