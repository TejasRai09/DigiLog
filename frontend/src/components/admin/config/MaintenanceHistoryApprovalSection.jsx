import { useEffect, useState } from 'react';
import { MdDomain, MdFactory, MdPrecisionManufacturing, MdSave, MdEmail } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

function ApprovalCard({
  title,
  description,
  icon: Icon,
  domain,
  enabled,
  hodUserId,
  digestTime,
  employees,
  onToggle,
  onHodChange,
  onDigestTimeChange,
  onResend,
  resending,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/40 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-2.5 text-violet-600">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Enable HOD approval</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </label>

      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">HOD employee</label>
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

      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
          Daily digest time (IST)
        </label>
        <input
          type="time"
          value={digestTime || '22:00'}
          onChange={(e) => onDigestTimeChange(e.target.value || '22:00')}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
        />
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          One email to the HOD at this time with pending maintenance changes. The email opens a
          no-login approvals inbox where they can review each change and accept or send for modification.
        </p>
      </div>

      {enabled && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={resending === `${domain}:all`}
            onClick={() => onResend(domain, 'all')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            {resending === `${domain}:all` ? <Spinner size="sm" /> : <MdEmail className="w-3.5 h-3.5" />}
            Resend full digest
          </button>
          <button
            type="button"
            disabled={resending === `${domain}:new`}
            onClick={() => onResend(domain, 'new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            {resending === `${domain}:new` ? <Spinner size="sm" /> : <MdEmail className="w-3.5 h-3.5" />}
            Email new pending only
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY_DOMAIN = { enabled: false, hodUserId: null, digestTime: '22:00' };

export default function MaintenanceHistoryApprovalSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState('');
  const [employees, setEmployees] = useState([]);
  const [sugar, setSugar] = useState(EMPTY_DOMAIN);
  const [power, setPower] = useState(EMPTY_DOMAIN);
  const [production, setProduction] = useState(EMPTY_DOMAIN);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/maintenance-history-approval-settings');
        if (cancelled) return;
        setEmployees(data.employees || []);
        setSugar(data.sugar || EMPTY_DOMAIN);
        setPower(data.power || EMPTY_DOMAIN);
        setProduction(data.production || EMPTY_DOMAIN);
      } catch {
        if (!cancelled) toast.error('Failed to load maintenance history approval settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/maintenance-history-approval-settings', {
        sugar,
        power,
        production,
      });
      setSugar(data.sugar);
      setPower(data.power);
      setProduction(data.production);
      toast.success('Maintenance history approval settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const resend = async (domain, mode) => {
    const key = `${domain}:${mode}`;
    setResending(key);
    try {
      const { data } = await api.post('/admin/maintenance-history-approval-settings/resend-digest', {
        domain,
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
      title="Maintenance History Approval"
      description="When enabled, maintenance history add/edit/delete on Sugar House, Power Plant, and Production House equipment cards is held pending until the configured HOD reviews them from the daily digest email inbox — no DigiLog login required."
      actions={
        loading ? <Spinner size="sm" /> : (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <MdSave className="w-3.5 h-3.5" />}
            Save
          </button>
        )
      }
    >
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ApprovalCard
            title="Sugar House"
            description="Equipment cards under Sugar House Equipment History."
            icon={MdDomain}
            domain="sugar"
            enabled={sugar.enabled}
            hodUserId={sugar.hodUserId}
            digestTime={sugar.digestTime}
            employees={employees}
            onToggle={(enabled) => setSugar((s) => ({ ...s, enabled }))}
            onHodChange={(hodUserId) => setSugar((s) => ({ ...s, hodUserId }))}
            onDigestTimeChange={(digestTime) => setSugar((s) => ({ ...s, digestTime }))}
            onResend={resend}
            resending={resending}
          />
          <ApprovalCard
            title="Power Plant"
            description="Equipment cards under Power Plant Equipment History (new)."
            icon={MdFactory}
            domain="power"
            enabled={power.enabled}
            hodUserId={power.hodUserId}
            digestTime={power.digestTime}
            employees={employees}
            onToggle={(enabled) => setPower((s) => ({ ...s, enabled }))}
            onHodChange={(hodUserId) => setPower((s) => ({ ...s, hodUserId }))}
            onDigestTimeChange={(digestTime) => setPower((s) => ({ ...s, digestTime }))}
            onResend={resend}
            resending={resending}
          />
          <ApprovalCard
            title="Production House"
            description="Equipment cards under Production House Equipment History."
            icon={MdPrecisionManufacturing}
            domain="production"
            enabled={production.enabled}
            hodUserId={production.hodUserId}
            digestTime={production.digestTime}
            employees={employees}
            onToggle={(enabled) => setProduction((s) => ({ ...s, enabled }))}
            onHodChange={(hodUserId) => setProduction((s) => ({ ...s, hodUserId }))}
            onDigestTimeChange={(digestTime) => setProduction((s) => ({ ...s, digestTime }))}
            onResend={resend}
            resending={resending}
          />
        </div>
      )}
    </ConfigSectionPanel>
  );
}
