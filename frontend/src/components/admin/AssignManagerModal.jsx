import { useState } from 'react';
import { MdClose, MdSave, MdSupervisorAccount } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';

/**
 * Assign (or remove) a manager for one employee.
 * `allUsers` — full list from GET /admin/users (already loaded in EmployeeManagement).
 */
export default function AssignManagerModal({ user, allUsers, onClose, onSaved }) {
  const current = user.managerId ?? '';
  const [managerId, setManagerId] = useState(String(current));
  const [saving, setSaving]       = useState(false);

  // Exclude the user themselves from the picker
  const candidates = (allUsers ?? []).filter((u) => String(u._id) !== String(user._id));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${user._id}/manager`, {
        managerId: managerId === '' ? null : Number(managerId),
      });
      toast.success('Manager assigned successfully.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign manager.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MdSupervisorAccount className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Assign manager</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-700">{user.name}</span>{' '}
                <span className="text-blue-600">({user.email})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 mt-0.5"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="label mb-1 block text-xs font-semibold text-gray-600">
            Select manager
          </label>
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="input w-full"
          >
            <option value="">— None (no manager) —</option>
            {candidates.map((u) => (
              <option key={u._id} value={String(u._id)}>
                {u.name}
                {u.department ? ` · ${u.department}` : ''}
                {u.role === 'admin' ? ' (admin)' : ''}
              </option>
            ))}
          </select>

          {managerId !== '' && managerId === String(current) && (
            <p className="mt-2 text-xs text-gray-400">
              Current manager: <span className="font-medium text-gray-600">{user.managerName}</span>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}
