import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import { onRealtimeEvent, EVENT_NOTIFICATION_NEW } from '../../realtime/socket';
import { NOTE_STATUS_LABEL, formatNoteWhen } from './noteStatus';
import { NoteStatusBadge } from './NoteStatusBadge';
import NoteKpiCard from './NoteKpiCard';
import NoteFilterBar from './NoteFilterBar';
import HodDecisionButtons from './HodDecisionButtons';
import { downloadNoteDocument } from './NoteAttachmentFields';
import { NOTE_STATUS_STYLES } from './noteStatus';

const HOD_STATUSES = {
  approval_pending: NOTE_STATUS_LABEL.approval_pending,
  rework_required: NOTE_STATUS_LABEL.rework_required,
  completed: NOTE_STATUS_LABEL.completed,
};

const DEFAULT_FILTERS = { status: 'approval_pending', plant: '', search: '' };

export default function MaintenanceNotesHodPanel() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const params = { page, limit: 20 };
      Object.entries(applied).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data: payload } = await api.get('/maintenance-notes/hod', { params });
      setData(payload);
    } catch (err) {
      if (!quiet) toast.error(err.response?.data?.message || 'Failed to load maintenance notes for review.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => onRealtimeEvent(EVENT_NOTIFICATION_NEW, (payload) => {
    if (payload?.type === 'mn_pending_hod') load({ quiet: true });
  }), [load]);

  useEffect(() => {
    if (applied.search === filters.search) return undefined;
    const timer = setTimeout(() => {
      setApplied((current) => ({ ...current, search: filters.search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search, applied.search]);

  const items = data?.items || [];
  const summary = data?.summary || {};
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 20)));
  const canReset = filters.search !== DEFAULT_FILTERS.search
    || filters.plant !== DEFAULT_FILTERS.plant
    || filters.status !== DEFAULT_FILTERS.status;

  const changePlant = (plant) => {
    setFilters((f) => ({ ...f, plant }));
    setApplied((f) => ({ ...f, plant }));
    setPage(1);
  };

  const changeStatus = (status) => {
    setFilters((f) => ({ ...f, status }));
    setApplied((f) => ({ ...f, status }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setPage(1);
  };

  const openReject = (item) => {
    setRejectItem(item);
    setRejectReason('');
  };

  const openDetail = async (item) => {
    try {
      const { data } = await api.get(`/maintenance-notes/${item.id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open this note.');
    }
  };

  const approve = async (item) => {
    setBusy(true);
    try {
      await api.post(`/maintenance-notes/${item.id}/approve`);
      toast.success(`${item.noteId} marked Completed.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not approve.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async (e) => {
    e.preventDefault();
    if (!rejectItem) return;
    setBusy(true);
    try {
      await api.post(`/maintenance-notes/${rejectItem.id}/reject`, { remarks: rejectReason });
      toast.success(`${rejectItem.noteId} sent back for rework.`);
      setRejectItem(null);
      setRejectReason('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-13rem)]">
      <div className="shrink-0 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['approval_pending', 'Awaiting you'],
          ['rework_required', 'Rework'],
          ['completed', 'Completed'],
        ].map(([key, label]) => (
          <NoteKpiCard
            key={key}
            status={key}
            label={label}
            value={summary[key] || 0}
            active={applied.status === key}
            onClick={() => {
              setFilters((f) => ({ ...f, status: key }));
              setApplied((f) => ({ ...f, status: key }));
              setPage(1);
            }}
          />
        ))}
      </div>

      <NoteFilterBar
        search={filters.search}
        plant={filters.plant}
        status={filters.status}
        canReset={canReset}
        plantAllLabel="All your plants"
        statuses={HOD_STATUSES}
        searchPlaceholder="Search activity, person, or note"
        onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
        onPlantChange={changePlant}
        onStatusChange={changeStatus}
        onReset={resetFilters}
      />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-base text-slate-400">
          None
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th className="w-12 border border-blue-800 px-3 py-2.5 text-center font-semibold">#</th>
                <th className="border border-blue-800 px-3 py-2.5 font-semibold">Activity</th>
                <th className="border border-blue-800 px-3 py-2.5 font-semibold">Equipment</th>
                <th className="border border-blue-800 px-3 py-2.5 font-semibold">Action</th>
                <th className="border border-blue-800 px-3 py-2.5 font-semibold">Status</th>
                <th className="border border-blue-800 px-3 py-2.5 font-semibold">Created at</th>
                <th className="border border-blue-800 px-3 py-2.5 font-semibold">Submitted by</th>
                <th className="border border-blue-800 px-3 py-2.5 text-center font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const submitter = item.submittedByName || item.createdByName || 'Employee';
                const submitterEmail = item.submittedByUserId && item.submittedByUserId !== item.createdByUserId
                  ? ''
                  : item.createdByEmail;
                const rowNumber = ((page - 1) * (data?.limit || 20)) + index + 1;
                const pill = NOTE_STATUS_STYLES[item.status] || 'bg-slate-50 text-slate-600 border-slate-200';
                return (
                  <tr key={item.id} className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                    <td className="border border-slate-200 px-3 py-2.5 text-center align-top text-slate-500">
                      {rowNumber}
                    </td>
                    <td className="max-w-[16rem] break-words border border-slate-200 px-3 py-2.5 align-top font-bold text-slate-900">
                      {item.activityDescription}
                      <div className="mt-1 text-xs font-semibold text-slate-400">
                        {item.activityType || item.noteId}
                      </div>
                    </td>
                    <td className="min-w-[12rem] max-w-[22rem] break-words border border-slate-200 px-3 py-2.5 align-top text-slate-600">
                      {item.equipmentName || 'Not linked'}
                      <div className="mt-1 text-xs font-semibold text-slate-400">{item.plantLabel}</div>
                    </td>
                    <td className="whitespace-nowrap border border-slate-200 px-3 py-2.5 align-top text-slate-700">
                      Complete
                    </td>
                    <td className="border border-slate-200 px-3 py-2.5 align-top">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide sm:text-sm ${pill}`}>
                        {item.statusLabel || NOTE_STATUS_LABEL[item.status] || item.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border border-slate-200 px-3 py-2.5 align-top text-slate-600">
                      {formatNoteWhen(item.submittedAt || item.createdAt)}
                    </td>
                    <td className="max-w-[14rem] break-words border border-slate-200 px-3 py-2.5 align-top text-slate-600">
                      {submitterEmail ? `${submitter} (${submitterEmail})` : submitter}
                    </td>
                    <td className="border border-slate-200 px-3 py-2.5 text-center align-top">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openDetail(item)}
                        className="text-sm font-bold text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-end">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      ) : null}
      </div>

      {rejectItem ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={() => setRejectItem(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={reject}
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <h2 className="text-lg font-bold text-slate-900">Send back for rework</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rejectItem.noteId} will return to Rework Required. The team can fix it and submit again.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">Reason (required)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="What still needs to be done or clarified?"
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setRejectItem(null)} className="w-full rounded-lg border px-4 py-2.5 text-sm font-semibold sm:w-auto">Cancel</button>
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
                Reject
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.noteId}</p>
                <h2 className="text-lg font-bold text-slate-900">{detail.plantLabel}</h2>
              </div>
              <NoteStatusBadge status={detail.status} />
            </div>
            {detail.activityType ? (
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.activityType}</p>
            ) : null}
            <p className={`${detail.activityType ? 'mt-1' : 'mt-4'} whitespace-pre-wrap text-sm font-medium text-slate-800`}>{detail.activityDescription}</p>
            {detail.activityDetails ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{detail.activityDetails}</p>
            ) : null}
            {detail.images?.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {detail.images.map((img, index) => (
                  <img key={index} src={img} alt="" className="aspect-square w-full rounded-xl border border-slate-200 object-cover" />
                ))}
              </div>
            ) : null}
            {detail.documents?.length ? (
              <ul className="mt-4 space-y-1 text-sm">
                {detail.documents.map((doc) => (
                  <li key={doc.storageKey}>
                    <button
                      type="button"
                      className="font-medium text-blue-700 hover:underline"
                      onClick={() => downloadNoteDocument(detail.id, doc).catch(() => toast.error('Could not download the document.'))}
                    >
                      {doc.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="mt-4 space-y-1 text-sm">
              <div>Equipment: {detail.equipmentName || 'Not linked'}</div>
              <div>Created by: {detail.createdByName} · {formatNoteWhen(detail.createdAt)}</div>
              {detail.submittedAt ? <div>Submitted by: {detail.submittedByName} · {formatNoteWhen(detail.submittedAt)}</div> : null}
              {detail.completionRemarks ? <div>Completion remarks: {detail.completionRemarks}</div> : null}
              {detail.hodRemarks ? <div>HOD remarks: {detail.hodRemarks}</div> : null}
            </dl>
            <HodDecisionButtons
              item={detail}
              busy={busy}
              className="mt-5"
              onApprove={(note) => { setDetail(null); approve(note); }}
              onReject={(note) => { openReject(note); setDetail(null); }}
            />
            <div className="mt-2">
              <button type="button" onClick={() => setDetail(null)} className="w-full rounded-lg border px-4 py-2.5 text-sm font-semibold sm:w-auto">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
