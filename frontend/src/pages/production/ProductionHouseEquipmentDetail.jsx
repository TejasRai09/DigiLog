import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MdPictureAsPdf } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import EquipmentSpecificationHub from '../../components/equipment/EquipmentSpecificationHub';
import EquipmentMaintenanceHistoryHub from '../../components/equipment/EquipmentMaintenanceHistoryHub';
import { buildProductionHouseEquipmentTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import { withoutGsmaLabel } from '../../utils/displayLabels';
import { serializeSpecsForApi, buildEquipmentOptionsFromSpecs } from '../../utils/equipmentSpecModel';
import { historyRecordToApi } from '../../utils/equipmentHistoryModel';
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
  const appId = location.state?.appId;
  const appName = useAppName(appId);
  const equipId = /^\d+$/.test(String(id || '')) ? String(id) : null;

  const [eq, setEq] = useState(null);
  const [specs, setSpecs] = useState([]);
  const [history, setHistory] = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [histOpen, setHistOpen] = useState(true);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (!equipId || isProductionHouseSection(id)) {
      navigate('/production-house-equipment', { replace: true, state: location.state });
    }
  }, [equipId, id, navigate, location.state]);

  const loadHistory = useCallback(async () => {
    if (!equipId) return;
    const { data } = await api.get(`${API_BASE}/${equipId}/history`, {
      params: { page: 1, limit: HIST_FETCH_LIMIT },
    });
    setHistory(data.records);
    setHistTotal(data.total);
  }, [equipId]);

  const load = useCallback(async () => {
    if (!equipId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`${API_BASE}/${equipId}`);
      setEq(data.equipment);
      setSpecs(formatProductionHouseSpecRows(data.specs));
      setHistory(data.history);
      setHistTotal(data.histTotal);
      if (data.histTotal > (data.history?.length || 0)) {
        await loadHistory();
      }
    } catch {
      toast.error('Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  }, [equipId, loadHistory]);

  useEffect(() => { load(); }, [load]);

  const houseLabel = eq ? productionHouseSectionLabel(eq.house_section) : '';

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

  const saveMaintenanceRecord = async (form, mode, recordId) => {
    if (!equipId) return;
    setSaving(true);
    try {
      const body = historyRecordToApi(form);
      if (mode === 'add') {
        await api.post(`${API_BASE}/${equipId}/history`, body);
        toast.success('Record added.');
      } else {
        await api.put(`${API_BASE}/${equipId}/history/${recordId}`, body);
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
    if (!equipId) return;
    setSaving(true);
    try {
      await api.delete(`${API_BASE}/${equipId}/history/${hid}`);
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
