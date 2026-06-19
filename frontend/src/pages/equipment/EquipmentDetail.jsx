import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  MdSave, MdEdit, MdDelete, MdAdd, MdClose,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import { buildEquipmentDetailTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import EquipmentLifeHistoryCard from '../../components/equipment/EquipmentLifeHistoryCard';
import EquipmentSectionShell from '../../components/equipment/EquipmentSectionShell';
import OemMaintenanceScheduleHub from '../../components/equipment/OemMaintenanceScheduleHub';
import EquipmentMaintenanceHistoryHub from '../../components/equipment/EquipmentMaintenanceHistoryHub';
import { serializeScheduleForApi } from '../../utils/equipmentScheduleModel';
import { historyRecordToApi } from '../../utils/equipmentHistoryModel';

const HIST_FETCH_LIMIT = 200;

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
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [open, setOpen] = useState({ spec: false, oem: false, hist: false });
  const toggle = (s) => setOpen(o => ({ ...o, [s]: !o[s] }));

  const [editSpecs, setEditSpecs] = useState(false);

  const [specsForm, setSpecsForm] = useState([]);

  const loadHistory = async () => {
    try {
      const { data } = await api.get(`/equipment/${id}/history`, {
        params: { page: 1, limit: HIST_FETCH_LIMIT },
      });
      setHistory(data.records);
      setHistTotal(data.total);
    } catch {
      toast.error('Failed to load history.');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/equipment/${id}`);
      setEq(data.equipment);
      setSpecs(data.specs);
      setSchedule(data.schedule);
      setHistory(data.history);
      setHistTotal(data.histTotal);
      if (data.histTotal > data.history?.length) {
        await loadHistory();
      }
    } catch {
      toast.error('Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveLifeHistory = async ({ fields, images = {} }) => {
    setSaving(true);
    try {
      await api.put(`/equipment/${id}`, fields);
      const imageUpdates = {};
      for (const type of ['photo', 'plate']) {
        if (!Object.prototype.hasOwnProperty.call(images, type)) continue;
        const data = images[type];
        if (data === null) {
          await api.delete(`/equipment/${id}/image/${type}`);
          imageUpdates[type] = null;
        } else {
          await api.put(`/equipment/${id}/image/${type}`, { data });
          imageUpdates[type] = data;
        }
      }
      setEq((e) => ({ ...e, ...fields, ...imageUpdates }));
      toast.success('Equipment history details updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
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

  const saveMaintenanceRecord = async (form, mode, recordId) => {
    setSaving(true);
    try {
      const body = historyRecordToApi(form);
      if (mode === 'add') {
        await api.post(`/equipment/${id}/history`, body);
        toast.success('Record added.');
      } else {
        await api.put(`/equipment/${id}/history/${recordId}`, body);
        toast.success('Record updated.');
      }
      await loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const deleteMaintenanceRecord = async (hid) => {
    setSaving(true);
    try {
      await api.delete(`/equipment/${id}/history/${hid}`);
      toast.success('Record deleted.');
      await loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!eq)     return <p className="text-center py-20 text-gray-400">Equipment not found.</p>;

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

      <EquipmentMaintenanceHistoryHub
        embedded
        apiRecords={history}
        totalCount={histTotal}
        saving={saving}
        open={open.hist}
        onToggle={() => toggle('hist')}
        onSave={saveMaintenanceRecord}
        onDelete={deleteMaintenanceRecord}
      />
    </main>
  );
};

export default EquipmentDetail;
