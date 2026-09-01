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

export default function PurchyImportProgressModal({
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
        const { data } = await api.get(`/data-upload/purchy-import/${jobId}`);
        if (cancelled) return;
        setJob(data);
        setError(null);

        if (data.status === 'completed' || data.status === 'failed') {
          if (!doneRef.current) {
            doneRef.current = true;
            if (data.status === 'completed' && onComplete) onComplete(data);
          }
          return;
        }
        timer = setTimeout(poll, POLL_MS);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Could not load import status.');
        }
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

  const finished = job?.status === 'completed' || job?.status === 'failed';
  const title = importType === 'staff' ? 'Purchy staff import' : 'Purchy grower import';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="mt-0.5 truncate text-xs text-gray-500">{filename}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!finished}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close"
            title={finished ? 'Close' : 'Wait for import to finish'}
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-gray-100 px-6 py-3">
          <div className="flex items-center gap-2">
            {statusIcon(job?.status || 'queued')}
            <span className="text-sm font-semibold text-gray-800">
              {statusLabel(job?.status || 'queued')}
            </span>
          </div>
          {job?.totals && job.status === 'completed' && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
              <div><dt className="inline font-medium">Summary: </dt><dd className="inline tabular-nums">{job.totals.summary?.toLocaleString()}</dd></div>
              <div><dt className="inline font-medium">Indent: </dt><dd className="inline tabular-nums">{job.totals.indent?.toLocaleString()}</dd></div>
              <div><dt className="inline font-medium">Supply: </dt><dd className="inline tabular-nums">{job.totals.supply?.toLocaleString()}</dd></div>
              <div><dt className="inline font-medium">Dishonour: </dt><dd className="inline tabular-nums">{job.totals.dishonour?.toLocaleString()}</dd></div>
              {job.totals.staff > 0 && (
                <div className="col-span-2"><dt className="inline font-medium">Staff: </dt><dd className="inline tabular-nums">{job.totals.staff?.toLocaleString()}</dd></div>
              )}
            </dl>
          )}
          {job?.error && (
            <p className="mt-2 text-sm text-red-600">{job.error}</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Progress</p>
          <ul className="space-y-1.5 text-xs text-gray-700">
            {(job?.logs || []).map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="leading-snug">
                <span className="text-gray-400">{entry.at ? new Date(entry.at).toLocaleTimeString() : ''}</span>
                {' '}
                {entry.message}
              </li>
            ))}
            {!job?.logs?.length && (
              <li className="text-gray-400">Waiting for import to start…</li>
            )}
          </ul>
          <div ref={logEndRef} />
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={!finished}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finished ? 'Done' : 'Importing…'}
          </button>
        </div>
      </div>
    </div>
  );
}
