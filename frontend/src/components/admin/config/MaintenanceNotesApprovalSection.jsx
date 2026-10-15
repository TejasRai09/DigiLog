import { useEffect, useState } from 'react';
import { MdDomain, MdFactory, MdPrecisionManufacturing, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

function HodCard({ title, description, icon: Icon, hodUserId, employees, onHodChange }) {
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
    </div>
  );
}

const EMPTY = { hodUserId: null };

export default function MaintenanceNotesApprovalSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        setSugar(data.sugar || EMPTY);
        setPower(data.power || EMPTY);
        setProduction(data.production || EMPTY);
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
      setSugar(data.sugar || EMPTY);
      setPower(data.power || EMPTY);
      setProduction(data.production || EMPTY);
      toast.success('Maintenance Notes HOD settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSectionPanel
      title="Maintenance Notes Approval"
      description="Each plant has its own HOD. Users can add notes and ask for completion, but only that plant’s HOD can mark a note Completed."
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
            hodUserId={sugar.hodUserId}
            employees={employees}
            onHodChange={(hodUserId) => setSugar({ hodUserId })}
          />
          <HodCard
            title="Power Plant"
            description="Notes linked to Power Plant. This HOD closes Power Plant notes."
            icon={MdFactory}
            hodUserId={power.hodUserId}
            employees={employees}
            onHodChange={(hodUserId) => setPower({ hodUserId })}
          />
          <HodCard
            title="Production House"
            description="Notes linked to Production House. This HOD closes Production House notes."
            icon={MdPrecisionManufacturing}
            hodUserId={production.hodUserId}
            employees={employees}
            onHodChange={(hodUserId) => setProduction({ hodUserId })}
          />
        </div>
      )}
    </ConfigSectionPanel>
  );
}
