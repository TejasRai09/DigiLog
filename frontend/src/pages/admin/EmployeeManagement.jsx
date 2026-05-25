import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MdAdd, MdEdit, MdDelete, MdSearch, MdPeople,
  MdClose, MdSave, MdEmail, MdSend, MdMoreVert, MdGridView, MdInsights, MdHome, MdUpload,
  MdSupervisorAccount,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import EmployeeFormMappingModal from '../../components/admin/EmployeeFormMappingModal';
import EmployeeHomepageMappingModal from '../../components/admin/EmployeeHomepageMappingModal';
import EmployeeDataUploadAccessModal from '../../components/admin/EmployeeDataUploadAccessModal';
import AssignManagerModal from '../../components/admin/AssignManagerModal';
import BiDashboardSettings from '../../components/admin/BiDashboardSettings';
import { BI_CONTROL_TOWER_APP_NAME } from '../../config/biDashboardRoutes';
import { homepageCardLabel } from '../../config/homepageCards';
import { withoutGsmaLabel } from '../../utils/displayLabels';

const ROLES = ['employee', 'admin'];

// ─── Modal ────────────────────────────────────────────────────
const UserModal = ({ initial, onClose, onSaved }) => {
  const isEdit = !!initial?._id;
  const [form, setForm]   = useState({
    name:       initial?.name       || '',
    email:      initial?.email      || '',
    department: initial?.department ?? '',
    role:       initial?.role       || 'employee',
    isActive:   initial?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/admin/users/${initial._id}`, form);
        toast.success('Employee updated.');
      } else {
        await api.post('/admin/users', form);
        toast.success('Employee created. Use "Send Mail" to send login credentials.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input name="name" value={form.name} onChange={handleChange} required className="input" placeholder="John Doe" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required disabled={isEdit} className="input" placeholder="john@company.com" />
          </div>
          <div>
            <label className="label">Department</label>
            <input name="department" value={form.department} onChange={handleChange} className="input" placeholder="e.g. Operations" />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" value={form.role} onChange={handleChange} className="input">
              {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="h-4 w-4 rounded text-blue-600" />
              <span className="text-sm text-gray-700">Account Active</span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main page ───────────────────────────────────────────────
const EmployeeManagement = () => {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null);
  const [selected, setSelected]   = useState(new Set());
  const [mailing, setMailing]     = useState(new Set());
  const [rowMenu, setRowMenu]     = useState(null);
  const [mappingModal, setMappingModal] = useState(null); // { user, variant: 'forms' | 'dashboards' }
  const [homepageModal, setHomepageModal] = useState(null);
  const [dataUploadModal, setDataUploadModal] = useState(null);
  const [managerModal, setManagerModal] = useState(null); // user object
  const [mappings, setMappings]   = useState([]);
  const [homepageAssignments, setHomepageAssignments] = useState([]);
  const [dataUploadAssignments, setDataUploadAssignments] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, mRes, hRes, dRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/mappings'),
        api.get('/admin/homepage-cards'),
        api.get('/admin/data-upload-access'),
      ]);
      setUsers(uRes.data);
      setMappings(mRes.data);
      setHomepageAssignments(hRes.data);
      setDataUploadAssignments(dRes.data.assignments || []);
    } catch {
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this employee?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('Employee deleted.');
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
      fetchData();
    } catch { toast.error('Delete failed.'); }
  };

  // ── Send mail (single) ───────────────────────────────────────
  const handleSendMail = async (user) => {
    setMailing((prev) => new Set(prev).add(user._id));
    try {
      await api.post(`/admin/users/${user._id}/send-mail`);
      toast.success(`Activation email sent to ${user.email}.`);
      setUsers((prev) => prev.map((u) => u._id === user._id ? { ...u, mailSent: true } : u));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email.');
    } finally {
      setMailing((prev) => { const s = new Set(prev); s.delete(user._id); return s; });
    }
  };

  // ── Send mail (bulk) ─────────────────────────────────────────
  const handleBulkSendMail = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    ids.forEach((id) => setMailing((prev) => new Set(prev).add(id)));
    try {
      const { data } = await api.post('/admin/users/send-mail-bulk', { userIds: ids });
      toast.success(data.message);
      const sentSet = new Set(data.sent);
      setUsers((prev) => prev.map((u) => sentSet.has(u._id) ? { ...u, mailSent: true } : u));
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk mail failed.');
    } finally {
      ids.forEach((id) => setMailing((prev) => { const s = new Set(prev); s.delete(id); return s; }));
    }
  };

  // ── Checkbox helpers ─────────────────────────────────────────
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.department && String(u.department).toLowerCase().includes(search.toLowerCase()))
  );

  const eligibleIds = filtered
    .filter((u) => u.authProvider === 'local' && !u.mailSent)
    .map((u) => u._id);

  const allChecked   = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
  const someChecked  = eligibleIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected((prev) => {
        const s = new Set(prev);
        eligibleIds.forEach((id) => s.delete(id));
        return s;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...eligibleIds]));
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const bulkEligible = [...selected].filter((id) => {
    const u = users.find((u) => u._id === id);
    return u && u.authProvider === 'local' && !u.mailSent;
  });

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <MdPeople className="h-6 w-6 text-blue-600" />
          <h1 className="page-title">Employee Management</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {bulkEligible.length > 0 && (
            <button
              onClick={handleBulkSendMail}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <MdSend className="h-4 w-4" />
              Send Mail ({bulkEligible.length})
            </button>
          )}
          <button onClick={() => setModal('add')} className="btn-primary">
            <MdAdd className="h-4 w-4" />
            Add Employee
          </button>
        </div>
      </div>

      <BiDashboardSettings />

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="th w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded text-blue-600"
                    title="Select all eligible"
                  />
                </th>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Department</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th min-w-[8rem]">Manager</th>
                <th className="th min-w-[6rem] whitespace-normal">Data upload</th>
                <th className="th text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="td text-center text-gray-400 py-10">No employees found.</td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const canMail    = u.authProvider === 'local';
                  const mailDone   = u.mailSent;
                  const isSelected = selected.has(u._id);

                  return (
                    <tr key={u._id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="td">
                        {canMail && !mailDone ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(u._id)}
                            className="h-4 w-4 rounded text-blue-600"
                          />
                        ) : (
                          <span className="block w-4" />
                        )}
                      </td>
                      <td className="td font-medium text-gray-900">{u.name}</td>
                      <td className="td text-gray-500">{u.email}</td>
                      <td className="td text-gray-600 max-w-[10rem] truncate" title={u.department || ''}>
                        {u.department || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="td">
                        <span className={`badge ${u.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'} capitalize`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="td">
                        <span className={`badge ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="td text-sm text-gray-700 max-w-[10rem] truncate" title={u.managerName || ''}>
                        {u.managerName
                          ? <span>{u.managerName}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="td align-top">
                        {u.role === 'employee' ? (
                          (() => {
                            const row = dataUploadAssignments.find((a) => String(a.user?._id) === String(u._id));
                            return row?.enabled ? (
                              <span className="badge bg-emerald-50 text-emerald-800">Yes</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            );
                          })()
                        ) : (
                          <span className="badge bg-purple-50 text-purple-700">Admin</span>
                        )}
                      </td>
                      <td className="td w-16">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const target = e.currentTarget;
                              const r = target.getBoundingClientRect();
                              setRowMenu((prev) => {
                                if (prev?.user._id === u._id) return null;
                                return {
                                  user: u,
                                  top: r.bottom + 4,
                                  right: window.innerWidth - r.right,
                                };
                              });
                            }}
                            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
                            title="Actions"
                            aria-label="Actions menu"
                          >
                            <MdMoreVert className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {rowMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              aria-hidden
              onClick={() => setRowMenu(null)}
            />
            <div
              className="fixed z-[60] min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              style={{ top: rowMenu.top, right: rowMenu.right }}
              role="menu"
            >
              {rowMenu.user.authProvider === 'local' && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={rowMenu.user.mailSent || mailing.has(rowMenu.user._id)}
                  onClick={() => {
                    const x = rowMenu.user;
                    setRowMenu(null);
                    if (!x.mailSent && !mailing.has(x._id)) handleSendMail(x);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mailing.has(rowMenu.user._id) ? <Spinner size="sm" /> : <MdEmail className="h-4 w-4 text-amber-600" />}
                  Send activation email
                </button>
              )}
              {rowMenu.user.role === 'employee' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const x = rowMenu.user;
                    setRowMenu(null);
                    setMappingModal({ user: x, variant: 'forms' });
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <MdGridView className="h-4 w-4 text-blue-600" />
                  Form mapping
                </button>
              )}
              {rowMenu.user.role === 'employee' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const x = rowMenu.user;
                    setRowMenu(null);
                    setMappingModal({ user: x, variant: 'dashboards' });
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <MdInsights className="h-4 w-4 text-violet-600" />
                  Dashboard mapping
                </button>
              )}
              {rowMenu.user.role === 'employee' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const x = rowMenu.user;
                    setRowMenu(null);
                    setHomepageModal(x);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <MdHome className="h-4 w-4 text-slate-600" />
                  Homepage cards
                </button>
              )}
              {rowMenu.user.role === 'employee' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const x = rowMenu.user;
                    setRowMenu(null);
                    setDataUploadModal(x);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <MdUpload className="h-4 w-4 text-emerald-600" />
                  Data upload access
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const x = rowMenu.user;
                  setRowMenu(null);
                  setManagerModal(x);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <MdSupervisorAccount className="h-4 w-4 text-indigo-600" />
                Assign manager
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const x = rowMenu.user;
                  setRowMenu(null);
                  setModal(x);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <MdEdit className="h-4 w-4 text-blue-600" />
                Edit employee
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const id = rowMenu.user._id;
                  setRowMenu(null);
                  handleDelete(id);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <MdDelete className="h-4 w-4" />
                Delete
              </button>
            </div>
          </>,
          document.body
        )}

      {homepageModal && (
        <EmployeeHomepageMappingModal
          key={`homepage-${homepageModal._id}`}
          user={homepageModal}
          homepageAssignments={homepageAssignments}
          onClose={() => setHomepageModal(null)}
          onSaved={() => {
            setHomepageModal(null);
            fetchData();
          }}
        />
      )}

      {dataUploadModal && (
        <EmployeeDataUploadAccessModal
          key={`data-upload-${dataUploadModal._id}`}
          user={dataUploadModal}
          assignments={dataUploadAssignments}
          onClose={() => setDataUploadModal(null)}
          onSaved={() => {
            setDataUploadModal(null);
            fetchData();
          }}
        />
      )}

      {mappingModal && (
        <EmployeeFormMappingModal
          key={`${mappingModal.user._id}-${mappingModal.variant}`}
          user={mappingModal.user}
          mappings={mappings}
          variant={mappingModal.variant}
          onClose={() => setMappingModal(null)}
          onSaved={() => {
            setMappingModal(null);
            fetchData();
          }}
        />
      )}

      {modal && (
        <UserModal
          initial={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchData(); }}
        />
      )}

      {managerModal && (
        <AssignManagerModal
          key={`manager-${managerModal._id}`}
          user={managerModal}
          allUsers={users}
          onClose={() => setManagerModal(null)}
          onSaved={() => { setManagerModal(null); fetchData(); }}
        />
      )}
    </main>
  );
};

export default EmployeeManagement;
