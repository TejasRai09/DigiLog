import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import { buildPowerEquipmentTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import EquipmentLifeHistoryCard from '../../components/equipment/EquipmentLifeHistoryCard';
import EquipmentSpecificationHub from '../../components/equipment/EquipmentSpecificationHub';
import OemMaintenanceScheduleHub from '../../components/equipment/OemMaintenanceScheduleHub';
import EquipmentMaintenanceHistoryHub from '../../components/equipment/EquipmentMaintenanceHistoryHub';
import { serializeSpecsForApi, buildEquipmentOptionsFromSpecs } from '../../utils/equipmentSpecModel';
import { serializeScheduleForApi } from '../../utils/equipmentScheduleModel';
import { historyRecordToApi, historyRecordMatchesSection } from '../../utils/equipmentHistoryModel';
import { POWER_LIFE_HISTORY_FIELDS, powerEquipmentDisplayId, isZilEquipNo } from '../../config/powerEquipmentFields';
import { findDiscipline } from '../../config/engineeringDisciplines';
import {
  POWER_PLANT_EQUIPMENT_TREE,
  hierarchyBreadcrumbLabels,
} from '../../config/powerPlantEquipmentHierarchy';

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
  const hierarchyPathIds = location.state?.hierarchyPathIds;
  const specSection = location.state?.specSection || null;
  const restoreEquipmentId = location.state?.restoreEquipmentId || null;
  const disciplineMeta = specSection ? findDiscipline(specSection) : null;
  const disciplineSpecFocus = isNewHub && Boolean(specSection && disciplineMeta);
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
            hierarchyPathIds,
            specSection,
            restoreEquipmentId,
          },
        });
        return newId;
      })();
    }
    return createPromiseRef.current;
  }, [draftEquipment, eq?.name, eq?.equip_no, dept, navigate, appId, returnTo, fromHierarchy, hierarchyPathIds, specSection, restoreEquipmentId, apiBase, defaultDept, isNewHub]);

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

  const saveHubSpecs = async (structuredSpecs, subSections, subGroupMeta) => {
    setSaving(true);
    try {
      const equipId = await resolveEquipmentId();
      const payload = serializeSpecsForApi(structuredSpecs, subSections, subGroupMeta);
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

  const deleteSubGroupMaintenanceHistory = async (section, subSection) => {
    if (!isNewHub) return;
    const equipId = await resolveEquipmentId();
    await api.delete(`${apiBase}/${equipId}/history-sub-group`, {
      data: { section, sub_section: subSection },
    });
    await loadHistory(equipId);
  };

  const renameSubGroupMaintenanceHistory = async (section, oldSubSection, newSubSection) => {
    if (!isNewHub || oldSubSection === newSubSection) return;
    const equipId = await resolveEquipmentId();
    await api.put(`${apiBase}/${equipId}/history-sub-group/rename`, {
      section,
      old_sub_section: oldSubSection,
      new_sub_section: newSubSection,
    });
    await loadHistory(equipId);
  };

  const breadcrumbItems = useMemo(() => {
    if (!showNewHubTrail) {
      return buildPowerEquipmentTrail({
        appId,
        appName,
        dept,
        equipmentName: eq?.name,
      });
    }

    const hubState = {
      appId: appId != null && appId !== '' ? String(appId) : undefined,
      hierarchyPathIds,
      restoreEquipmentId,
    };

    const equipmentForTrail = eq || draftEquipment || {};
    const { labels, pathIds } = hierarchyBreadcrumbLabels(
      POWER_PLANT_EQUIPMENT_TREE,
      equipmentForTrail,
      hierarchyPathIds,
    );

    const trailItems = labels.map((label, i) => {
      const isEquipmentCrumb = i === labels.length - 1;
      if (isEquipmentCrumb && restoreEquipmentId) {
        return {
          label,
          to: returnTo,
          state: {
            ...hubState,
            restoreEquipmentId,
            hierarchyPathIds: pathIds,
          },
        };
      }
      if (i === labels.length - 1) return { label };
      return {
        label,
        to: returnTo,
        state: pathIds?.length
          ? { ...hubState, hierarchyPathIds: pathIds.slice(0, i + 1) }
          : hubState,
      };
    });

    return trailItems;
  }, [
    showNewHubTrail,
    appId,
    appName,
    dept,
    eq,
    draftEquipment,
    hierarchyPathIds,
    returnTo,
    specSection,
    restoreEquipmentId,
    disciplineMeta,
  ]);

  const equipmentDefaults = useMemo(() => ({
    tagNo: eq?.tag_name || draftEquipment?.tag_name || '',
    equipNo: eq?.equip_no || draftEquipment?.equip_no || '',
    location: eq?.location || '',
    commissioned: eq?.commissioned || '',
  }), [eq?.tag_name, eq?.equip_no, eq?.location, eq?.commissioned, draftEquipment?.tag_name, draftEquipment?.equip_no]);

  const equipmentOptions = useMemo(
    () => buildEquipmentOptionsFromSpecs(
      specs,
      equipmentDefaults,
      disciplineSpecFocus ? specSection : null,
    ),
    [specs, equipmentDefaults, disciplineSpecFocus, specSection],
  );

  const historyForView = useMemo(() => {
    if (!isNewHub || !disciplineSpecFocus) return history;
    return history.filter((row) => historyRecordMatchesSection(row, specSection));
  }, [history, isNewHub, disciplineSpecFocus, specSection]);

  const historyTotalForView = isNewHub && disciplineSpecFocus
    ? historyForView.length
    : histTotal;

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!eq)     return <p className="text-center py-20 text-gray-400">Equipment not found.</p>;

  const displayId = powerEquipmentDisplayId(eq);

  return (
    <main className="app-main">
      <AppBreadcrumb items={breadcrumbItems} />

      {(displayId || isNewDraft) && (
        <div className="mb-6">
          <p className="text-sm text-gray-500 font-mono">
            {displayId}
            {isNewDraft && (
              <span className="ml-2 text-amber-600 font-sans font-medium">New — save to create record</span>
            )}
          </p>
        </div>
      )}

      {!isNewHub && (
        <EquipmentLifeHistoryCard
          equipment={eq}
          saving={saving}
          onSave={saveLifeHistory}
          fields={POWER_LIFE_HISTORY_FIELDS}
        />
      )}
      {/*
        Power Plant Equipment History (new): Equipment Life History Card disabled.
        Tag no., equipment no., location, commissioning date & gallery are on each spec sub-group.
      <EquipmentLifeHistoryCard
        equipment={eq}
        saving={saving}
        onSave={saveLifeHistory}
        fields={POWER_LIFE_HISTORY_FIELDS}
      />
      */}

      {/* ── Section 2: Specifications (structured hub) ── */}
      <div className="mb-3">
        <EquipmentSpecificationHub
          embedded
          equipmentTag={eq?.tag_name || eq?.equip_no || ''}
          apiSpecs={specs}
          onSave={saveHubSpecs}
          saving={saving}
          hideBulkActions={showNewHubTrail}
          sectionFilter={disciplineSpecFocus ? specSection : null}
          defaultBodyOpen={disciplineSpecFocus}
          subGroupCardMode={isNewHub}
          equipmentDefaults={equipmentDefaults}
          onDeleteSubGroupMaintenanceHistory={isNewHub ? deleteSubGroupMaintenanceHistory : null}
          onRenameSubGroupMaintenanceHistory={isNewHub ? renameSubGroupMaintenanceHistory : null}
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
        apiRecords={isNewHub ? historyForView : history}
        totalCount={isNewHub ? historyTotalForView : histTotal}
        saving={saving}
        open={open.hist}
        onToggle={() => toggle('hist')}
        onSave={saveMaintenanceRecord}
        onDelete={deleteMaintenanceRecord}
        equipmentOptions={isNewHub ? equipmentOptions : []}
      />
    </main>
  );
};

export default PowerEquipmentDetail;
