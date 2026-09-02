import { useEffect, useState } from 'react';
import { MdDomain, MdFactory, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

function ApprovalCard({
  title,
  description,
  icon: Icon,
  enabled,
  hodUserId,
  employees,
  onToggle,
  onHodChange,
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
    </div>
  );
}

export default function MaintenanceHistoryApprovalSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [sugar, setSugar] = useState({ enabled: false, hodUserId: null });
  const [power, setPower] = useState({ enabled: false, hodUserId: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/maintenance-history-approval-settings');
        if (cancelled) return;
        setEmployees(data.employees || []);
        setSugar(data.sugar || { enabled: false, hodUserId: null });
        setPower(data.power || { enabled: false, hodUserId: null });
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
      const { data } = await api.put('/admin/maintenance-history-approval-settings', { sugar, power });
      setSugar(data.sugar);
      setPower(data.power);
      toast.success('Maintenance history approval settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSectionPanel
      title="Maintenance History Approval"
      description="When enabled, maintenance history add/edit/delete on Sugar House and Power Plant equipment cards is held pending until the configured HOD accepts via email."
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
            enabled={sugar.enabled}
            hodUserId={sugar.hodUserId}
            employees={employees}
            onToggle={(enabled) => setSugar((s) => ({ ...s, enabled }))}
            onHodChange={(hodUserId) => setSugar((s) => ({ ...s, hodUserId }))}
          />
          <ApprovalCard
            title="Power Plant"
            description="Equipment cards under Power Plant Equipment History."
            icon={MdFactory}
            enabled={power.enabled}
            hodUserId={power.hodUserId}
            employees={employees}
            onToggle={(enabled) => setPower((s) => ({ ...s, enabled }))}
            onHodChange={(hodUserId) => setPower((s) => ({ ...s, hodUserId }))}
          />
        </div>
      )}
    </ConfigSectionPanel>
  );
}
