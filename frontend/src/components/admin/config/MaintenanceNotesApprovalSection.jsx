import { useEffect, useState } from 'react';
import { MdDomain, MdFactory, MdPrecisionManufacturing, MdSave, MdEmail } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

function HodCard({
  title,
  description,
  icon: Icon,
  plant,
  hodUserId,
  digestTime,
  digestTime2,
  employees,
  onHodChange,
  onDigestTimeChange,
  onDigestTime2Change,
  onResend,
  resending,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/40 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-2.5 text-amber-700">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
          HOD who can close notes for this plant
        </label>
        <select
          value={hodUserId || ''}
          onChange={(e) => onHodChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
        >
          <option value="">— Select employee —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} ({emp.email})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Combined digest times (IST)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Time 1
            </label>
            <input
              type="time"
              value={digestTime || '22:00'}
              onChange={(e) => onDigestTimeChange(e.target.value || '22:00')}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Time 2 (optional)
            </label>
            <input
              type="time"
              value={digestTime2 || ''}
              onChange={(e) => onDigestTime2Change(e.target.value || '')}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          The HOD receives one email covering Forms, Maintenance History, and Maintenance Notes at each time (IST).
          Leave Time 2 blank to send only once per day.
        </p>
      </div>

      {hodUserId ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={resending === `${plant}:all`}
            onClick={() => onResend(plant, 'all')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            {resending === `${plant}:all` ? <Spinner size="sm" /> : <MdEmail className="w-3.5 h-3.5" />}
            {resending === `${plant}:all` ? 'Sending…' : 'Resend full digest'}
          </button>
          <button
            type="button"
            disabled={resending === `${plant}:new`}
            onClick={() => onResend(plant, 'new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            {resending === `${plant}:new` ? <Spinner size="sm" /> : <MdEmail className="w-3.5 h-3.5" />}
            {resending === `${plant}:new` ? 'Sending…' : 'Email new pending only'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY = { hodUserId: null, digestTime: '22:00', digestTime2: '' };

export default function MaintenanceNotesApprovalSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState('');
  const [employees, setEmployees] = useState([]);
  const [sugar, setSugar] = useState(EMPTY);
  const [power, setPower] = useState(EMPTY);
  const [production, setProduction] = useState(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/maintenance-notes-approval-settings');
        if (cancelled) return;
        setEmployees(data.employees || []);
        setSugar({ ...EMPTY, ...(data.sugar || {}) });
        setPower({ ...EMPTY, ...(data.power || {}) });
        setProduction({ ...EMPTY, ...(data.production || {}) });
      } catch {
        if (!cancelled) toast.error('Failed to load Maintenance Notes HOD settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/maintenance-notes-approval-settings', {
        sugar, power, production,
      });
      setSugar({ ...EMPTY, ...(data.sugar || {}) });
      setPower({ ...EMPTY, ...(data.power || {}) });
      setProduction({ ...EMPTY, ...(data.production || {}) });
      toast.success('Maintenance Notes HOD settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const resend = async (plant, mode) => {
    const key = `${plant}:${mode}`;
    setResending(key);
    try {
      const { data } = await api.post('/admin/maintenance-notes-approval-settings/resend-digest', {
        plant,
        mode,
      });
      if (data.sent) toast.success(data.message || 'Digest sent.');
      else toast(data.message || 'Nothing to email.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend digest.');
    } finally {
      setResending('');
    }
  };

  return (
    <ConfigSectionPanel
      title="Maintenance Notes Approval"
      description="Each plant has its own HOD. Notes stay pending until that HOD completes them. Digest times feed the same combined HOD email as Forms and Maintenance History — no DigiLog login required."
      actions={
        loading ? <Spinner size="sm" /> : (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <MdSave className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        )
      }
    >
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HodCard
            title="Sugar House"
            description="Notes linked to Sugar House. This HOD closes Sugar House notes."
            icon={MdDomain}
            plant="sugar"
            hodUserId={sugar.hodUserId}
            digestTime={sugar.digestTime}
            digestTime2={sugar.digestTime2}
            employees={employees}
            onHodChange={(hodUserId) => setSugar((s) => ({ ...s, hodUserId }))}
            onDigestTimeChange={(digestTime) => setSugar((s) => ({ ...s, digestTime }))}
            onDigestTime2Change={(digestTime2) => setSugar((s) => ({ ...s, digestTime2 }))}
            onResend={resend}
            resending={resending}
          />
          <HodCard
            title="Power Plant"
            description="Notes linked to Power Plant. This HOD closes Power Plant notes."
            icon={MdFactory}
            plant="power"
            hodUserId={power.hodUserId}
            digestTime={power.digestTime}
            digestTime2={power.digestTime2}
            employees={employees}
            onHodChange={(hodUserId) => setPower((s) => ({ ...s, hodUserId }))}
            onDigestTimeChange={(digestTime) => setPower((s) => ({ ...s, digestTime }))}
            onDigestTime2Change={(digestTime2) => setPower((s) => ({ ...s, digestTime2 }))}
            onResend={resend}
            resending={resending}
          />
          <HodCard
            title="Production House"
            description="Notes linked to Production House. This HOD closes Production House notes."
            icon={MdPrecisionManufacturing}
            plant="production"
            hodUserId={production.hodUserId}
            digestTime={production.digestTime}
            digestTime2={production.digestTime2}
            employees={employees}
            onHodChange={(hodUserId) => setProduction((s) => ({ ...s, hodUserId }))}
            onDigestTimeChange={(digestTime) => setProduction((s) => ({ ...s, digestTime }))}
            onDigestTime2Change={(digestTime2) => setProduction((s) => ({ ...s, digestTime2 }))}
            onResend={resend}
            resending={resending}
          />
        </div>
      )}
    </ConfigSectionPanel>
  );
}
