import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MdDelete, MdPictureAsPdf, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import EquipmentSpecificationHub from '../../components/equipment/EquipmentSpecificationHub';
import EquipmentMaintenanceHistoryHub from '../../components/equipment/EquipmentMaintenanceHistoryHub';
import { buildProductionHouseEquipmentTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import useLockedCardManageAccess from '../../hooks/useLockedCardManageAccess';
import useMaintenanceHistoryHodRefresh from '../../hooks/useMaintenanceHistoryHodRefresh';
import { withoutGsmaLabel } from '../../utils/displayLabels';
import { serializeSpecsForApi, buildEquipmentOptionsFromSpecs } from '../../utils/equipmentSpecModel';
import { saveHistoryWithDocuments, resubmitHistoryWithDocuments } from '../../utils/historyDocuments';
import {
  isProductionHouseSection,
  productionHouseSectionLabel,
} from '../../config/productionHouseHouses';
import { formatProductionHouseSpecRows } from '../../utils/productionHouseSpecValue';

const EquipmentPdfExportModal = lazy(() => import('../../components/equipment/EquipmentPdfExportModal'));

const PDF_SECTIONS = [
  { key: 'specs', label: 'Equipment Specification' },
  { key: 'history', label: 'Equipment Maintenance History' },
];

const HIST_FETCH_LIMIT = 200;
const API_BASE = '/production-house';

const ProductionHouseEquipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = location.state?.appId;
  const appName = useAppName(appId);
  const equipId = /^\d+$/.test(String(id || '')) ? String(id) : null;
  const focusApprovalRequestId = searchParams.get('approvalRequestId');

  const { canManage } = useLockedCardManageAccess();
  const canManageProduction = canManage('production');

  const [eq, setEq] = useState(null);
  const [specs, setSpecs] = useState([]);
  const [history, setHistory] = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityForm, setIdentityForm] = useState({
    name: '',
    type: '',
    duty: '',
    capacity: '',
  });
  const [histOpen, setHistOpen] = useState(true);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (!equipId || isProductionHouseSection(id)) {
      navigate('/production-house-equipment', { replace: true, state: location.state });
    }
  }, [equipId, id, navigate, location.state]);

  useEffect(() => {
    if (!focusApprovalRequestId) return;
    setHistOpen(true);
  }, [focusApprovalRequestId]);

  const clearFocusApprovalRequest = useCallback(() => {
    if (!searchParams.has('approvalRequestId')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('approvalRequestId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadHistory = useCallback(async () => {
    if (!equipId) return;
    const { data } = await api.get(`${API_BASE}/${equipId}/history`, {
      params: { page: 1, limit: HIST_FETCH_LIMIT },
    });
    setHistory(data.records);
    setHistTotal(data.total);
  }, [equipId]);

  useMaintenanceHistoryHodRefresh({
    equipId,
    domain: 'production',
    reload: loadHistory,
  });

  const load = useCallback(async () => {
    if (!equipId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`${API_BASE}/${equipId}`);
      const equipment = data.equipment;
      setEq(equipment);
      setIdentityForm({
        name: equipment?.name || '',
        type: equipment?.type || '',
        duty: equipment?.duty || '',
        capacity: equipment?.capacity || '',
      });
      setSpecs(formatProductionHouseSpecRows(data.specs));
      // Prefer /history so pending approval overlays are applied
      await loadHistory();
    } catch {
      toast.error('Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  }, [equipId, loadHistory]);

  useEffect(() => { load(); }, [load]);

  const houseLabel = eq ? productionHouseSectionLabel(eq.house_section) : '';
  const identityLocked = Boolean(eq?.isImported) && !canManageProduction;

  const equipmentDefaults = useMemo(() => ({
    tagNo: '',
    equipNo: eq?.equip_no || '',
    location: houseLabel,
    commissioned: '',
  }), [eq?.equip_no, houseLabel]);

  const equipmentOptions = useMemo(() => {
    const fromSpecs = buildEquipmentOptionsFromSpecs(specs, equipmentDefaults, 'mechanical');
    if (fromSpecs.length > 0) return fromSpecs;
    if (!eq?.name) return [];
    return [{
      key: `mechanical::${eq.name}`,
      section: 'mechanical',
      subSection: eq.name,
      label: eq.name,
      disciplineLabel: 'Mechanical',
    }];
  }, [specs, equipmentDefaults, eq?.name]);

  const breadcrumbItems = useMemo(
    () => buildProductionHouseEquipmentTrail({
      appId,
      appName,
      equipmentName: eq?.name,
    }),
    [appId, appName, eq?.name],
  );

  const handleExportPdf = async (selectedKeys) => {
    if (!selectedKeys?.length) {
      toast.error('Select at least one section to download.');
      return;
    }

    setPdfGenerating(true);
    try {
      const { exportEquipmentDataToPdf } = await import('../../utils/exportEquipmentDataPdf');
      const baseName = (eq?.name || eq?.equip_no || 'Equipment')
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
        docTitle: eq?.name || 'Equipment Details',
        breadcrumbText,
        specs: { rows: specs, equipmentDefaults, specSection: 'mechanical' },
        schedule: { rows: [], equipmentOptions: [] },
        history: { rows: history, equipmentOptions },
      });
      setPdfModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Could not generate PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const saveIdentity = async (e) => {
    e?.preventDefault?.();
    if (!equipId || identityLocked) return;
    const name = String(identityForm.name || '').trim();
    if (!name) {
      toast.error('Equipment name is required.');
      return;
    }
    setIdentitySaving(true);
    try {
      await api.put(`${API_BASE}/${equipId}`, {
        name,
        type: String(identityForm.type || '').trim(),
        duty: String(identityForm.duty || '').trim(),
        capacity: String(identityForm.capacity || '').trim(),
      });
      toast.success('Equipment details saved.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setIdentitySaving(false);
    }
  };

  const deleteEquipment = async () => {
    if (!equipId || identityLocked) return;
    if (!window.confirm(`Delete "${eq?.name || 'this equipment'}"? Specs and history will be removed.`)) {
      return;
    }
    setIdentitySaving(true);
    try {
      await api.delete(`${API_BASE}/${equipId}`);
      toast.success('Equipment deleted.');
      navigate('/production-house-equipment', { replace: true, state: location.state });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
      setIdentitySaving(false);
    }
  };

  const saveHubSpecs = async (structuredSpecs, subSections, subGroupMeta) => {
    if (!equipId) return;
    setSaving(true);
    try {
      const payload = serializeSpecsForApi(structuredSpecs, subSections, subGroupMeta);
      await api.put(`${API_BASE}/${equipId}/specs`, { specs: payload });
      const { data } = await api.get(`${API_BASE}/${equipId}`);
      setSpecs(formatProductionHouseSpecRows(data.specs));
      toast.success('Specifications saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const saveMaintenanceRecord = async (form, mode, recordId, record) => {
    if (!equipId) return;
    setSaving(true);
    try {
      if (record?.pendingStatus === 'needs_modification' && record.pendingRequestId) {
        await resubmitHistoryWithDocuments({
          apiBase: API_BASE,
          equipId,
          form,
          approvalRequestId: record.pendingRequestId,
          previousDocuments: record.documents || [],
        });
        toast.success('Resubmitted for HOD approval.');
        await loadHistory();
        return;
      }

      const result = await saveHistoryWithDocuments({
        apiBase: API_BASE,
        equipId,
        form,
        mode,
        recordId,
      });
      if (result?.pending) {
        toast.success('Sent to HOD for approval. Pending until the HOD reviews it.');
        await loadHistory();
        return;
      }
      toast.success(mode === 'add' ? 'Record added.' : 'Record updated.');
      await loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed.');
      if (err.pendingCreated) {
        try {
          await loadHistory();
        } catch {
          /* ignore */
        }
      }
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const deleteMaintenanceRecord = async (hid) => {
    if (!equipId) return;
    setSaving(true);
    try {
      const response = await api.delete(`${API_BASE}/${equipId}/history/${hid}`);
      if (response.status === 202 || response.data?.pending) {
        toast.success('Delete requested. The record stays until the HOD approves.');
        await loadHistory();
        return;
      }
      toast.success('Record deleted.');
      await loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (!equipId) return null;
  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!eq) return <p className="text-center py-20 text-gray-400">Equipment not found.</p>;

  return (
    <main className="app-main">
      <AppBreadcrumb items={breadcrumbItems} className="mb-3" />

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

      <section className="card mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Equipment details</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {houseLabel}
              {eq.equip_no ? ` · ${eq.equip_no}` : ''}
              {eq.isImported ? ' · Extracted / imported card' : ''}
            </p>
          </div>
          {identityLocked && (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              Identity locked — ask an admin for locked-card manage access
            </span>
          )}
        </div>
        <form onSubmit={saveIdentity} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
            Name
            <input
              type="text"
              value={identityForm.name}
              readOnly={identityLocked}
              onChange={(e) => setIdentityForm((prev) => ({ ...prev, name: e.target.value }))}
              className={`input mt-1 ${identityLocked ? 'bg-slate-50 text-slate-500' : ''}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Type
            <input
              type="text"
              value={identityForm.type}
              readOnly={identityLocked}
              onChange={(e) => setIdentityForm((prev) => ({ ...prev, type: e.target.value }))}
              className={`input mt-1 ${identityLocked ? 'bg-slate-50 text-slate-500' : ''}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Duty
            <input
              type="text"
              value={identityForm.duty}
              readOnly={identityLocked}
              onChange={(e) => setIdentityForm((prev) => ({ ...prev, duty: e.target.value }))}
              className={`input mt-1 ${identityLocked ? 'bg-slate-50 text-slate-500' : ''}`}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
            Capacity
            <input
              type="text"
              value={identityForm.capacity}
              readOnly={identityLocked}
              onChange={(e) => setIdentityForm((prev) => ({ ...prev, capacity: e.target.value }))}
              className={`input mt-1 ${identityLocked ? 'bg-slate-50 text-slate-500' : ''}`}
            />
          </label>
          {!identityLocked && (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={identitySaving}
                className="btn-primary disabled:opacity-50"
              >
                <MdSave className="h-4 w-4" />
                Save details
              </button>
              <button
                type="button"
                onClick={deleteEquipment}
                disabled={identitySaving}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                <MdDelete className="h-4 w-4" />
                Delete card
              </button>
            </div>
          )}
        </form>
      </section>

      <div className="mb-3">
        <EquipmentSpecificationHub
          embedded
          equipmentTag={eq.equip_no || ''}
          apiSpecs={specs}
          onSave={saveHubSpecs}
          saving={saving}
          hideBulkActions
          sectionFilter="mechanical"
          sectionTitle="Equipment Specification"
          defaultBodyOpen
          subGroupCardMode
          hideAddSubGroup
          equipmentDefaults={equipmentDefaults}
        />
      </div>

      <EquipmentMaintenanceHistoryHub
        embedded
        apiRecords={history}
        totalCount={histTotal}
        saving={saving}
        open={histOpen}
        onToggle={() => setHistOpen((v) => !v)}
        onSave={saveMaintenanceRecord}
        onDelete={deleteMaintenanceRecord}
        exportFileName={eq.name || 'Equipment_Maintenance_History'}
        equipmentOptions={equipmentOptions}
        defaultEquipmentKeys={equipmentOptions.map((opt) => opt.key)}
        observationRequired={false}
        enableDocuments
        historyApiBase={API_BASE}
        equipId={eq?.id || equipId}
        focusApprovalRequestId={focusApprovalRequestId}
        onFocusHandled={clearFocusApprovalRequest}
      />

      {pdfModalOpen && (
        <Suspense fallback={null}>
          <EquipmentPdfExportModal
            open={pdfModalOpen}
            onClose={() => !pdfGenerating && setPdfModalOpen(false)}
            onConfirm={handleExportPdf}
            generating={pdfGenerating}
            sections={PDF_SECTIONS}
          />
        </Suspense>
      )}
    </main>
  );
};

export default ProductionHouseEquipmentDetail;
