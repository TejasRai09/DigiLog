import { useEffect, useState } from 'react';
import { MdAdd, MdClose, MdDelete, MdEdit, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';
import { ESY_DATE_RULE, FY_DATE_RULE } from '../../../utils/biYearTypes';

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(`${String(dateString).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function FixedDateRuleCard({ startLabel, endLabel, note }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Start</span>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{startLabel}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">End</span>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{endLabel}</p>
        </div>
      </div>
      {note ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{note}</p>
      ) : null}
    </div>
  );
}

function Subsection({ title, description, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

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
      toast.success('Sugar season added.');
      setFormState({ season_label: '', start_date: '', end_date: '' });
      loadSeasons();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add sugar season.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setEditForm({
      season_label: s.season_label,
      start_date: s.start_date.split('T')[0],
      end_date: s.end_date.split('T')[0],
    });
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async (id) => {
    if (!editForm.season_label || !editForm.start_date || !editForm.end_date) return;
    try {
      await api.put(`/admin/season-mapping/${id}`, editForm);
      toast.success('Sugar season updated.');
      setEditId(null);
      loadSeasons();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update sugar season.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sugar season mapping?')) return;
    try {
      await api.delete(`/admin/season-mapping/${id}`);
      toast.success('Deleted successfully.');
      loadSeasons();
    } catch {
      toast.error('Could not delete sugar season.');
    }
  };

  return (
    <ConfigSectionPanel
      title="Season Mapping"
      description="Sugar Season labels are shared by Distillery SS, ESY, and FY compare chips. ESY and FY only change the fixed start/end month applied to those labels."
    >
      <div className="space-y-10">
        <Subsection
          title="Sugar Season (SS)"
          description="Campaign labels and dates. Compare options under SS / ESY / FY all use these labels."
        >
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
            <div className="text-center py-12 text-slate-500">No sugar season mappings defined.</div>
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
                              <button type="button" onClick={() => saveEdit(s.id)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                                <MdSave className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={cancelEdit} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
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
                            <div className="flex justify-end gap-1" style={{ opacity: 1 }}>
                              <button type="button" onClick={() => startEdit(s)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                                <MdEdit className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => handleDelete(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
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
        </Subsection>

        <Subsection
          title="Financial Year (FY)"
          description="Fixed dates only. Distillery FY compare chips reuse Sugar Season labels with these month bounds."
        >
          <FixedDateRuleCard
            startLabel={FY_DATE_RULE.startLabel}
            endLabel={FY_DATE_RULE.endLabel}
            note="Example: label 2024-2025 → 1 Apr 2024 – 31 Mar 2025."
          />
        </Subsection>

        <Subsection
          title="Ethanol Supplier Year (ESY)"
          description="Fixed dates only. Distillery ESY compare chips reuse Sugar Season labels with these month bounds."
        >
          <FixedDateRuleCard
            startLabel={ESY_DATE_RULE.startLabel}
            endLabel={ESY_DATE_RULE.endLabel}
            note="Example: label 2024-2025 → 1 Nov 2024 – 31 Oct 2025."
          />
        </Subsection>
      </div>
    </ConfigSectionPanel>
  );
}
