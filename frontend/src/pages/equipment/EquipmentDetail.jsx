import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MdArrowBack, MdSave, MdEdit, MdDelete, MdAdd, MdClose,
  MdExpandMore, MdExpandLess, MdCameraAlt, MdBadge,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';

// ── Resize image to max 900px JPEG 75% ───────────────────────
const resizeImage = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > 900 || h > 900) {
          if (w > h) { h = Math.round(h * 900 / w); w = 900; }
          else       { w = Math.round(w * 900 / h); h = 900; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

const EMPTY_HIST = {
  season: 'Season', year: '', date_start: '', date_finish: '',
  obs: '', act: '', cost: '', svc: '', provider: '', resp: '', rem: '',
};

const IV_LABELS = {
  iv_W: 'Weekly', iv_M: 'Monthly', iv_Q: 'Quarterly',
  iv_H: 'Half-Yearly', iv_Y: 'Yearly', iv_T: '2-Years',
};
const IV_KEYS = Object.keys(IV_LABELS);

// ── Accordion section ─────────────────────────────────────────
const Section = ({ title, open, onToggle, badge, children }) => (
  <div className="card mb-3 overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-800">{title}</span>
        {badge != null && (
          <span className="badge bg-blue-100 text-blue-700">{badge}</span>
        )}
      </div>
      {open
        ? <MdExpandLess className="h-5 w-5 text-gray-400" />
        : <MdExpandMore className="h-5 w-5 text-gray-400" />}
    </button>
    {open && <div className="border-t border-gray-100">{children}</div>}
  </div>
);

// ── Image upload zone ─────────────────────────────────────────
const ImageZone = ({ src, label, Icon, onUpload, onRemove, saving }) => (
  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
    {src ? (
      <div className="relative group rounded-lg overflow-hidden border border-gray-200 h-44 bg-gray-50">
        <img src={src} alt={label} className="w-full h-full object-contain" />
        <button
          onClick={onRemove}
          disabled={saving}
          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        >
          <MdClose className="h-3 w-3" />
        </button>
      </div>
    ) : (
      <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
        <Icon className="h-8 w-8 text-gray-400 mb-1" />
        <span className="text-xs text-gray-500">Click to upload</span>
        <input type="file" accept="image/*" className="sr-only" onChange={onUpload} disabled={saving} />
      </label>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
const HIST_LIMIT = 20;

const EquipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [eq,        setEq]        = useState(null);
  const [specs,     setSpecs]     = useState([]);
  const [schedule,  setSchedule]  = useState([]);
  const [history,   setHistory]   = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage,  setHistPage]  = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [open, setOpen] = useState({ id: true, spec: false, oem: false, hist: false });
  const toggle = (s) => setOpen(o => ({ ...o, [s]: !o[s] }));

  const [editId,    setEditId]    = useState(false);
  const [editSpecs, setEditSpecs] = useState(false);
  const [editSched, setEditSched] = useState(false);

  const [idForm,    setIdForm]    = useState({});
  const [specsForm, setSpecsForm] = useState([]);
  const [schedForm, setSchedForm] = useState([]);

  const [histModal, setHistModal] = useState(null); // null | { mode, data }

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

  // ── ID Card edit ────────────────────────────────────────────
  const startEditId = () => {
    setIdForm({
      name: eq.name, equip_no: eq.equip_no,
      location: eq.location || '', commissioned: eq.commissioned || '',
      drive: eq.drive || '',
    });
    setEditId(true);
  };

  const saveId = async () => {
    setSaving(true);
    try {
      await api.put(`/equipment/${id}`, idForm);
      setEq(e => ({ ...e, ...idForm }));
      setEditId(false);
      toast.success('Equipment details saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
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

  // ── Schedule edit ───────────────────────────────────────────
  const startEditSched = () => {
    setSchedForm(schedule.map(s => ({ ...s })));
    setEditSched(true);
  };

  const saveSched = async () => {
    setSaving(true);
    try {
      await api.put(`/equipment/${id}/schedule`, { schedule: schedForm });
      const { data } = await api.get(`/equipment/${id}`);
      setSchedule(data.schedule);
      setEditSched(false);
      toast.success('Schedule saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateSchedRow = (i, key, val) =>
    setSchedForm(f => f.map((x, j) => j === i ? { ...x, [key]: val } : x));

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

  const saveHist = async () => {
    const { mode, data } = histModal;
    if (!data.obs?.trim()) { toast.error('Observation is required.'); return; }
    setSaving(true);
    try {
      if (mode === 'add') {
        await api.post(`/equipment/${id}/history`, data);
        toast.success('Record added.');
      } else {
        await api.put(`/equipment/${id}/history/${data.id}`, data);
        toast.success('Record updated.');
      }
      setHistModal(null);
      await loadHistory(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

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
  const usedIv    = IV_KEYS.filter(k => schedule.some(s => s[k] !== null));

  const ID_FIELDS = [
    { key: 'equip_no',     label: 'Equipment No.' },
    { key: 'name',         label: 'Name of Equipment' },
    { key: 'location',     label: 'Location' },
    { key: 'commissioned', label: 'Date of Commissioning' },
    { key: 'drive',        label: 'Drive' },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <button
        onClick={() => navigate('/equipment')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <MdArrowBack className="h-4 w-4" /> Back to Equipment List
      </button>

      <div className="mb-6">
        <h1 className="page-title">{eq.name}</h1>
        <p className="text-sm text-gray-500 mt-1 font-mono">{eq.equip_no} · {eq.plant}</p>
      </div>

      {/* ── Section 1: ID Card ── */}
      <Section title="Equipment Life History Card" open={open.id} onToggle={() => toggle('id')}>
        <div className="p-5">
          {/* Images */}
          <div className="flex gap-4 mb-6">
            <ImageZone
              src={eq.photo}
              label="Equipment Photo"
              Icon={MdCameraAlt}
              onUpload={(e) => uploadImg(e, 'photo')}
              onRemove={() => removeImg('photo')}
              saving={saving}
            />
            <ImageZone
              src={eq.plate}
              label="Nameplate / Tag"
              Icon={MdBadge}
              onUpload={(e) => uploadImg(e, 'plate')}
              onRemove={() => removeImg('plate')}
              saving={saving}
            />
          </div>

          {editId ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {ID_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      type="text"
                      className="input"
                      value={idForm[key] || ''}
                      onChange={(e) => setIdForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveId} disabled={saving} className="btn-primary">
                  {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />} Save
                </button>
                <button onClick={() => setEditId(false)} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {ID_FIELDS.map(({ key, label }) => (
                  <div key={key} className="bg-gray-50 rounded-lg px-4 py-3">
                    <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900">{eq[key] || '—'}</dd>
                  </div>
                ))}
              </dl>
              <button onClick={startEditId} className="btn-secondary">
                <MdEdit className="h-4 w-4" /> Edit Details
              </button>
            </>
          )}
        </div>
      </Section>

      {/* ── Section 2: Specifications ── */}
      <Section
        title="Equipment Specification"
        open={open.spec}
        onToggle={() => toggle('spec')}
        badge={specs.length}
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
      </Section>

      {/* ── Section 3: OEM Schedule ── */}
      <Section
        title="OEM Maintenance Schedule"
        open={open.oem}
        onToggle={() => toggle('oem')}
        badge={schedule.length}
      >
        <div className="p-5">
          {editSched ? (
            <>
              <div className="table-wrapper mb-4 max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th w-14">#</th>
                      <th className="th">Component</th>
                      <th className="th">Action</th>
                      {IV_KEYS.map(k => (
                        <th key={k} className="th w-14 text-center">{IV_LABELS[k].slice(0, 4)}</th>
                      ))}
                      <th className="th w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {schedForm.map((s, i) => (
                      <tr key={i}>
                        <td className="td">
                          <input
                            type="number"
                            className="input w-14 text-center px-1"
                            value={s.no}
                            onChange={(e) => updateSchedRow(i, 'no', +e.target.value)}
                          />
                        </td>
                        <td className="td">
                          <input
                            type="text"
                            className="input"
                            value={s.comp || ''}
                            onChange={(e) => updateSchedRow(i, 'comp', e.target.value)}
                          />
                        </td>
                        <td className="td">
                          <input
                            type="text"
                            className="input"
                            value={s.act || ''}
                            onChange={(e) => updateSchedRow(i, 'act', e.target.value)}
                          />
                        </td>
                        {IV_KEYS.map(k => (
                          <td key={k} className="td text-center">
                            <input
                              type="text"
                              maxLength={1}
                              className="input w-10 text-center px-1 font-mono"
                              value={s[k] || ''}
                              onChange={(e) => updateSchedRow(i, k, e.target.value || null)}
                            />
                          </td>
                        ))}
                        <td className="td">
                          <button
                            onClick={() => setSchedForm(f => f.filter((_, j) => j !== i))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <MdDelete className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSchedForm(f => [...f, { no: f.length + 1, comp: '', act: '' }])}
                  className="btn-secondary"
                >
                  <MdAdd className="h-4 w-4" /> Add Row
                </button>
                <button onClick={saveSched} disabled={saving} className="btn-primary">
                  {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />} Save
                </button>
                <button onClick={() => setEditSched(false)} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              {schedule.length === 0 ? (
                <p className="text-sm text-gray-400 mb-4">No OEM schedule recorded.</p>
              ) : (
                <div className="table-wrapper mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="th w-10">#</th>
                        <th className="th">Component</th>
                        <th className="th">Maintenance Action</th>
                        {usedIv.map(k => (
                          <th key={k} className="th w-28 text-center">{IV_LABELS[k]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {schedule.map((s) => (
                        <tr key={s.id}>
                          <td className="td text-gray-400">{s.no}</td>
                          <td className="td font-medium">{s.comp}</td>
                          <td className="td text-gray-600">{s.act}</td>
                          {usedIv.map(k => (
                            <td key={k} className="td text-center font-mono">
                              <span className={
                                s[k] === '√' ? 'text-green-600 font-bold' :
                                s[k] === 'X' ? 'text-gray-400' : ''
                              }>
                                {s[k] || '—'}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={startEditSched} className="btn-secondary">
                <MdEdit className="h-4 w-4" /> Edit Schedule
              </button>
            </>
          )}
        </div>
      </Section>

      {/* ── Section 4: Maintenance History ── */}
      <Section
        title="Equipment Maintenance History"
        open={open.hist}
        onToggle={() => toggle('hist')}
        badge={histTotal}
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
      </Section>

      {/* ── History Modal ── */}
      {histModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setHistModal(null)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {histModal.mode === 'add' ? 'Add History Record' : 'Edit History Record'}
              </h2>
              <button onClick={() => setHistModal(null)} className="text-gray-400 hover:text-gray-700">
                <MdClose className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Season *</label>
                  <select
                    className="input"
                    value={histModal.data.season}
                    onChange={(e) => setHistField('season', e.target.value)}
                  >
                    <option value="Season">Season</option>
                    <option value="OFF Season">OFF Season</option>
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
                  <label className="label">Provider</label>
                  <input
                    type="text"
                    className="input"
                    value={histModal.data.provider}
                    onChange={(e) => setHistField('provider', e.target.value)}
                  />
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
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setHistModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveHist} disabled={saving} className="btn-primary">
                {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
                {histModal.mode === 'add' ? 'Add Record' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default EquipmentDetail;
