import { useEffect, useState } from 'react';
import { MdClose, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import { HOMEPAGE_CARD_OPTIONS } from '../../config/homepageCards';

/**
 * Map which homepage big cards (Forms Hub / BI Control Tower) an employee sees on `/`.
 */
const EmployeeHomepageMappingModal = ({ user, homepageAssignments, onClose, onSaved }) => {
  const [cardKeys, setCardKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = homepageAssignments.find((a) => String(a.user?._id) === String(user._id));
    setCardKeys(row?.cardKeys ?? []);
    setLoading(false);
  }, [homepageAssignments, user._id]);

  const toggle = (key) => {
    setCardKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/homepage-cards', { userId: user._id, cardKeys });
      toast.success('Homepage cards saved.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save homepage cards.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Homepage cards</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.name} <span className="text-gray-400">({user.email})</span>
            </p>
            <p className="text-xs text-slate-600 mt-2 leading-snug">
              Controls the large destination cards on the homepage. Use <strong>Form mapping</strong> and{' '}
              <strong>Dashboard mapping</strong> to choose which apps and dashboards appear inside each area.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="space-y-3">
              {HOMEPAGE_CARD_OPTIONS.map((opt) => {
                const checked = cardKeys.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                      checked ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading} className="btn-primary">
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save homepage cards'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeHomepageMappingModal;
