import { useEffect, useRef, useState } from 'react';
import { MdCheckCircle, MdClose, MdError, MdHourglassEmpty } from 'react-icons/md';
import api from '../api/axios';
import Spinner from './Spinner';

const POLL_MS = 1500;

function statusLabel(status) {
  switch (status) {
    case 'queued': return 'Queued…';
    case 'running': return 'Importing…';
    case 'completed': return 'Complete';
    case 'failed': return 'Failed';
    default: return status;
  }
}

function statusIcon(status) {
  if (status === 'completed') return <MdCheckCircle className="h-5 w-5 text-emerald-600" />;
  if (status === 'failed') return <MdError className="h-5 w-5 text-red-600" />;
  if (status === 'running') return <Spinner size="sm" />;
  return <MdHourglassEmpty className="h-5 w-5 text-amber-600" />;
}

export default function ManagementDashboardImportProgressModal({
  jobId,
  filename,
  importType,
  onClose,
  onComplete,
}) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const { data } = await api.get(`/data-upload/management-dashboard-import/${jobId}`);
        if (cancelled) return;
        setJob(data);
        setError(null);

        if (data.status === 'completed' || data.status === 'failed') {
          if (!doneRef.current) {
            doneRef.current = true;
            if (onComplete) onComplete(data);
          }
          return;
        }
        timer = setTimeout(poll, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Failed to poll import status.');
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, onComplete]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [job?.logs?.length]);

  const totals = job?.totals;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Management Dashboard import</h2>
            <p className="mt-0.5 truncate text-xs text-gray-500">{filename}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex items-center gap-2">
            {statusIcon(job?.status)}
            <span className="text-sm font-bold text-gray-800">{statusLabel(job?.status)}</span>
            {importType && (
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                {importType}
              </span>
            )}
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap break-words">
              {error}
            </div>
          )}
          {job?.error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap break-words">
              {job.error}
            </div>
          )}

          {totals && (
            <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <p>Imported: <strong>{totals.imported ?? 0}</strong></p>
              <p>Skipped (existing dates): <strong>{totals.skipped ?? 0}</strong></p>
              {totals.dateMin && totals.dateMax && (
                <p>Date range in file: <strong>{totals.dateMin} → {totals.dateMax}</strong></p>
              )}
            </div>
          )}

          <div className="max-h-48 overflow-y-auto rounded border border-gray-100 bg-slate-50 p-2 font-mono text-[10px] text-gray-600">
            {(job?.logs || []).map((line, i) => (
              <div key={i} className="mb-1">
                <span className="text-gray-400">{line.at?.slice(11, 19)}</span>{' '}
                {line.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3 text-right">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
