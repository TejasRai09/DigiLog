import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import api from '../../api/axios';
import { lockedPlantForUser } from '../../utils/maintenanceNotesPlantAccess';
import Spinner from '../../components/Spinner';
import { onRealtimeEvent, EVENT_NOTIFICATION_NEW } from '../../realtime/socket';
import { NOTE_STATUS_LABEL, formatNoteWhen } from './noteStatus';
import { NoteStatusBadge } from './NoteStatusBadge';
import NoteKpiCard from './NoteKpiCard';
import NoteFilterBar from './NoteFilterBar';
import HodDecisionButtons from './HodDecisionButtons';
import { noteDocumentsForViewer } from './NoteAttachmentFields';
import ApprovalMediaAttachments from '../../components/approvals/ApprovalMediaAttachments';
import { NOTE_STATUS_STYLES } from './noteStatus';

const HOD_STATUSES = {
  approval_pending: NOTE_STATUS_LABEL.approval_pending,
  rework_required: NOTE_STATUS_LABEL.rework_required,
  completed: NOTE_STATUS_LABEL.completed,
};

function noteSubmitterLabel(item) {
  const submitter = item.submittedByName || item.createdByName || 'Employee';
  const showEmail = !(item.submittedByUserId && item.submittedByUserId !== item.createdByUserId);
  const email = showEmail ? item.createdByEmail : '';
  return email ? `${submitter} (${email})` : submitter;
}

function NotesApprovalMobileList({ items, startIndex, busy, onReview }) {
  return (
    <ul className="space-y-3 md:hidden">
      {items.map((item, index) => {
        const pill = NOTE_STATUS_STYLES[item.status] || 'bg-slate-50 text-slate-600 border-slate-200';
        return (
          <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">#{startIndex + index}</span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${pill}`}>
                    {item.statusLabel || NOTE_STATUS_LABEL[item.status] || item.status}
                  </span>
                </div>
                <h3 className="mt-2 break-words text-base font-bold text-slate-900">
                  {item.activityDescription}
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {item.activityType || item.noteId} · Complete
                </p>
                <p className="mt-1 break-words text-sm text-slate-500">
                  {item.equipmentName || 'Not linked'}
                  {item.plantLabel ? ` · ${item.plantLabel}` : ''}
                </p>
                <p className="mt-1.5 break-words text-sm text-slate-500">
                  {noteSubmitterLabel(item)}
                  {' · '}
                  {formatNoteWhen(item.submittedAt || item.createdAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReview(item)}
                className="shrink-0 text-sm font-bold text-blue-600 hover:underline disabled:opacity-50"
              >
                Review
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function MaintenanceNotesHodPanel() {
  const { user } = useAuth();
  const lockedPlant = lockedPlantForUser(user);
  const defaultFilters = useMemo(
    () => ({ status: 'approval_pending', plant: lockedPlant || '', search: '' }),
    [lockedPlant],
  );
  const [filters, setFilters] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
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
  const canReset = filters.search !== defaultFilters.search
    || (!lockedPlant && filters.plant !== defaultFilters.plant)
    || filters.status !== defaultFilters.status;

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
    setFilters(defaultFilters);
    setApplied(defaultFilters);
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

  const startIndex = ((page - 1) * (data?.limit || 20)) + 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        plantLocked={Boolean(lockedPlant)}
        plantAllLabel="All your plants"
        statuses={HOD_STATUSES}
        searchPlaceholder="Search activity, person, or note"
        onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
        onPlantChange={changePlant}
        onStatusChange={changeStatus}
        onReset={resetFilters}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-base text-slate-400">
          None
        </p>
      ) : (
        <>
          <NotesApprovalMobileList
            items={items}
            startIndex={startIndex}
            busy={busy}
            onReview={openDetail}
          />
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
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
                  const pill = NOTE_STATUS_STYLES[item.status] || 'bg-slate-50 text-slate-600 border-slate-200';
                  return (
                    <tr key={item.id} className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                      <td className="border border-slate-200 px-3 py-2.5 text-center align-top text-slate-500">
                        {startIndex + index}
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
                        {noteSubmitterLabel(item)}
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
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-end">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      ) : null}

      {rejectItem ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={() => setRejectItem(null)}>
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
        </div>,
        document.body,
      ) : null}

      {detail ? createPortal(
        <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div
            className="my-auto flex max-h-[min(100dvh-2rem,100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notes-approval-review-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.noteId}</p>
                <h3 id="notes-approval-review-title" className="text-lg font-bold text-slate-900">
                  {detail.plantLabel}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NoteStatusBadge status={detail.status} />
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  disabled={busy}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {detail.activityType ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{detail.activityType}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">{detail.activityDescription}</p>
              {detail.activityDetails ? (
                <p className="whitespace-pre-wrap text-sm text-slate-600">{detail.activityDetails}</p>
              ) : null}
              <ApprovalMediaAttachments
                photos={detail.images}
                photosLabel="Photos"
                documents={noteDocumentsForViewer(detail)}
              />
              <dl className="space-y-1 break-words text-sm text-slate-600">
                <div>Equipment: {detail.equipmentName || 'Not linked'}</div>
                <div>Created by: {detail.createdByName} · {formatNoteWhen(detail.createdAt)}</div>
                {detail.submittedAt ? <div>Submitted by: {detail.submittedByName} · {formatNoteWhen(detail.submittedAt)}</div> : null}
                {detail.completionRemarks ? <div>Completion remarks: {detail.completionRemarks}</div> : null}
                {detail.hodRemarks ? <div>HOD remarks: {detail.hodRemarks}</div> : null}
              </dl>
            </div>

            <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-4 sm:px-5">
              <HodDecisionButtons
                item={detail}
                busy={busy}
                className="flex-col-reverse sm:flex-row sm:justify-end"
                onApprove={(note) => { setDetail(null); approve(note); }}
                onReject={(note) => { openReject(note); setDetail(null); }}
              />
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="w-full rounded-lg border px-4 py-2.5 text-sm font-semibold sm:hidden"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
