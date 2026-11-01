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
import AppPageHeader from '../components/AppPageHeader';

export default function DataIngestionCenter() {
  const { enabled, loading: accessLoading, canAccess } = useDataUploadAccess();
  const showPurchy = canAccess('purchy');
  const showManagement = canAccess('management');
  const showMilling = canAccess('milling');

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [purchyImport, setPurchyImport] = useState(null);
  const [mdImport, setMdImport] = useState(null);
  const [purchyRefresh, setPurchyRefresh] = useState(0);
  const [mdRefresh, setMdRefresh] = useState(0);

  const fetchFiles = useCallback(async () => {
    if (!showMilling) {
      setFiles([]);
      return;
    }
    setFilesLoading(true);
    try {
      const { data } = await api.get('/data-upload/files?section=milling');
      setFiles(data.files || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load uploads.');
    } finally {
      setFilesLoading(false);
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
    <div className="min-h-screen">
      <div className="app-main">
        <AppPageHeader className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Zuari Industries · DigiLog
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Data Ingestion Center</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-800">
            Use the sections below to upload specific reference files for dashboards.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            <MdArrowBack className="h-4 w-4" />
            Back to Modules
          </Link>
        </AppPageHeader>

        {showPurchy && (
          <PurchyUploadSection onImportStarted={setPurchyImport} refreshToken={purchyRefresh} />
        )}

        {showManagement && (
          <ManagementDashboardUploadSection onImportStarted={setMdImport} refreshToken={mdRefresh} />
        )}

        {showMilling && (
          <MillingDashboardUploadSection
            files={files}
            loading={filesLoading}
            onUploaded={fetchFiles}
          />
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
            toast.success('Purchy data imported. Open Grower Intelligence in Live mode.');
            fetchFiles();
            setPurchyRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
