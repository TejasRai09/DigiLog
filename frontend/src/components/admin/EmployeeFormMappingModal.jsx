import { useEffect, useMemo, useState } from 'react';
import { MdClose, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';

/**
 * Map one employee to an app + multiselect forms (app must be chosen first).
 * `mappings` should list current rows for all users (from GET /admin/mappings).
 */
const EmployeeFormMappingModal = ({ user, mappings, onClose, onSaved }) => {
  const [appsWithForms, setAppsWithForms] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [appId, setAppId] = useState('');
  const [formIds, setFormIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/apps-all');
        if (!cancelled) setAppsWithForms(data);
      } catch {
        toast.error('Failed to load applications.');
      } finally {
        if (!cancelled) setLoadingApps(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const userMappings = useMemo(
    () => mappings.filter((m) => String(m.user?._id) === String(user._id)),
    [mappings, user._id]
  );

  useEffect(() => {
    if (!appId) {
      setFormIds([]);
      return;
    }
    const m = userMappings.find((x) => String(x.app?._id) === String(appId));
    setFormIds(m?.forms?.map((f) => Number(f._id)) ?? []);
  }, [appId, userMappings]);

  const selectedApp = appsWithForms.find((a) => String(a._id) === String(appId));

  const toggleForm = (fId) => {
    const id = Number(fId);
    setFormIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!appId) {
      toast.error('Select an application first.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/mappings', { userId: user._id, appId, formIds });
      toast.success('Form mapping saved.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save mapping.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Form mapping</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.name} <span className="text-gray-400">({user.email})</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {loadingApps ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <div>
                <label className="label">1. Application</label>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="input"
                >
                  <option value="">— Select application —</option>
                  {appsWithForms.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedApp ? (
                <div>
                  <label className="label">
                    2. Forms
                    <span className="ml-1 font-normal text-gray-400">
                      (multiselect; leave all unchecked for access to every form in this app)
                    </span>
                  </label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {selectedApp.forms?.length ? (
                      selectedApp.forms.map((f) => {
                        const id = Number(f._id);
                        const checked = formIds.includes(id);
                        return (
                          <label
                            key={f._id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleForm(id)}
                              className="h-4 w-4 rounded text-blue-600 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800">{f.name}</p>
                              <p className="text-xs text-gray-400 truncate">{f.formKey}</p>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <p className="px-4 py-3 text-sm text-gray-400">No forms in this application.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Choose an application to see its forms.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !appId || loadingApps}
            className="btn-primary"
          >
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save mapping'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFormMappingModal;
