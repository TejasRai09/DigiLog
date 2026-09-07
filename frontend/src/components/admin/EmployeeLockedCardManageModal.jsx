import { useEffect, useState } from 'react';
import { MdClose, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';

const DOMAIN_OPTIONS = [
  { key: 'sugar', label: 'Sugar House', hint: 'Imported hierarchy cards' },
  { key: 'power', label: 'Power Plant', hint: 'Built-in hierarchy cards' },
  { key: 'production', label: 'Production House', hint: 'Extracted equipment cards' },
];

/**
 * Grant an employee permission to edit/rename/delete locked equipment cards
 * for selected domains.
 */
export default function EmployeeLockedCardManageModal({ user, assignments, onClose, onSaved }) {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = assignments.find((a) => String(a.user?._id) === String(user._id));
    setSelected(Array.isArray(row?.domains) ? [...row.domains] : []);
    setLoading(false);
  }, [assignments, user._id]);

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/locked-card-manage-access', {
        userId: user._id,
        domains: selected,
      });
      toast.success(
        selected.length
          ? 'Locked-card manage access saved.'
          : 'Locked-card manage access removed for this employee.',
      );
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Locked card manage access</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {user.name} <span className="text-gray-400">({user.email})</span>
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-600">
              Allow this user to <strong>edit, rename, and delete</strong> locked (imported /
              built-in / extracted) equipment cards for the domains you select. Role alone
              (including admin) does not unlock cards — only these grants do. Specs and
              maintenance history stay available to everyone as usual.
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
              {DOMAIN_OPTIONS.map((sec) => {
                const on = selected.includes(sec.key);
                return (
                  <label
                    key={sec.key}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                      on ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(sec.key)}
                      className="mt-1 h-4 w-4 rounded text-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{sec.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{sec.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
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
