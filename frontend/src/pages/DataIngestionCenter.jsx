import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  MdArrowBack,
  MdClose,
  MdDelete,
  MdDescription,
  MdDownload,
  MdUpload,
  MdVisibility,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import Spinner from '../components/Spinner';
import useAuth from '../hooks/useAuth';
import useDataUploadAccess from '../hooks/useDataUploadAccess';

const PREVIEW_MAX_ROWS = 200;

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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function parseFileToRows(blob) {
  const buf = await blob.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false });
  if (!wb.SheetNames.length) return [];
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.click();
  URL.revokeObjectURL(url);
}

const ViewFileModal = ({ file, onClose }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blob, setBlob] = useState(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setRows([]);
      setBlob(null);
      setTruncated(false);

      try {
        const { data } = await api.get(`/data-upload/files/${file.id}/download`, {
          responseType: 'blob',
        });
        if (cancelled) return;
        setBlob(data);

        const parsed = await parseFileToRows(data);
        if (cancelled) return;

        const total = parsed.length;
        if (total > PREVIEW_MAX_ROWS) {
          setRows(parsed.slice(0, PREVIEW_MAX_ROWS));
          setTruncated(true);
        } else {
          setRows(parsed);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Could not load file preview.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file.id, file.originalFilename]);

  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-5xl flex-col shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">{file.originalFilename}</h2>
            <p className="mt-1 text-xs text-gray-500">
              <span className="badge bg-emerald-50 text-emerald-800">{file.category}</span>
              <span className="mx-2 text-gray-300">·</span>
              {file.uploadedByName} · {formatIngestedAt(file.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">File is empty or could not be previewed.</p>
          ) : (
            <>
              {truncated && (
                <p className="mb-3 text-xs font-medium text-amber-700">
                  Showing first {PREVIEW_MAX_ROWS} rows. Download the file to see all data.
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-max text-left text-xs">
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={ri === 0 ? 'bg-gray-50 font-semibold text-gray-800' : 'border-t border-gray-100 text-gray-700'}
                      >
                        {Array.from({ length: colCount }, (_, ci) => (
                          <td key={ci} className="whitespace-nowrap px-3 py-2">
                            {row[ci] != null && row[ci] !== '' ? String(row[ci]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!blob}
            onClick={() => blob && triggerBlobDownload(blob, file.originalFilename)}
            className="btn-primary"
          >
            <MdDownload className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

const UploadModal = ({ onClose, onUploaded }) => {
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cat = category.trim();
    if (cat.length < 3) {
      toast.error('Category name must be at least 3 characters.');
      return;
    }
    if (!file) {
      toast.error('Choose a CSV or Excel file.');
      return;
    }

    const form = new FormData();
    form.append('category', cat);
    form.append('file', file);

    setUploading(true);
    try {
      await api.post('/data-upload', form);
      toast.success('File uploaded.');
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Upload file</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="label">Category / dataset name</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
              placeholder="e.g. Boiler Telemetry"
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className="label">File (.csv, .xlsx, .xls)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="input py-2"
              required
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                {file.name} ({formatBytes(file.size)})
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? <Spinner size="sm" /> : <MdUpload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function DataIngestionCenter() {
  const { user } = useAuth();
  const { enabled, loading: accessLoading } = useDataUploadAccess();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/data-upload/files');
      setFiles(data.files || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load uploads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) fetchFiles();
  }, [enabled, fetchFiles]);

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.originalFilename}"?`)) return;
    setDeletingId(file.id);
    try {
      await api.delete(`/data-upload/files/${file.id}`);
      toast.success('File deleted.');
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

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
          Upload CSV or Excel files with a category name. Files are stored securely and shared with everyone who has Data Upload access.
        </p>

        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          <MdArrowBack className="h-4 w-4" />
          Back to Modules
        </Link>

        <div className="card mt-6 overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-bold text-gray-900">Uploaded files</h2>
            <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary">
              <MdUpload className="h-4 w-4" />
              Upload file
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : files.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">No files uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="th">File details</th>
                    <th className="th">Category</th>
                    <th className="th">Size</th>
                    <th className="th">Ingested at</th>
                    <th className="th">Uploaded by</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => {
                    const isOwner = String(f.userId) === String(user?.id);
                    return (
                      <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <MdDescription className="h-5 w-5 shrink-0 text-emerald-600" />
                            <span className="font-medium text-gray-900">{f.originalFilename}</span>
                          </div>
                        </td>
                        <td className="td">
                          <span className="badge bg-emerald-50 text-emerald-800">{f.category}</span>
                        </td>
                        <td className="td text-gray-600">{formatBytes(f.fileSizeBytes)}</td>
                        <td className="td text-gray-600 whitespace-nowrap">{formatIngestedAt(f.createdAt)}</td>
                        <td className="td">
                          <span className="font-medium text-gray-800">{f.uploadedByName}</span>
                          <span className="block text-xs text-gray-400">{f.uploadedByEmail}</span>
                        </td>
                        <td className="td text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setViewFile(f)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800"
                            >
                              <span className="inline-flex items-center gap-0.5">
                                <MdVisibility className="h-3.5 w-3.5" />
                                View
                              </span>
                            </button>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDelete(f)}
                                disabled={deletingId === f.id}
                                className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {deletingId === f.id ? '…' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={fetchFiles}
        />
      )}

      {viewFile && (
        <ViewFileModal
          file={viewFile}
          onClose={() => setViewFile(null)}
        />
      )}
    </div>
  );
}
