import { useEffect, useState } from 'react';
import { MdClose, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import { DATA_UPLOAD_SECTIONS } from '../../config/dataUploadSections';

/**
 * Map an employee to one or more Data Upload sections.
 * Header "Data Upload" shows only when at least one section is selected.
 */
const EmployeeDataUploadAccessModal = ({ user, assignments, onClose, onSaved }) => {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = assignments.find((a) => String(a.user?._id) === String(user._id));
    setSelected(Array.isArray(row?.sections) ? [...row.sections] : []);
    setLoading(false);
  }, [assignments, user._id]);

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/data-upload-access', { userId: user._id, sections: selected });
      toast.success(
        selected.length
          ? 'Data upload sections saved.'
          : 'Data upload access removed for this employee.',
      );
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
            <h2 className="text-base font-semibold text-gray-900">Data upload mapping</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {user.name} <span className="text-gray-400">({user.email})</span>
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-600">
              Choose which Data Ingestion sections this employee can use. If none are selected, the
              <strong> Data Upload</strong> tab is hidden in their header.
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
            <div className="space-y-2">
              {DATA_UPLOAD_SECTIONS.map((sec) => {
                const on = selected.includes(sec.key);
                return (
                  <label
                    key={sec.key}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                      on ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(sec.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded text-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{sec.label}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">Section key: {sec.key}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading} className="btn-primary">
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save mapping'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDataUploadAccessModal;
