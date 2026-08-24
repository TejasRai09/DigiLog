import { useEffect, useState } from 'react';
import { MdSave, MdCalculate } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

/**
 * BI Dashboards config: calculation constants only.
 * Compare season chips come from Config → Season Mapping (all seasons except current).
 */
export default function BiDashboardSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [theoreticalYield, setTheoreticalYield] = useState('64.4');
  const [powerTariffRate, setPowerTariffRate] = useState('4.85');
  const [constantsError, setConstantsError] = useState({});
  const [savingConstants, setSavingConstants] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/bi-settings');
        if (cancelled || !data) return;
        if (typeof data.theoreticalYield === 'number') setTheoreticalYield(String(data.theoreticalYield));
        if (typeof data.powerTariffRate === 'number') setPowerTariffRate(String(data.powerTariffRate));
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

  const saveConstants = async () => {
    const yVal = parseFloat(theoreticalYield);
    const tVal = parseFloat(powerTariffRate);
    const errs = {};
    if (!Number.isFinite(yVal) || yVal <= 0) errs.yield = 'Must be a positive number (e.g. 64.4)';
    if (!Number.isFinite(tVal) || tVal <= 0) errs.tariff = 'Must be a positive number (e.g. 4.85)';
    if (Object.keys(errs).length) {
      setConstantsError(errs);
      return;
    }
    setSavingConstants(true);
    try {
      const { data } = await api.put('/admin/bi-settings', {
        theoreticalYield: yVal,
        powerTariffRate: tVal,
      });
      if (typeof data.theoreticalYield === 'number') setTheoreticalYield(String(data.theoreticalYield));
      if (typeof data.powerTariffRate === 'number') setPowerTariffRate(String(data.powerTariffRate));
      try {
        sessionStorage.removeItem('app_constants_cache');
      } catch (_) { /* ignore */ }
      toast.success('Calculation constants saved.');
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
      description="Calculation constants for Distillery and Power House. Compare seasons are managed under Season Mapping — every mapped season (except the current one) appears in Compare."
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
                Business constants used in live dashboard calculations. Changes take effect on the next page load.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>
      </div>
    </ConfigSectionPanel>
  );
}
