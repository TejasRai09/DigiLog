import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  MdSave, MdEdit, MdDelete, MdAdd, MdClose,
  MdCameraAlt,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import FormReviewModal from '../../components/FormReviewModal';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import { buildEquipmentHistoryReview } from '../../config/gsmaFormReviewBuilders';
import { buildEquipmentDetailTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import EquipmentLifeHistoryCard from '../../components/equipment/EquipmentLifeHistoryCard';
import EquipmentSectionShell from '../../components/equipment/EquipmentSectionShell';
import OemMaintenanceScheduleHub from '../../components/equipment/OemMaintenanceScheduleHub';
import { serializeScheduleForApi } from '../../utils/equipmentScheduleModel';
import { resizeImage } from '../../utils/resizeImage';

const EMPTY_HIST = {
  season: '', year: '', date_start: '', date_finish: '',
  obs: '', act: '', cost: '', svc: '', resp: '', rem: '',
  img_before: null, img_after: null,
};


const HistImgZone = ({ label, value, onChange }) => (
  <div className="flex-1">
    <span className="text-xs font-semibold text-gray-600 mb-1 block">{label}</span>
    {value ? (
      <div className="relative group rounded-lg overflow-hidden border border-gray-200 h-28 bg-gray-50">
        <img src={value} alt={label} className="w-full h-full object-contain" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
        >
          <MdClose className="h-3 w-3" />
        </button>
      </div>
    ) : (
      <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
        <MdCameraAlt className="h-6 w-6 text-gray-400 mb-0.5" />
        <span className="text-xs text-gray-400">Click to upload</span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (file) onChange(await resizeImage(file));
          }}
        />
      </label>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
const HIST_LIMIT = 20;

const EquipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);

  const [eq,        setEq]        = useState(null);
  const [specs,     setSpecs]     = useState([]);
  const [schedule,  setSchedule]  = useState([]);
  const [history,   setHistory]   = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage,  setHistPage]  = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [open, setOpen] = useState({ spec: false, oem: false, hist: false });
  const toggle = (s) => setOpen(o => ({ ...o, [s]: !o[s] }));

  const [editSpecs, setEditSpecs] = useState(false);

  const [specsForm, setSpecsForm] = useState([]);

  const [histModal, setHistModal] = useState(null); // null | { mode, data }
  const [histReviewOpen, setHistReviewOpen] = useState(false);
  const [histConfirming, setHistConfirming] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/equipment/${id}`);
      setEq(data.equipment);
      setSpecs(data.specs);
      setSchedule(data.schedule);
      setHistory(data.history);
      setHistTotal(data.histTotal);
    } catch {
      toast.error('Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (pg) => {
    try {
      const { data } = await api.get(`/equipment/${id}/history`, {
        params: { page: pg, limit: HIST_LIMIT },
      });
      setHistory(data.records);
      setHistTotal(data.total);
      setHistPage(pg);
    } catch {
      toast.error('Failed to load history.');
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveLifeHistory = async (fields) => {
    setSaving(true);
    try {
      await api.put(`/equipment/${id}`, fields);
      setEq((e) => ({ ...e, ...fields }));
      toast.success('Equipment history details updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ── Images ──────────────────────────────────────────────────
  const uploadImg = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true);
    try {
      const b64 = await resizeImage(file);
      await api.put(`/equipment/${id}/image/${type}`, { data: b64 });
      setEq(eq => ({ ...eq, [type]: b64 }));
      toast.success('Image uploaded.');
    } catch {
      toast.error('Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeImg = async (type) => {
    if (!confirm('Remove this image?')) return;
    setSaving(true);
    try {
      await api.delete(`/equipment/${id}/image/${type}`);
      setEq(eq => ({ ...eq, [type]: null }));
      toast.success('Image removed.');
    } catch {
      toast.error('Remove failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Specs edit ──────────────────────────────────────────────
  const startEditSpecs = () => {
    setSpecsForm(specs.map(s => ({ ...s })));
    setEditSpecs(true);
  };

  const saveSpecs = async () => {
    setSaving(true);
    try {
      await api.put(`/equipment/${id}/specs`, { specs: specsForm });
      const { data } = await api.get(`/equipment/${id}`);
      setSpecs(data.specs);
      setEditSpecs(false);
      toast.success('Specifications saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateSpecRow = (i, key, val) =>
    setSpecsForm(f => f.map((x, j) => j === i ? { ...x, [key]: val } : x));

  const saveHubSchedule = async (structuredSchedule) => {
    setSaving(true);
    try {
      const payload = serializeScheduleForApi(structuredSchedule);
      await api.put(`/equipment/${id}/schedule`, { schedule: payload });
      const { data } = await api.get(`/equipment/${id}`);
      setSchedule(data.schedule);
      toast.success('OEM schedule saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ── History ─────────────────────────────────────────────────
  const openAddHist  = () => setHistModal({ mode: 'add', data: { ...EMPTY_HIST } });
  const openEditHist = (rec) => setHistModal({
    mode: 'edit',
    data: {
      ...rec,
      date_start:  rec.date_start  ? String(rec.date_start).slice(0, 10)  : '',
      date_finish: rec.date_finish ? String(rec.date_finish).slice(0, 10) : '',
    },
  });

  const setHistField = (key, val) =>
    setHistModal(m => ({ ...m, data: { ...m.data, [key]: val } }));

  const requestSaveHist = () => {
    if (!histModal?.data.obs?.trim()) {
      toast.error('Observation is required.');
      return;
    }
    setHistReviewOpen(true);
  };

  const closeHistReview = () => {
    if (!histConfirming) setHistReviewOpen(false);
  };

  const confirmSaveHist = async () => {
    const { mode, data } = histModal;
    setHistConfirming(true);
    setSaving(true);
    try {
      if (mode === 'add') {
        await api.post(`/equipment/${id}/history`, data);
        toast.success('Record added.');
      } else {
        await api.put(`/equipment/${id}/history/${data.id}`, data);
        toast.success('Record updated.');
      }
      setHistReviewOpen(false);
      setHistModal(null);
      await loadHistory(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setHistConfirming(false);
      setSaving(false);
    }
  };

  const histReviewConfig = useMemo(() => {
    if (!histReviewOpen || !histModal) return null;
    return buildEquipmentHistoryReview(histModal.data, {
      mode: histModal.mode,
      equipmentName: eq?.name,
      equipNo: eq?.equip_no,
    });
  }, [histReviewOpen, histModal, eq?.name, eq?.equip_no]);

  const deleteHist = async (hid) => {
    if (!confirm('Delete this history record?')) return;
    setSaving(true);
    try {
      await api.delete(`/equipment/${id}/history/${hid}`);
      toast.success('Record deleted.');
      await loadHistory(histPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!eq)     return <p className="text-center py-20 text-gray-400">Equipment not found.</p>;

  const histPages = Math.ceil(histTotal / HIST_LIMIT);

  return (
    <main className="app-main">
      {/* Header */}
      <AppBreadcrumb
        items={buildEquipmentDetailTrail({
          appId,
          appName,
          equipmentName: eq?.name,
        })}
      />

      <div className="mb-6">
        <p className="text-sm text-gray-500 font-mono">{eq.equip_no} · {eq.plant}</p>
      </div>

      <EquipmentLifeHistoryCard
        equipment={eq}
        saving={saving}
        onSave={saveLifeHistory}
        onUploadImage={uploadImg}
        onRemoveImage={removeImg}
      />

      {/* ── Section 2: Specifications ── */}
      <EquipmentSectionShell
        title="Equipment Specification"
        badge={specs.length}
        open={open.spec}
        onToggle={() => toggle('spec')}
      >
        <div className="p-5">
          {editSpecs ? (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto pr-1">
                {specsForm.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="input"
                      placeholder="Label"
                      value={s.lbl}
                      onChange={(e) => updateSpecRow(i, 'lbl', e.target.value)}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="Value"
                      value={s.val}
                      onChange={(e) => updateSpecRow(i, 'val', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setSpecsForm(f => f.filter((_, j) => j !== i))}
                      className="btn-danger shrink-0 px-2 py-2"
                    >
                      <MdDelete className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSpecsForm(f => [...f, { lbl: '', val: '' }])}
                  className="btn-secondary"
                >
                  <MdAdd className="h-4 w-4" /> Add Row
                </button>
                <button onClick={saveSpecs} disabled={saving} className="btn-primary">
                  {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />} Save
                </button>
                <button onClick={() => setEditSpecs(false)} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              {specs.length === 0 ? (
                <p className="text-sm text-gray-400 mb-4">No specifications recorded.</p>
              ) : (
                <div className="table-wrapper mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="th w-1/2">Specification</th>
                        <th className="th w-1/2">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {specs.map((s) => (
                        <tr key={s.id}>
                          <td className="td font-medium text-gray-700">{s.lbl}</td>
                          <td className="td text-gray-600">{s.val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={startEditSpecs} className="btn-secondary">
                <MdEdit className="h-4 w-4" /> Edit Specifications
              </button>
            </>
          )}
        </div>
      </EquipmentSectionShell>

      {/* ── Section 3: OEM Schedule (structured hub) ── */}
      <div className="mb-3">
        <OemMaintenanceScheduleHub
          embedded
          apiSchedule={schedule}
          onSave={saveHubSchedule}
          saving={saving}
        />
      </div>

      {/* ── Section 4: Maintenance History ── */}
      <EquipmentSectionShell
        title="Equipment Maintenance History"
        badge={histTotal}
        open={open.hist}
        onToggle={() => toggle('hist')}
      >
        <div className="p-5">
          <div className="flex justify-end mb-4">
            <button onClick={openAddHist} className="btn-primary">
              <MdAdd className="h-4 w-4" /> Add Record
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-gray-400">No history records.</p>
          ) : (
            <div className="table-wrapper">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Season</th>
                    <th className="th">Year</th>
                    <th className="th">Start</th>
                    <th className="th">Finish</th>
                    <th className="th">Observation</th>
                    <th className="th">Action</th>
                    <th className="th">Cost</th>
                    <th className="th">Service</th>
                    <th className="th">Responsible</th>
                    <th className="th w-10 text-center">Pics</th>
                    <th className="th w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="td">
                        <span className={`badge ${
                          h.season === 'Season'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {h.season || '—'}
                        </span>
                      </td>
                      <td className="td text-gray-500">{h.year || '—'}</td>
                      <td className="td text-gray-500 whitespace-nowrap">
                        {h.date_start ? String(h.date_start).slice(0, 10) : '—'}
                      </td>
                      <td className="td text-gray-500 whitespace-nowrap">
                        {h.date_finish ? String(h.date_finish).slice(0, 10) : '—'}
                      </td>
                      <td className="td max-w-xs">
                        <p className="truncate" title={h.obs}>{h.obs || '—'}</p>
                      </td>
                      <td className="td max-w-xs">
                        <p className="truncate" title={h.act}>{h.act || '—'}</p>
                      </td>
                      <td className="td text-gray-500 whitespace-nowrap">{h.cost || '—'}</td>
                      <td className="td">
                        {h.svc
                          ? <span className="badge bg-blue-100 text-blue-700">{h.svc}</span>
                          : '—'}
                      </td>
                      <td className="td text-gray-500 max-w-xs">
                        <p className="truncate">{h.resp || '—'}</p>
                      </td>
                      <td className="td text-center">
                        {(h.img_before || h.img_after) && (
                          <MdCameraAlt
                            className="h-4 w-4 text-blue-500 inline"
                            title="Has service photos — click Edit to view"
                          />
                        )}
                      </td>
                      <td className="td">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditHist(h)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="Edit"
                          >
                            <MdEdit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteHist(h.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete"
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

          {histPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                Page {histPage} of {histPages} &nbsp;({histTotal} total)
              </span>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={histPage <= 1}
                  onClick={() => loadHistory(histPage - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  disabled={histPage >= histPages}
                  onClick={() => loadHistory(histPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </EquipmentSectionShell>

      {/* ── History Modal ── */}
      {histModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setHistReviewOpen(false);
              setHistModal(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {histModal.mode === 'add' ? 'Add History Record' : 'Edit History Record'}
              </h2>
              <button
                onClick={() => { setHistReviewOpen(false); setHistModal(null); }}
                className="text-gray-400 hover:text-gray-700"
              >
                <MdClose className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Season</label>
                  <select
                    className="input"
                    value={histModal.data.season}
                    onChange={(e) => setHistField('season', e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="Season">In Season</option>
                    <option value="OFF Season">Off Season</option>
                  </select>
                </div>
                <div>
                  <label className="label">Year</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="2024"
                    value={histModal.data.year}
                    onChange={(e) => setHistField('year', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Date of Start</label>
                  <input
                    type="date"
                    className="input"
                    value={histModal.data.date_start}
                    onChange={(e) => setHistField('date_start', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Date of Finish</label>
                  <input
                    type="date"
                    className="input"
                    value={histModal.data.date_finish}
                    onChange={(e) => setHistField('date_finish', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Outage / Observation *</label>
                <textarea
                  rows={3}
                  className="input resize-none"
                  value={histModal.data.obs}
                  onChange={(e) => setHistField('obs', e.target.value)}
                />
              </div>

              <div>
                <label className="label">Action Taken</label>
                <textarea
                  rows={3}
                  className="input resize-none"
                  value={histModal.data.act}
                  onChange={(e) => setHistField('act', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Repair Cost (Rs.)</label>
                  <input
                    type="text"
                    className="input"
                    value={histModal.data.cost}
                    onChange={(e) => setHistField('cost', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Service</label>
                  <select
                    className="input"
                    value={histModal.data.svc}
                    onChange={(e) => setHistField('svc', e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="EXTERNAL">EXTERNAL</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>
                <div>
                  <label className="label">Responsible</label>
                  <input
                    type="text"
                    className="input"
                    value={histModal.data.resp}
                    onChange={(e) => setHistField('resp', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Remarks</label>
                <textarea
                  rows={2}
                  className="input resize-none"
                  value={histModal.data.rem}
                  onChange={(e) => setHistField('rem', e.target.value)}
                />
              </div>

              <div>
                <label className="label">Service Photos</label>
                <div className="flex gap-4">
                  <HistImgZone
                    label="Before Service"
                    value={histModal.data.img_before}
                    onChange={(v) => setHistField('img_before', v)}
                  />
                  <HistImgZone
                    label="After Service"
                    value={histModal.data.img_after}
                    onChange={(v) => setHistField('img_after', v)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => { setHistReviewOpen(false); setHistModal(null); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={requestSaveHist} disabled={saving || histConfirming} className="btn-primary">
                {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
                {histModal.mode === 'add' ? 'Add Record' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {histReviewConfig ? (
        <FormReviewModal
          open={histReviewOpen}
          onClose={closeHistReview}
          onConfirm={confirmSaveHist}
          confirming={histConfirming}
          {...histReviewConfig}
        />
      ) : null}
    </main>
  );
};

export default EquipmentDetail;
