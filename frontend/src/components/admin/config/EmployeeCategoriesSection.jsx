import { useEffect, useState } from 'react';
import { MdAdd, MdClose, MdDelete, MdEdit, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

export default function EmployeeCategoriesSection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(data);
    } catch {
      toast.error('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await api.post('/admin/categories', { name });
      toast.success('Category added.');
      setNewName('');
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add category.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
  };

  const saveEdit = async (id) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await api.put(`/admin/categories/${id}`, { name });
      toast.success('Category updated.');
      cancelEdit();
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/admin/categories/${cat.id}`);
      toast.success('Category deleted.');
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete category.');
    }
  };

  return (
    <ConfigSectionPanel
      title="Employee categories"
      description="These options appear in the Department dropdown when creating or editing employees."
    >
      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label className="label">Add category</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input"
            placeholder="e.g. Operations"
            maxLength={255}
          />
        </div>
        <button type="submit" disabled={saving || !newName.trim()} className="btn-primary shrink-0">
          {saving ? <Spinner size="sm" /> : <MdAdd className="h-4 w-4" />}
          Add category
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          No categories yet. Add one above to show in the employee form.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 sm:px-6">Name</th>
                <th className="px-4 py-3 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 sm:px-6">
                    {editId === cat.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input max-w-md py-1.5"
                        maxLength={255}
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 sm:px-6">
                    <div className="flex justify-end gap-2">
                      {editId === cat.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(cat.id)}
                            disabled={saving}
                            className="btn-primary px-3 py-1.5 text-xs"
                          >
                            <MdSave className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            <MdClose className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="btn-secondary px-3 py-1.5 text-xs"
                            aria-label={`Edit ${cat.name}`}
                          >
                            <MdEdit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="btn-secondary px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            aria-label={`Delete ${cat.name}`}
                          >
                            <MdDelete className="h-4 w-4" />
                          </button>
                        </>
                      )}
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
