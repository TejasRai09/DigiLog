import { useEffect, useState } from 'react';
import { MdClose, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';

/**
 * Grant or revoke Data Upload tab access for one employee.
 */
const EmployeeDataUploadAccessModal = ({ user, assignments, onClose, onSaved }) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = assignments.find((a) => String(a.user?._id) === String(user._id));
    setEnabled(!!row?.enabled);
    setLoading(false);
  }, [assignments, user._id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/data-upload-access', { userId: user._id, enabled });
      toast.success('Data upload access saved.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save data upload access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Data upload access</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {user.name} <span className="text-gray-400">({user.email})</span>
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-600">
              When enabled, this employee sees the <strong>Data Upload</strong> tab and can upload CSV or Excel
              files. All users with access see the shared upload history; each person can delete only their own files.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <label
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                enabled ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded text-emerald-600"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Allow Data Upload tab</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Admins always have access. Employees need this permission to open the ingestion center.
                </p>
              </div>
            </label>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading} className="btn-primary">
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save access'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDataUploadAccessModal;
