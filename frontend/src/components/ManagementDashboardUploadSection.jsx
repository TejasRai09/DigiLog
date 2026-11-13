import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdChevronRight, MdExpandMore, MdInsights, MdUpload } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';
import DataUploadHistoryTable from './DataUploadHistoryTable';

const SLOTS = [
  {
    slot: 'indent-purchase',
    dataset: 'centre_indent_purchase',
    legacyDatasets: ['centre_indent', 'centre_purchase'],
    label: 'Centre Indent & Purchase',
    hint: 'One file with indent and purchase sheets (Code, Center Name, Date, No of Purchy, Qty). Gate or Center is set only after gate center codes are saved in Admin Config. The Category column is ignored.',
  },
  {
    slot: 'dmr',
    dataset: 'dmr_workbook',
    label: 'DMR workbook',
    hint: 'Single Sheet1 — columns matched by name (Date, Crop Day, …). Extra or reordered columns are OK.',
  },
];

function UploadCard({ meta, uploading, onUpload }) {
  const inputRef = useRef(null);

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{meta.label}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{meta.hint}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(meta.slot, f);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="btn-primary w-full justify-center text-sm"
      >
        {uploading ? <Spinner size="sm" /> : <MdUpload className="h-4 w-4" />}
        {uploading ? 'Uploading…' : 'Upload & import'}
      </button>
    </div>
  );
}

export default function ManagementDashboardUploadSection({ onImportStarted, refreshToken = 0 }) {
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [histories, setHistories] = useState({ centre_indent_purchase: [], dmr_workbook: [] });
  const [loadingHist, setLoadingHist] = useState(true);
  const [open, setOpen] = useState(true);

  const hasLoadedOnce = useRef(false);

  // Spinner only on the very first load; later refreshes (after an import finishes or a
  // file is removed) update the tables in place without flashing a loading state.
  const fetchHistories = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoadingHist(true);
    try {
      const queries = SLOTS.flatMap((s) => [s.dataset, ...(s.legacyDatasets || [])]);
      const results = await Promise.all(
        queries.map(async (dataset) => {
          try {
            const { data } = await api.get(`/data-upload/management-dashboard/files?dataset=${dataset}`);
            return { dataset, files: data.files || [], ok: true };
          } catch (err) {
            return { dataset, files: [], ok: false, err };
          }
        }),
      );
      if (results.every((r) => !r.ok)) {
        const first = results[0]?.err;
        throw first || new Error('Failed to load Management Dashboard uploads.');
      }
      const byDataset = Object.fromEntries(results.map((r) => [r.dataset, r.files]));
      const next = {};
      for (const s of SLOTS) {
        const merged = [s.dataset, ...(s.legacyDatasets || [])].flatMap((d) => byDataset[d] || []);
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        next[s.dataset] = merged;
      }
      setHistories(next);
      hasLoadedOnce.current = true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load Management Dashboard uploads.');
    } finally {
      setLoadingHist(false);
    }
  }, []);

  useEffect(() => {
    fetchHistories();
  }, [fetchHistories, refreshToken]);

  const handleUpload = async (slot, file) => {
    const form = new FormData();
    form.append('file', file);
    setUploadingSlot(slot);
    try {
      const { data } = await api.post(`/data-upload/management-dashboard/${slot}`, form);
      toast.success(data.message || 'Upload started.');
      // Don't refresh the history tables here — the import runs in the background.
      // The parent bumps refreshToken when the import finishes, which refreshes them.
      if (data.importJob?.jobId) {
        onImportStarted({
          jobId: data.importJob.jobId,
          type: data.importJob.type,
          filename: file.name,
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <div className="card mt-6 overflow-hidden border-indigo-200/80 shadow-sm">
      <div className={`${open ? 'border-b border-indigo-100' : ''} bg-gradient-to-r from-indigo-50 to-white px-4 py-4 sm:px-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            aria-expanded={open}
            aria-controls="data-upload-management-panel"
          >
            {open ? (
              <MdExpandMore className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            ) : (
              <MdChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MdInsights className="h-5 w-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-gray-900">Management Dashboard data</h2>
              </div>
              <p className="mt-1 max-w-2xl text-xs text-gray-600">
                Upload one indent+purchase workbook (1st sheet indent, 2nd sheet purchase) or a DMR workbook. Column names must match the template exactly; mismatches are shown in the import dialog. Each upload appends new dates; existing dates are skipped.
              </p>
            </div>
          </button>
          <Link
            to="/bi/management-dashboard"
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
          >
            Open Management Dashboard →
          </Link>
        </div>
      </div>

      {open && (
        <div id="data-upload-management-panel">
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
            {SLOTS.map((meta) => (
              <UploadCard
                key={meta.slot}
                meta={meta}
                uploading={uploadingSlot === meta.slot}
                onUpload={handleUpload}
              />
            ))}
          </div>

          <div className="space-y-6 border-t border-indigo-100 px-4 pb-6 pt-4 sm:px-6">
            {SLOTS.map((meta) => (
              <div key={meta.dataset}>
                <DataUploadHistoryTable
                  title={`${meta.label} — Upload History`}
                  files={histories[meta.dataset] || []}
                  loading={loadingHist}
                  onRefresh={fetchHistories}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
