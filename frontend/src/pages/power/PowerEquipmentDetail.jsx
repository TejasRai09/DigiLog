import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import { buildPowerEquipmentTrail, buildPowerPlantEquipmentNewTrail, buildSugarHouseEquipmentNewTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import EquipmentLifeHistoryCard from '../../components/equipment/EquipmentLifeHistoryCard';
import EquipmentSpecificationHub from '../../components/equipment/EquipmentSpecificationHub';
import OemMaintenanceScheduleHub from '../../components/equipment/OemMaintenanceScheduleHub';
import EquipmentMaintenanceHistoryHub from '../../components/equipment/EquipmentMaintenanceHistoryHub';
import { MdPictureAsPdf } from 'react-icons/md';

// Only load the export modal (and, on confirm, jsPDF) when the user opens it.
const EquipmentPdfExportModal = lazy(() => import('../../components/equipment/EquipmentPdfExportModal'));
import { serializeSpecsForApi, buildEquipmentOptionsFromSpecs } from '../../utils/equipmentSpecModel';
import { serializeScheduleForApi, scheduleApiRowMatchesSection } from '../../utils/equipmentScheduleModel';
import { historyRecordToApi, historyRecordMatchesSection } from '../../utils/equipmentHistoryModel';
import { saveHistoryWithDocuments } from '../../utils/historyDocuments';
import { POWER_LIFE_HISTORY_FIELDS } from '../../config/powerEquipmentFields';
import { findDiscipline } from '../../config/engineeringDisciplines';
import usePowerPlantHierarchy from '../../hooks/usePowerPlantHierarchy';
import useSugarHouseHierarchy from '../../hooks/useSugarHouseHierarchy';
import { hierarchyBreadcrumbLabels } from '../../utils/hierarchyTreeUtils';
import { withoutGsmaLabel } from '../../utils/displayLabels';
import {
  powerNewDetailPath,
  sugarNewDetailPath,
  resolveDisciplineSection,
} from '../../utils/resolveDisciplineSection';

const HIST_FETCH_LIMIT = 200;

const PowerEquipmentDetail = () => {
  const { id, dept, discipline: disciplineParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPowerNewHub = location.pathname.startsWith('/power-plant-equipment-new');
  const isSugarNewHub = location.pathname.startsWith('/sugar-house-equipment-new');
  const isNewHub = isPowerNewHub || isSugarNewHub;
  const apiBase = isSugarNewHub ? '/sugar-new' : (isPowerNewHub ? '/power-new' : '/power');
  const defaultDept = isSugarNewHub ? 'sugar_house' : (isPowerNewHub ? 'plant' : 'electrical');
  const appId = location.state?.appId;
  const fromHierarchy = Boolean(location.state?.fromHierarchy);
  const showNewHubTrail = fromHierarchy || isNewHub;
  const draftEquipment = location.state?.draftEquipment;
  const returnTo = location.state?.returnTo || (isSugarNewHub ? '/sugar-house-equipment-new' : '/power-plant-equipment-new');
  const hierarchyPathIds = location.state?.hierarchyPathIds;
  const detailPathFn = isSugarNewHub ? sugarNewDetailPath : powerNewDetailPath;
  const specSection = useMemo(
    () => resolveDisciplineSection({
      disciplineParam,
      pathname: location.pathname,
      stateSection: location.state?.specSection,
    }),
    [disciplineParam, location.pathname, location.state?.specSection],
  );
  const restoreEquipmentId = location.state?.restoreEquipmentId || null;
  const disciplineMeta = specSection ? findDiscipline(specSection) : null;
  const disciplineSpecFocus = isNewHub && Boolean(specSection && disciplineMeta);
  const appName = useAppName(appId);
  const { tree: powerHierarchyTree, reload: reloadPowerHierarchy } = usePowerPlantHierarchy();
  const { tree: sugarHierarchyTree, reload: reloadSugarHierarchy } = useSugarHouseHierarchy();
  const hierarchyTree = isSugarNewHub ? sugarHierarchyTree : powerHierarchyTree;
  const reloadHierarchy = isSugarNewHub ? reloadSugarHierarchy : reloadPowerHierarchy;
  const isNewDraft = id === 'new';

  const [eq,        setEq]        = useState(null);
  const [specs,     setSpecs]     = useState([]);
  const [schedule,  setSchedule]  = useState([]);
  const [history,   setHistory]   = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const equipIdRef = useRef(id);
  const createPromiseRef = useRef(null);
  useEffect(() => {
    equipIdRef.current = id;
    if (id !== 'new') createPromiseRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!isNewHub || !id || id === 'new' || !specSection) return;
    if (disciplineParam === specSection) return;
    navigate(detailPathFn(id, specSection), { replace: true, state: location.state });
  }, [isNewHub, id, specSection, disciplineParam, navigate, location.state, detailPathFn]);

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
          location: eq?.location || draft.location || null,
          dept: dept || defaultDept,
        });
        const created = data.equipment;
        const newId = String(created.id);
        equipIdRef.current = newId;
        setEq(created);

        // Write ppn_equip_id back to the hierarchy node so future opens
        // go directly to this equipment without any name/lookup lookup.
        // restoreEquipmentId is the hierarchy node id set by the explorer.
        if (isNewHub && restoreEquipmentId) {
          try {
            await api.patch(`${apiBase}/hierarchy/${restoreEquipmentId}/link`, {
              ppn_equip_id: parseInt(newId, 10),
            });
          } catch {
            // Non-fatal — equipment is created; link write-back can be retried on next save
          }
        }

        const detailPath = isNewHub
          ? detailPathFn(newId, specSection)
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
  }, [draftEquipment, eq?.name, eq?.equip_no, dept, navigate, appId, returnTo, fromHierarchy, hierarchyPathIds, specSection, restoreEquipmentId, apiBase, defaultDept, isNewHub, detailPathFn]);

  const [open, setOpen] = useState({ spec: false, oem: false, hist: false });
  const toggle = (s) => setOpen(o => ({ ...o, [s]: !o[s] }));

  const loadHistory = async (equipId) => {
    const eid = equipId ?? equipIdRef.current;
    if (eid === 'new') return;
    try {
      const params = { page: 1, limit: HIST_FETCH_LIMIT };
      if (isNewHub && specSection) {
        params.section = specSection;
      }
      const { data } = await api.get(`${apiBase}/${eid}/history`, { params });
      setHistory(data.records);
      setHistTotal(data.total);
    } catch {
      toast.error('Failed to load history.');
    }
  };

  const loadSchedule = async (equipId) => {
    const eid = equipId ?? equipIdRef.current;
    if (eid === 'new') return;
    try {
      const params = isNewHub && specSection ? { section: specSection } : {};
      const { data } = await api.get(`${apiBase}/${eid}`, { params });
      setSchedule(data.schedule);
    } catch {
      toast.error('Failed to load schedule.');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const equipParams = isNewHub && specSection ? { section: specSection } : {};
      const { data } = await api.get(`${apiBase}/${id}`, { params: equipParams });
      setEq(data.equipment);
      setSpecs(data.specs);
      setSchedule(data.schedule);
      if (isNewHub && specSection) {
        const params = { page: 1, limit: HIST_FETCH_LIMIT, section: specSection };
        const histRes = await api.get(`${apiBase}/${id}/history`, { params });
        setHistory(histRes.data.records);
        setHistTotal(histRes.data.total);
      } else {
        setHistory(data.history);
        setHistTotal(data.histTotal);
        if (data.histTotal > data.history?.length) {
          const params = { page: 1, limit: HIST_FETCH_LIMIT };
          const histRes = await api.get(`${apiBase}/${id}/history`, { params });
          setHistory(histRes.data.records);
          setHistTotal(histRes.data.total);
        }
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
        location: draftEquipment.location || '',
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
  }, [id, isNewDraft, draftEquipment, dept, specSection]);

  const saveLifeHistory = async ({ fields, images = {} }) => {
    setSaving(true);
    try {
      const equipId = await resolveEquipmentId();
      const previousName = String(eq?.name || draftEquipment?.name || '').trim();
      const nextName = fields?.name != null ? String(fields.name).trim() : previousName;

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

      // Keep hierarchy leaf name in sync so breadcrumb / cards show the renamed equipment
      if (isNewHub && nextName && nextName !== previousName) {
        try {
          const nodeId = restoreEquipmentId || '0';
          await api.patch(`${apiBase}/hierarchy/${nodeId}/sync-name`, {
            name: nextName,
            ppn_equip_id: parseInt(equipId, 10),
            shn_equip_id: parseInt(equipId, 10),
          });
          await reloadHierarchy({ silent: true });
        } catch {
          // Non-fatal — equipment rename already saved
        }
      }

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
      const requestConfig = isNewHub && specSection
        ? { params: { section: specSection } }
        : {};
      await api.put(
        `${apiBase}/${equipId}/schedule`,
        { schedule: payload, scope_section: specSection || undefined },
        requestConfig,
      );
      const reloadParams = isNewHub && specSection ? { section: specSection } : {};
      const { data } = await api.get(`${apiBase}/${equipId}`, { params: reloadParams });
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
      if (isNewHub) {
        const result = await saveHistoryWithDocuments({ apiBase, equipId, form, mode, recordId });
        if (result?.pending) {
          toast.success('Sent to HOD for approval. It will appear after approval.');
          return;
        }
      } else {
        const body = historyRecordToApi(form);
        let response;
        if (mode === 'add') {
          response = await api.post(`${apiBase}/${equipId}/history`, body);
        } else {
          response = await api.put(`${apiBase}/${equipId}/history/${recordId}`, body);
        }
        if (response.status === 202 || response.data?.pending) {
          toast.success('Sent to HOD for approval. It will appear after approval.');
          return;
        }
      }
      toast.success(mode === 'add' ? 'Record added.' : 'Record updated.');
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
      const response = await api.delete(`${apiBase}/${equipId}/history/${hid}`);
      if (response.status === 202 || response.data?.pending) {
        toast.success('Sent to HOD for approval. It will be removed after approval.');
        return;
      }
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
    await Promise.all([loadHistory(equipId), loadSchedule(equipId)]);
  };

  const renameSubGroupMaintenanceHistory = async (section, oldSubSection, newSubSection) => {
    if (!isNewHub || oldSubSection === newSubSection) return;
    const equipId = await resolveEquipmentId();
    await api.put(`${apiBase}/${equipId}/history-sub-group/rename`, {
      section,
      old_sub_section: oldSubSection,
      new_sub_section: newSubSection,
    });
    await Promise.all([loadHistory(equipId), loadSchedule(equipId)]);
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

    const equipmentForTrail = eq || draftEquipment || {};
    const { labels, pathIds } = hierarchyBreadcrumbLabels(
      hierarchyTree,
      equipmentForTrail,
      hierarchyPathIds,
    );

    const buildTrail = isSugarNewHub
      ? buildSugarHouseEquipmentNewTrail
      : buildPowerPlantEquipmentNewTrail;

    return buildTrail({
      appId,
      appName,
      hierarchyLabels: labels,
      hierarchyPathIds: pathIds,
      restoreEquipmentId,
      disciplineLabel: disciplineSpecFocus && disciplineMeta ? disciplineMeta.name : null,
    });
  }, [
    showNewHubTrail,
    appId,
    appName,
    dept,
    eq,
    draftEquipment,
    hierarchyPathIds,
    restoreEquipmentId,
    disciplineMeta,
    disciplineSpecFocus,
    hierarchyTree,
    isSugarNewHub,
  ]);

  const equipmentDefaults = useMemo(() => ({
    tagNo: eq?.tag_name || draftEquipment?.tag_name || '',
    equipNo: eq?.equip_no || draftEquipment?.equip_no || '',
    location: eq?.location || draftEquipment?.location || '',
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

  const scheduleEquipmentOptions = useMemo(
    () => {
      if (!isNewHub || !specSection) return [];
      return buildEquipmentOptionsFromSpecs(specs, equipmentDefaults, specSection);
    },
    [isNewHub, specs, equipmentDefaults, specSection],
  );

  const scheduleForView = useMemo(() => {
    if (!isNewHub) return schedule;
    if (!specSection) return [];
    return schedule.filter((row) => scheduleApiRowMatchesSection(row, specSection));
  }, [schedule, isNewHub, specSection]);

  const historyForView = useMemo(() => {
    if (!isNewHub || !specSection) return history;
    return history.filter((row) => historyRecordMatchesSection(row, specSection));
  }, [history, isNewHub, specSection]);

  const historyTotalForView = histTotal;

  const handleExportPdf = async (selectedKeys) => {
    if (!selectedKeys?.length) {
      toast.error('Select at least one section to download.');
      return;
    }

    setPdfGenerating(true);
    try {
      const { exportEquipmentDataToPdf } = await import('../../utils/exportEquipmentDataPdf');
      const baseName = (eq?.name || eq?.tag_name || eq?.equip_no || 'Equipment')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const breadcrumbText = breadcrumbItems
        .map((item) => withoutGsmaLabel(item.label))
        .filter(Boolean)
        .join('  >  ');
      await exportEquipmentDataToPdf({
        selectedKeys,
        fileName: `${baseName}_${new Date().toISOString().slice(0, 10)}.pdf`,
        docTitle: eq?.name || eq?.tag_name || 'Equipment Details',
        breadcrumbText,
        specs: { rows: specs, equipmentDefaults, specSection: disciplineSpecFocus ? specSection : null },
        schedule: { rows: scheduleForView, equipmentOptions: scheduleEquipmentOptions },
        history: { rows: isNewHub ? historyForView : history, equipmentOptions: isNewHub ? equipmentOptions : [] },
      });
      setPdfModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Could not generate PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!eq)     return <p className="text-center py-20 text-gray-400">Equipment not found.</p>;

  return (
    <main className="app-main">
      <AppBreadcrumb items={breadcrumbItems} className="mb-3" />

      {isNewHub && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setPdfModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <MdPictureAsPdf className="h-4 w-4" />
            Download PDF
          </button>
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
          apiSchedule={scheduleForView}
          onSave={saveHubSchedule}
          saving={saving}
          hideBulkActions={showNewHubTrail}
          equipmentOptions={scheduleEquipmentOptions}
          disciplineSection={isNewHub ? specSection : null}
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
        exportFileName={eq?.name || eq?.tag_name || 'Equipment_Maintenance_History'}
        enableDocuments={isNewHub}
        historyApiBase={apiBase}
        equipId={eq?.id || id}
      />

      {isNewHub && pdfModalOpen && (
        <Suspense fallback={null}>
          <EquipmentPdfExportModal
            open={pdfModalOpen}
            onClose={() => !pdfGenerating && setPdfModalOpen(false)}
            onConfirm={handleExportPdf}
            generating={pdfGenerating}
          />
        </Suspense>
      )}
    </main>
  );
};

export default PowerEquipmentDetail;
