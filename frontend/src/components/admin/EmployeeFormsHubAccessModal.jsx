import { useEffect, useState } from 'react';
import { MdClose, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';

/**
 * Set whether an employee can submit/edit Forms Hub cards, or only view them.
 */
export default function EmployeeFormsHubAccessModal({ user, onClose, onSaved }) {
  const [viewOnly, setViewOnly] = useState(Boolean(user?.formsHubViewOnly));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setViewOnly(Boolean(user?.formsHubViewOnly));
  }, [user?._id, user?.formsHubViewOnly]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${user._id}`, { formsHubViewOnly: viewOnly });
      toast.success(
        viewOnly
          ? 'Forms Hub set to view only. The employee must log out and log in for this to take effect.'
          : 'Forms Hub full access saved. The employee must log out and log in for this to take effect.',
      );
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save Forms Hub access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Forms Hub access</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {user.name} <span className="text-gray-400">({user.email})</span>
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-600">
              Form mapping still decides which cards this employee can open. This setting
              decides whether they can submit and edit, or only view the data.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-5">
          <label
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
              !viewOnly ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="formsHubAccess"
              checked={!viewOnly}
              onChange={() => setViewOnly(false)}
              className="mt-1 h-4 w-4 text-blue-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Full access</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Submit forms and edit equipment specifications
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
              viewOnly ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="formsHubAccess"
              checked={viewOnly}
              onChange={() => setViewOnly(true)}
              className="mt-1 h-4 w-4 text-amber-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">View only</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                See data only — cannot submit, save, upload, or delete
              </span>
            </span>
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
