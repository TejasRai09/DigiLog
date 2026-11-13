import { useEffect, useState } from 'react';
import { MdAdd, MdDelete } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

export default function GateCenterCodesSection() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');

  const loadCodes = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/gate-center-codes');
      setCodes(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load gate center codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const next = code.trim();
    if (!next) return;
    setSaving(true);
    try {
      await api.post('/admin/gate-center-codes', { code: next });
      toast.success('Gate center code added. Existing indent and purchase rows were updated.');
      setCode('');
      loadCodes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add center code.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this center code from Gate? It will be treated as Center.')) return;
    try {
      await api.delete(`/admin/gate-center-codes/${id}`);
      toast.success('Removed. Existing indent and purchase rows were updated.');
      loadCodes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove center code.');
    }
  };

  return (
    <ConfigSectionPanel
      title="Gate Center Codes"
      description="Category is set only after you add gate codes here. Listed codes are stored as Gate. Every other center code is stored as Center. Until then, indent and purchase rows have no category. The Category column in the upload file is ignored."
    >
      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Center code (e.g. 1)"
          className="input-field h-10 flex-1"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={saving || !code.trim()}
          className="btn-primary flex h-10 items-center justify-center gap-2 whitespace-nowrap px-5"
        >
          {saving ? <Spinner size="sm" /> : <MdAdd />} Add Gate Code
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : codes.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          No gate codes yet. Overrun Gate and Overrun Center stay blank until you add at least one code.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Center code</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Category</th>
                <th className="w-24 px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {codes.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.code}</td>
                  <td className="px-4 py-3 text-right text-slate-500">Gate</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        aria-label={`Remove center code ${row.code}`}
                      >
                        <MdDelete className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ConfigSectionPanel>
  );
}
