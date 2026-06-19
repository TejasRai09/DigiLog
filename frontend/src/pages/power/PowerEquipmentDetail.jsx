import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import { buildPowerEquipmentTrail, buildPowerPlantEquipmentNewTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import EquipmentLifeHistoryCard from '../../components/equipment/EquipmentLifeHistoryCard';
import EquipmentSpecificationHub from '../../components/equipment/EquipmentSpecificationHub';
import OemMaintenanceScheduleHub from '../../components/equipment/OemMaintenanceScheduleHub';
import EquipmentMaintenanceHistoryHub from '../../components/equipment/EquipmentMaintenanceHistoryHub';
import { serializeSpecsForApi } from '../../utils/equipmentSpecModel';
import { serializeScheduleForApi } from '../../utils/equipmentScheduleModel';
import { historyRecordToApi } from '../../utils/equipmentHistoryModel';
import { POWER_LIFE_HISTORY_FIELDS, powerEquipmentDisplayId, isZilEquipNo } from '../../config/powerEquipmentFields';

const HIST_FETCH_LIMIT = 200;

const PowerEquipmentDetail = () => {
  const { id, dept } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNewHub = location.pathname.startsWith('/power-plant-equipment-new');
  const apiBase = isNewHub ? '/power-new' : '/power';
  const defaultDept = isNewHub ? 'plant' : 'electrical';
  const appId = location.state?.appId;
  const fromHierarchy = Boolean(location.state?.fromHierarchy);
  const showNewHubTrail = fromHierarchy || isNewHub;
  const draftEquipment = location.state?.draftEquipment;
  const returnTo = location.state?.returnTo || '/power-plant-equipment-new';
  const appName = useAppName(appId);
  const isNewDraft = id === 'new';

  const [eq,        setEq]        = useState(null);
  const [specs,     setSpecs]     = useState([]);
  const [schedule,  setSchedule]  = useState([]);
  const [history,   setHistory]   = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const equipIdRef = useRef(id);
  const createPromiseRef = useRef(null);
  useEffect(() => {
    equipIdRef.current = id;
    if (id !== 'new') createPromiseRef.current = null;
  }, [id]);

  const resolveEquipmentId = useCallback(async () => {
    if (equipIdRef.current !== 'new') return equipIdRef.current;

    if (!createPromiseRef.current) {
      createPromiseRef.current = (async () => {
        const draft = draftEquipment || {};
        const { data } = await api.post(apiBase, {
          name: (eq?.name || draft.name || 'Unnamed equipment').trim(),
          equip_no: eq?.equip_no || draft.equip_no || null,
          tag_name: eq?.tag_name || draft.tag_name || null,
          category: eq?.category || draft.category || null,
          subcategory: eq?.subcategory || draft.subcategory || null,
          dept: dept || defaultDept,
        });
        const created = data.equipment;
        const newId = String(created.id);
        equipIdRef.current = newId;
        setEq(created);
        const detailPath = isNewHub
          ? `/power-plant-equipment-new/${newId}`
          : `/power/${created.dept}/${newId}`;
        navigate(detailPath, {
          replace: true,
          state: {
            appId,
            returnTo,
            fromHierarchy,
          },
        });
        return newId;
      })();
    }
    return createPromiseRef.current;
  }, [draftEquipment, eq?.name, eq?.equip_no, dept, navigate, appId, returnTo, fromHierarchy, apiBase, defaultDept, isNewHub]);

  const [open, setOpen] = useState({ spec: false, oem: false, hist: false });
  const toggle = (s) => setOpen(o => ({ ...o, [s]: !o[s] }));

  const loadHistory = async (equipId) => {
    const eid = equipId ?? equipIdRef.current;
    if (eid === 'new') return;
    try {
      const { data } = await api.get(`${apiBase}/${eid}/history`, {
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
      const { data } = await api.get(`${apiBase}/${id}`);
      setEq(data.equipment);
      setSpecs(data.specs);
      setSchedule(data.schedule);
      setHistory(data.history);
      setHistTotal(data.histTotal);
      if (data.histTotal > data.history?.length) {
        await loadHistory(id);
      }
    } catch {
      toast.error('Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isNewDraft) {
      if (!draftEquipment) {
        setEq(null);
        setLoading(false);
        return;
      }
      setEq({
        equip_no: draftEquipment.equip_no || '',
        tag_name: draftEquipment.tag_name || '',
        category: draftEquipment.category || '',
        subcategory: draftEquipment.subcategory || '',
        name: draftEquipment.name || '',
        location: '',
        commissioned: '',
        drive: '',
        dept: dept || defaultDept,
        photo: null,
        plate: null,
      });
      setSpecs([]);
      setSchedule([]);
      setHistory([]);
      setHistTotal(0);
      setLoading(false);
      return;
    }
    load();
  }, [id, isNewDraft, draftEquipment, dept]);

  const saveLifeHistory = async ({ fields, images = {} }) => {
    setSaving(true);
    try {
      const equipId = await resolveEquipmentId();
      await api.put(`${apiBase}/${equipId}`, fields);
      const imageUpdates = {};
      for (const type of ['photo', 'plate']) {
        if (!Object.prototype.hasOwnProperty.call(images, type)) continue;
        const data = images[type];
        if (data === null) {
          await api.delete(`${apiBase}/${equipId}/image/${type}`);
          imageUpdates[type] = null;
        } else {
          await api.put(`${apiBase}/${equipId}/image/${type}`, { data });
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

  const saveHubSpecs = async (structuredSpecs, subSections) => {
    setSaving(true);
    try {
      const equipId = await resolveEquipmentId();
      const payload = serializeSpecsForApi(structuredSpecs, subSections);
      await api.put(`${apiBase}/${equipId}/specs`, { specs: payload });
      const { data } = await api.get(`${apiBase}/${equipId}`);
      setSpecs(data.specs);
      toast.success('Specifications saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const saveHubSchedule = async (structuredSchedule) => {
    setSaving(true);
    try {
      const equipId = await resolveEquipmentId();
      const payload = serializeScheduleForApi(structuredSchedule);
      await api.put(`${apiBase}/${equipId}/schedule`, { schedule: payload });
      const { data } = await api.get(`${apiBase}/${equipId}`);
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
      const equipId = await resolveEquipmentId();
      const body = historyRecordToApi(form);
      if (mode === 'add') {
        await api.post(`${apiBase}/${equipId}/history`, body);
        toast.success('Record added.');
      } else {
        await api.put(`${apiBase}/${equipId}/history/${recordId}`, body);
        toast.success('Record updated.');
      }
      await loadHistory(equipId);
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
      const equipId = await resolveEquipmentId();
      await api.delete(`${apiBase}/${equipId}/history/${hid}`);
      toast.success('Record deleted.');
      await loadHistory(equipId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!eq)     return <p className="text-center py-20 text-gray-400">Equipment not found.</p>;

  const DEPT_LABELS = { electrical: 'Electrical', instrument: 'Instrument', instrument2: 'Instrument II', plant: 'Power Plant' };
  const deptLabel = DEPT_LABELS[eq?.dept || dept] || eq?.dept || dept;

  return (
    <main className="app-main">
      <AppBreadcrumb
        items={
          showNewHubTrail
            ? [
                ...buildPowerPlantEquipmentNewTrail({ appId, appName }).map((item, i, arr) => (
                  i === arr.length - 1 && item.label
                    ? { ...item, to: returnTo, state: location.state }
                    : item
                )),
                { label: eq?.name || 'Equipment' },
              ]
            : buildPowerEquipmentTrail({
                appId,
                appName,
                dept,
                equipmentName: eq?.name,
              })
        }
      />

      <div className="mb-6">
        <p className="text-sm text-gray-500 font-mono">
          {powerEquipmentDisplayId(eq)} · Power Plant{deptLabel ? ` · ${deptLabel}` : ''}
          {eq?.category ? ` · ${eq.category}` : ''}
          {eq?.subcategory ? ` / ${eq.subcategory}` : ''}
          {isNewDraft && (
            <span className="ml-2 text-amber-600 font-sans font-medium">New — save to create record</span>
          )}
        </p>
      </div>

      <EquipmentLifeHistoryCard
        equipment={eq}
        saving={saving}
        onSave={saveLifeHistory}
        fields={POWER_LIFE_HISTORY_FIELDS}
      />

      {/* ── Section 2: Specifications (structured hub) ── */}
      <div className="mb-3">
        <EquipmentSpecificationHub
          embedded
          equipmentTag={eq?.tag_name || eq?.equip_no || ''}
          apiSpecs={specs}
          onSave={saveHubSpecs}
          saving={saving}
          hideBulkActions={showNewHubTrail}
        />
      </div>

      {/* ── Section 3: OEM Schedule (structured hub) ── */}
      <div className="mb-3">
        <OemMaintenanceScheduleHub
          embedded
          apiSchedule={schedule}
          onSave={saveHubSchedule}
          saving={saving}
          hideBulkActions={showNewHubTrail}
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

export default PowerEquipmentDetail;
