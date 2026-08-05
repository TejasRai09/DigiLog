import { useEffect, useState } from 'react';
import { MdAdd, MdClose, MdDelete, MdEdit, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

export default function SeasonMappingSection() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const [formState, setFormState] = useState({ season_label: '', start_date: '', end_date: '' });
  const [editForm, setEditForm] = useState({ season_label: '', start_date: '', end_date: '' });

  const loadSeasons = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/season-mapping');
      setSeasons(data);
    } catch {
      toast.error('Failed to load season mappings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formState.season_label || !formState.start_date || !formState.end_date) return;
    setSaving(true);
    try {
      await api.post('/admin/season-mapping', formState);
      toast.success('Season mapping added.');
      setFormState({ season_label: '', start_date: '', end_date: '' });
      loadSeasons();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add season mapping.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setEditForm({
      season_label: s.season_label,
      start_date: s.start_date.split('T')[0],
      end_date: s.end_date.split('T')[0]
    });
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async (id) => {
    if (!editForm.season_label || !editForm.start_date || !editForm.end_date) return;
    try {
      await api.put(`/admin/season-mapping/${id}`, editForm);
      toast.success('Season updated.');
      setEditId(null);
      loadSeasons();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update season.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this season mapping?')) return;
    try {
      await api.delete(`/admin/season-mapping/${id}`);
      toast.success('Deleted successfully.');
      loadSeasons();
    } catch {
      toast.error('Could not delete season.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <ConfigSectionPanel
      title="Season Mapping"
      description="Manage business seasons and their exact start and end dates for BI filtering."
    >
      <div className="space-y-6">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Season Label (e.g. 2025-2026)"
            className="flex-1 input-field h-10"
            value={formState.season_label}
            onChange={(e) => setFormState({ ...formState, season_label: e.target.value })}
            required
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">From</span>
            <input
              type="date"
              className="input-field h-10"
              value={formState.start_date}
              onChange={(e) => setFormState({ ...formState, start_date: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">To</span>
            <input
              type="date"
              className="input-field h-10"
              value={formState.end_date}
              onChange={(e) => setFormState({ ...formState, end_date: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving || !formState.season_label || !formState.start_date || !formState.end_date}
            className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap h-10 px-5"
          >
            {saving ? <Spinner size="sm" /> : <MdAdd />} Add Season
          </button>
        </form>

        {loading ? (
          <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
        ) : seasons.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No season mappings defined.</div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Season Label</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Start Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">End Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {seasons.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    {editId === s.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.season_label}
                            onChange={(e) => setEditForm({ ...editForm, season_label: e.target.value })}
                            className="input-field py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editForm.start_date}
                            onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                            className="input-field py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editForm.end_date}
                            onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                            className="input-field py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => saveEdit(s.id)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                              <MdSave className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                              <MdClose className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">
                          {s.season_label}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {formatDate(s.start_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {formatDate(s.end_date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity [&:hover]:opacity-100" style={{ opacity: 1 }}>
                            <button onClick={() => startEdit(s)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                              <MdEdit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                              <MdDelete className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ConfigSectionPanel>
  );
}
