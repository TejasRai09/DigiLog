import { useEffect, useState } from 'react';
import { MdSave, MdCalculate } from 'react-icons/md';
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
      description="Calculation constants for Distillery, Power House, and Brix Sampling, set per sugar season. Dashboards use the season of the selected To date (Compare uses the same numbers). Compare seasons are managed under Season Mapping."
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
