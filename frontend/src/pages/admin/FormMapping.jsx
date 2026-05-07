import { useEffect, useState } from 'react';
import { MdGridView, MdSave, MdDelete, MdAdd, MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';

// ─── Mapping modal ────────────────────────────────────────────
const MappingModal = ({ users, appsWithForms, initial, onClose, onSaved }) => {
  const [userId,  setUserId]  = useState(initial?.user?._id  || '');
  const [appId,   setAppId]   = useState(initial?.app?._id   || '');
  const [formIds, setFormIds] = useState(initial?.forms?.map((f) => f._id) || []);
  const [saving,  setSaving]  = useState(false);

  const selectedApp = appsWithForms.find((a) => a._id === appId);

  const toggleForm = (fId) =>
    setFormIds((prev) =>
      prev.includes(fId) ? prev.filter((id) => id !== fId) : [...prev, fId]
    );

  const handleSave = async () => {
    if (!userId || !appId) { toast.error('Select a user and an app.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/mappings', { userId, appId, formIds });
      toast.success('Mapping saved.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save mapping.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Mapping' : 'New Mapping'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* User select */}
          <div>
            <label className="label">Employee</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={!!initial}
              className="input"
            >
              <option value="">— Select employee —</option>
              {users
                .filter((u) => u.role === 'employee')
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
          </div>

          {/* App select */}
          <div>
            <label className="label">Application</label>
            <select
              value={appId}
              onChange={(e) => { setAppId(e.target.value); setFormIds([]); }}
              disabled={!!initial}
              className="input"
            >
              <option value="">— Select application —</option>
              {appsWithForms.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Form checkboxes */}
          {selectedApp && (
            <div>
              <label className="label">
                Forms Access
                <span className="ml-1 font-normal text-gray-400">(leave all unchecked = access to all forms)</span>
              </label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {selectedApp.forms.map((f) => (
                  <label key={f._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIds.includes(f._id)}
                      onChange={() => toggleForm(f._id)}
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-400">{f.formKey}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save Mapping'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ───────────────────────────────────────────────
const FormMapping = () => {
  const [mappings, setMappings]         = useState([]);
  const [users, setUsers]               = useState([]);
  const [appsWithForms, setAppsWithForms] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, uRes, aRes] = await Promise.all([
        api.get('/admin/mappings'),
        api.get('/admin/users'),
        api.get('/admin/apps-all'),
      ]);
      setMappings(mRes.data);
      setUsers(uRes.data);
      setAppsWithForms(aRes.data);
    } catch { toast.error('Failed to load data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this mapping?')) return;
    try {
      await api.delete(`/admin/mappings/${id}`);
      toast.success('Mapping removed.');
      fetchAll();
    } catch { toast.error('Delete failed.'); }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <MdGridView className="h-6 w-6 text-blue-600" />
          <h1 className="page-title">Form Access Mapping</h1>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary">
          <MdAdd className="h-4 w-4" />
          New Mapping
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Control which employees can access which applications and forms.
        An empty "Forms" cell means the employee can access <em>all</em> forms in that app.
      </p>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="th">Employee</th>
                <th className="th">Application</th>
                <th className="th">Allowed Forms</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td text-center text-gray-400 py-10">No mappings yet.</td>
                </tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m._id} className="hover:bg-gray-50">
                    <td className="td">
                      <p className="font-medium text-gray-900">{m.user?.name}</p>
                      <p className="text-xs text-gray-400">{m.user?.email}</p>
                    </td>
                    <td className="td font-medium">{m.app?.name}</td>
                    <td className="td">
                      {m.forms?.length === 0 ? (
                        <span className="badge bg-green-50 text-green-700">All Forms</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {m.forms.map((f) => (
                            <span key={f._id} className="badge bg-blue-50 text-blue-700">{f.name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="td text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setModal(m)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Edit">
                          <MdGridView className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(m._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                          <MdDelete className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <MappingModal
          users={users}
          appsWithForms={appsWithForms}
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchAll(); }}
        />
      )}
    </main>
  );
};

export default FormMapping;
