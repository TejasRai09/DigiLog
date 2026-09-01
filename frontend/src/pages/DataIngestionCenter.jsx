import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from '../components/Spinner';
import PurchyImportProgressModal from '../components/PurchyImportProgressModal';
import PurchyUploadSection from '../components/PurchyUploadSection';
import ManagementDashboardUploadSection from '../components/ManagementDashboardUploadSection';
import ManagementDashboardImportProgressModal from '../components/ManagementDashboardImportProgressModal';
import MillingDashboardUploadSection from '../components/MillingDashboardUploadSection';
import useDataUploadAccess from '../hooks/useDataUploadAccess';
import { clearPurchyQueryCache } from '../hooks/purchyQueryCache';

const PURCHY_CATEGORIES = new Set([
  'Purchy Analysis — Grower Details',
  'Purchy Analysis — Staff Mapping',
]);

const MD_CATEGORIES = new Set([
  'Management Dashboard — Centre Indent',
  'Management Dashboard — Centre Purchase',
  'Management Dashboard — Centre Indent & Purchase',
  'Management Dashboard — DMR Workbook',
]);

export default function DataIngestionCenter() {
  const { enabled, loading: accessLoading, canAccess } = useDataUploadAccess();
  const showPurchy = canAccess('purchy');
  const showManagement = canAccess('management');
  const showMilling = canAccess('milling');

  const [files, setFiles] = useState([]);
  const [purchyImport, setPurchyImport] = useState(null);
  const [mdImport, setMdImport] = useState(null);
  const [purchyRefresh, setPurchyRefresh] = useState(0);
  const [mdRefresh, setMdRefresh] = useState(0);

  const fetchFiles = useCallback(async () => {
    if (!showMilling) {
      setFiles([]);
      return;
    }
    try {
      const { data } = await api.get('/data-upload/files');
      const all = data.files || [];
      setFiles(all.filter((f) => !PURCHY_CATEGORIES.has(f.category) && !MD_CATEGORIES.has(f.category) && !f.purchySlot && !f.dataset));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load uploads.');
    }
  }, [showMilling]);

  useEffect(() => {
    if (enabled && showMilling) fetchFiles();
  }, [enabled, showMilling, fetchFiles]);

  if (accessLoading) return <Spinner fullScreen />;

  if (!enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="app-main">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Zuari Industries · DigiLog
        </p>
        <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Data Ingestion Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Use the sections below to upload specific reference files for dashboards.
        </p>

        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          <MdArrowBack className="h-4 w-4" />
          Back to Modules
        </Link>

        {showPurchy && (
          <PurchyUploadSection onImportStarted={setPurchyImport} refreshToken={purchyRefresh} />
        )}

        {showManagement && (
          <ManagementDashboardUploadSection onImportStarted={setMdImport} refreshToken={mdRefresh} />
        )}

        {showMilling && (
          <MillingDashboardUploadSection files={files} onUploaded={fetchFiles} />
        )}
      </div>

      {mdImport && (
        <ManagementDashboardImportProgressModal
          jobId={mdImport.jobId}
          filename={mdImport.filename}
          importType={mdImport.type}
          onClose={() => setMdImport(null)}
          onComplete={(data) => {
            if (data?.status === 'failed') {
              toast.error(data.error || 'Import failed — check column names match the template.');
            } else {
              toast.success('Management Dashboard data imported.');
            }
            setMdRefresh((n) => n + 1);
          }}
        />
      )}

      {purchyImport && (
        <PurchyImportProgressModal
          jobId={purchyImport.jobId}
          filename={purchyImport.filename}
          importType={purchyImport.type}
          onClose={() => setPurchyImport(null)}
          onComplete={() => {
            clearPurchyQueryCache();
            toast.success('Purchy data imported. Open Purchy Analysis in Live mode.');
            fetchFiles();
            setPurchyRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
