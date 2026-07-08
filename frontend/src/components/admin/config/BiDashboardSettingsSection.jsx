import { useEffect, useState } from 'react';
import { MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

export default function BiDashboardSettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/bi-settings');
        if (!cancelled) setEnabled(Boolean(data.thirdSeasonCompareEnabled));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/bi-settings', {
        thirdSeasonCompareEnabled: enabled,
      });
      setEnabled(Boolean(data.thirdSeasonCompareEnabled));
      toast.success('BI dashboard settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSectionPanel
      title="BI dashboards"
      description="When enabled, analytics dashboards show four compare options: prior period plus three dynamic season labels (e.g. 2024-2025, 2023-2024, 2022-2023)."
      actions={
        loading ? (
          <Spinner size="sm" />
        ) : (
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
            <MdSave className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        )
      }
    >
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading || saving}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-800">
          Enable 3rd season comparison on all BI dashboards
        </span>
      </label>
    </ConfigSectionPanel>
  );
}
