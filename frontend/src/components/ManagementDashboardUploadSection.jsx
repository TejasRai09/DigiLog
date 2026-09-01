import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdInsights, MdUpload } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';

function formatBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatIngestedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SLOTS = [
  {
    slot: 'indent-purchase',
    dataset: 'centre_indent_purchase',
    legacyDatasets: ['centre_indent', 'centre_purchase'],
    label: 'Centre Indent & Purchase',
    hint: 'One file — 1st sheet: indent (Code, Center Name, Indent Date, No of Purchy, Qty in Qtls, Category). 2nd sheet: purchase (c_Code, Purchase Date, No of Purchy, Qty in Qtls, Category, Center).',
  },
  {
    slot: 'dmr',
    dataset: 'dmr_workbook',
    label: 'DMR workbook',
    hint: 'Single Sheet1 — columns must exactly match DMR template (see DMR_season 23-24.xlsx)',
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

function FileHistoryTable({ files, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }
  if (!files.length) {
    return <p className="py-4 text-center text-xs italic text-gray-400">No files uploaded yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="px-3 py-2 font-bold text-gray-600">File</th>
            <th className="px-3 py-2 font-bold text-gray-600">Uploaded</th>
            <th className="px-3 py-2 font-bold text-gray-600">Date range</th>
            <th className="px-3 py-2 font-bold text-gray-600">Rows</th>
            <th className="px-3 py-2 font-bold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id} className="border-b border-gray-50">
              <td className="px-3 py-2">
                <span className="font-medium text-gray-900">{f.originalFilename}</span>
                <span className="block text-[10px] text-gray-400">
                  {formatBytes(f.fileSizeBytes)} · {f.uploadedByName}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatIngestedAt(f.createdAt)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                {f.dateMin && f.dateMax ? `${f.dateMin} → ${f.dateMax}` : '—'}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {f.rowsImported != null ? (
                  <>
                    +{f.rowsImported}
                    {f.rowsSkipped != null ? ` / skip ${f.rowsSkipped}` : ''}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    f.importStatus === 'done'
                      ? 'bg-emerald-50 text-emerald-700'
                      : f.importStatus === 'failed'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {f.importStatus || 'pending'}
                </span>
                {f.importStatus === 'failed' && f.importError && (
                  <p className="mt-1 max-w-xs text-[10px] text-red-600 whitespace-pre-wrap break-words" title={f.importError}>
                    {f.importError}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManagementDashboardUploadSection({ onImportStarted, refreshToken = 0 }) {
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [histories, setHistories] = useState({ centre_indent_purchase: [], dmr_workbook: [] });
  const [loadingHist, setLoadingHist] = useState(true);

  const fetchHistories = useCallback(async () => {
    setLoadingHist(true);
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
      await fetchHistories();
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
      <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MdInsights className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-gray-900">Management Dashboard data</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-gray-600">
              Upload one indent+purchase workbook (1st sheet indent, 2nd sheet purchase) or a DMR workbook. Column names must match the template exactly; mismatches are shown in the import dialog. Each upload appends new dates; existing dates are skipped.
            </p>
          </div>
          <Link
            to="/bi/management-dashboard"
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
          >
            Open Management Dashboard →
          </Link>
        </div>
      </div>

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
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              {meta.label} — uploaded files
            </h3>
            <FileHistoryTable files={histories[meta.dataset] || []} loading={loadingHist} />
          </div>
        ))}
      </div>
    </div>
  );
}
