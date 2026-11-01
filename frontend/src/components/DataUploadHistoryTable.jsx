import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MdMoreVert,
  MdVisibility,
  MdFileDownload,
  MdDeleteOutline,
  MdClose,
  MdWarningAmber,
} from 'react-icons/md';
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ActionMenu({ file, onView, onDownload, onRemove }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return undefined;
    const place = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = menuRef.current?.offsetHeight || 130;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8;
      const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      setCoords({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (buttonRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
        title="Actions"
        aria-expanded={open}
      >
        <MdMoreVert className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[300] w-44 rounded-lg border border-gray-100 bg-white py-1 shadow-xl ring-1 ring-black/5 focus:outline-none text-xs"
            style={{ top: coords.top, left: coords.left }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onView(file);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
            >
              <MdVisibility className="h-4 w-4 text-blue-600" />
              <span>View Details</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDownload(file);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
            >
              <MdFileDownload className="h-4 w-4 text-emerald-600" />
              <span>Download</span>
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove(file);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
            >
              <MdDeleteOutline className="h-4 w-4 text-red-600" />
              <span>Remove & Undo</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

function ViewFileModal({ file, onClose, onDownload }) {
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <MdVisibility className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-gray-900">File Ingestion Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-[11px] font-semibold uppercase text-gray-500">Original Filename</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900 break-all">{file.originalFilename}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500">File Size</p>
              <p className="mt-0.5 text-gray-800">{formatBytes(file.fileSizeBytes)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">MIME / Type</p>
              <p className="mt-0.5 text-gray-800">{file.mimeType || 'application/vnd.ms-excel'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Uploaded By</p>
              <p className="mt-0.5 font-medium text-gray-900">{file.uploadedByName || 'Unknown'}</p>
              <p className="text-[10px] text-gray-500">{file.uploadedByEmail || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Uploaded At</p>
              <p className="mt-0.5 text-gray-800">{formatIngestedAt(file.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Category / Dataset</p>
              <p className="mt-0.5 font-medium text-gray-800">{file.dataset || file.category || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500">Import Status</p>
              <span
                className={`mt-0.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  file.importStatus === 'done'
                    ? 'bg-emerald-50 text-emerald-700'
                    : file.importStatus === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {file.importStatus || 'pending'}
              </span>
            </div>
          </div>

          {(file.rowsImported != null || file.dateMin || file.dateMax) && (
            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-500">Rows Ingested</p>
                <p className="mt-0.5 text-gray-800 font-semibold">
                  +{file.rowsImported || 0}
                  {file.rowsSkipped != null ? ` (skipped ${file.rowsSkipped})` : ''}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500">Date Coverage</p>
                <p className="mt-0.5 text-gray-800">
                  {file.dateMin && file.dateMax ? `${file.dateMin} → ${file.dateMax}` : '—'}
                </p>
              </div>
            </div>
          )}

          {file.sheetDetails && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-2">
                Sheet-Wise Bifurcation
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white p-2.5 border border-indigo-100 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Sheet 1: Indent</span>
                  </div>
                  <p className="text-gray-600 text-[11px]">Rows: <strong className="text-gray-900">+{file.sheetDetails.indent?.rows?.toLocaleString() ?? 0}</strong></p>
                  <p className="text-gray-600 text-[11px] mt-1">Date: <span className="font-medium text-gray-800">{file.sheetDetails.indent?.dateMin && file.sheetDetails.indent?.dateMax ? `${file.sheetDetails.indent.dateMin} → ${file.sheetDetails.indent.dateMax}` : '—'}</span></p>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-purple-100 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Sheet 2: Purchase</span>
                  </div>
                  <p className="text-gray-600 text-[11px]">Rows: <strong className="text-gray-900">+{file.sheetDetails.purchase?.rows?.toLocaleString() ?? 0}</strong></p>
                  <p className="text-gray-600 text-[11px] mt-1">Date: <span className="font-medium text-gray-800">{file.sheetDetails.purchase?.dateMin && file.sheetDetails.purchase?.dateMax ? `${file.sheetDetails.purchase.dateMin} → ${file.sheetDetails.purchase.dateMax}` : '—'}</span></p>
                </div>
              </div>
            </div>
          )}

          {file.importError && (
            <div className="rounded-lg bg-red-50 p-3 text-red-700">
              <p className="font-bold">Error Message:</p>
              <p className="mt-1 break-words">{file.importError}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onDownload(file)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
          >
            <MdFileDownload className="h-4 w-4" />
            Download File
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({ file, onConfirm, onCancel, deleting }) {
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <MdWarningAmber className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Remove File & Undo Data</h3>
            <p className="mt-2 text-xs text-gray-600">
              Are you sure you want to remove <strong className="text-gray-900">{file.originalFilename}</strong>?
            </p>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">⚠️ Automatic Data Undo:</p>
              <p className="mt-1">
                Removing this file will delete it from storage and <strong>undo / roll back all database records</strong> that were imported by this file.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => onConfirm(file)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 shadow-sm"
          >
            {deleting ? <Spinner size="sm" /> : <MdDeleteOutline className="h-4 w-4" />}
            {deleting ? 'Undoing changes…' : 'Yes, Remove & Undo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DataUploadHistoryTable({
  files = [],
  loading = false,
  onRefresh,
  title = 'File Upload History',
  showDateRange = true,
  showRows = true,
}) {
  const [viewingFile, setViewingFile] = useState(null);
  const [removingFile, setRemovingFile] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async (file) => {
    try {
      const response = await api.get(`/data-upload/files/${file.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.originalFilename || 'download.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download started.');
    } catch (err) {
      toast.error('Failed to download file.');
    }
  };

  const handleRemoveConfirm = async (file) => {
    setDeleting(true);
    try {
      const { data } = await api.delete(`/data-upload/files/${file.id}`);
      toast.success(data.message || 'File removed and imported changes undone.');
      setRemovingFile(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove file.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h4>
        <span className="text-xs text-gray-500">{files.length} record(s)</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      ) : !files.length ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs italic text-gray-400">
          No files uploaded yet in this section.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200/90 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/90">
                <th className="px-3.5 py-2.5 font-bold text-gray-700">File</th>
                <th className="px-3.5 py-2.5 font-bold text-gray-700">Uploaded</th>
                <th className="px-3.5 py-2.5 font-bold text-gray-700">Uploaded by</th>
                {showDateRange && <th className="px-3.5 py-2.5 font-bold text-gray-700">Date range</th>}
                {showRows && <th className="px-3.5 py-2.5 font-bold text-gray-700">Rows</th>}
                <th className="px-3.5 py-2.5 font-bold text-gray-700">Status</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-3.5 py-2.5">
                    <span className="font-semibold text-gray-900 block max-w-xs truncate" title={f.originalFilename}>
                      {f.originalFilename}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatBytes(f.fileSizeBytes)}
                      {f.purchySlot ? ` · ${f.purchySlot}` : f.dataset ? ` · ${f.dataset}` : ''}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-600">
                    {formatIngestedAt(f.createdAt)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className="font-medium text-gray-900 block">{f.uploadedByName || 'User'}</span>
                    <span className="text-[10px] text-gray-400 block">{f.uploadedByEmail || ''}</span>
                  </td>
                  {showDateRange && (
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-600">
                      {f.sheetDetails ? (
                        <div className="space-y-1 text-[11px] leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 border border-indigo-200">
                              Indent
                            </span>
                            <span className="font-medium text-gray-800">
                              {f.sheetDetails.indent?.dateMin && f.sheetDetails.indent?.dateMax
                                ? `${f.sheetDetails.indent.dateMin} → ${f.sheetDetails.indent.dateMax}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 border border-purple-200">
                              Purchase
                            </span>
                            <span className="font-medium text-gray-800">
                              {f.sheetDetails.purchase?.dateMin && f.sheetDetails.purchase?.dateMax
                                ? `${f.sheetDetails.purchase.dateMin} → ${f.sheetDetails.purchase.dateMax}`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      ) : f.dateMin && f.dateMax ? (
                        `${f.dateMin} → ${f.dateMax}`
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  {showRows && (
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-600">
                      {f.sheetDetails ? (
                        <div className="space-y-1 text-[11px] leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 border border-indigo-200">
                              Indent
                            </span>
                            <span className="font-semibold text-gray-900">
                              +{f.sheetDetails.indent?.rows?.toLocaleString() ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block rounded bg-purple-50 px-1 py-0.5 text-[9px] font-semibold text-purple-700 border border-purple-200">
                              Purchase
                            </span>
                            <span className="font-semibold text-gray-900">
                              +{f.sheetDetails.purchase?.rows?.toLocaleString() ?? 0}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium pt-0.5 border-t border-gray-100">
                            Total: +{(f.rowsImported ?? 0).toLocaleString()}
                          </div>
                        </div>
                      ) : f.rowsImported != null ? (
                        <>
                          <span className="font-semibold text-gray-900">+{f.rowsImported.toLocaleString()}</span>
                          {f.rowsSkipped != null && f.rowsSkipped > 0 ? (
                            <span className="text-gray-400"> / skip {f.rowsSkipped}</span>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        f.importStatus === 'done'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : f.importStatus === 'failed'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {f.importStatus || 'pending'}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <ActionMenu
                      file={f}
                      onView={(file) => setViewingFile(file)}
                      onDownload={handleDownload}
                      onRemove={(file) => setRemovingFile(file)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingFile && (
        <ViewFileModal
          file={viewingFile}
          onClose={() => setViewingFile(null)}
          onDownload={handleDownload}
        />
      )}

      {removingFile && (
        <RemoveConfirmModal
          file={removingFile}
          deleting={deleting}
          onCancel={() => setRemovingFile(null)}
          onConfirm={handleRemoveConfirm}
        />
      )}
    </div>
  );
}

