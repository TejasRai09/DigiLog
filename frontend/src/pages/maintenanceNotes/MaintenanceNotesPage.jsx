import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import api from '../../api/axios';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppPageHeader from '../../components/AppPageHeader';
import Spinner from '../../components/Spinner';
import { DASHBOARD_CRUMB } from '../../utils/breadcrumbTrail';
import { isStagingEnv } from '../../utils/appEnv';
import { onRealtimeEvent, EVENT_NOTIFICATION_NEW } from '../../realtime/socket';
import NoteFormModal from './NoteFormModal';
import SubmitNoteModal from './SubmitNoteModal';
import { formatNoteWhen } from './noteStatus';
import { NoteStatusBadge } from './NoteStatusBadge';
import NoteKpiCard from './NoteKpiCard';
import CardOverflowMenu from '../../components/CardOverflowMenu';
import MaintenanceNoteMobileList from './MaintenanceNoteMobileList';
import NoteFilterBar from './NoteFilterBar';
import { MdEdit, MdSend, MdVisibility } from 'react-icons/md';
import { downloadNoteDocument } from './NoteAttachmentFields';

const EMPTY_FILTERS = { status: '', plant: '', search: '' };
const PAGE_HEIGHT = isStagingEnv()
  ? 'h-[calc(100dvh-5.75rem)] sm:h-[calc(100dvh-6.5rem)]'
  : 'h-[calc(100dvh-3.75rem)] sm:h-[calc(100dvh-4rem)]';

export default function MaintenanceNotesPage() {
  const { user } = useAuth();
  const viewOnly = Boolean(user?.formsHubViewOnly);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const params = { page, limit: 20 };
      Object.entries(applied).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data: payload } = await api.get('/maintenance-notes', { params });
      setData(payload);
    } catch (err) {
      if (!quiet) toast.error(err.response?.data?.message || 'Failed to load maintenance notes.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => onRealtimeEvent(EVENT_NOTIFICATION_NEW, (payload) => {
    if (payload?.type === 'mn_approved' || payload?.type === 'mn_rework') load({ quiet: true });
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
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 20)));
  const summary = data?.summary || {};
  const canReset = Boolean(filters.search || filters.plant || filters.status);

  const toggleStatus = (key) => {
    setFilters((f) => ({ ...f, status: f.status === key ? '' : key }));
    setApplied((f) => ({ ...f, status: f.status === key ? '' : key }));
    setPage(1);
  };

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
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const openNote = async (item, mode) => {
    try {
      const { data } = await api.get(`/maintenance-notes/${item.id}`);
      if (mode === 'edit') {
        setEditing(data);
        setFormOpen(true);
      } else {
        setDetail(data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open this note.');
    }
  };

  const actionItems = (item) => ([
    { label: 'View', icon: MdVisibility, onClick: () => openNote(item, 'view') },
    { label: 'Edit', icon: MdEdit, hidden: !item.canEdit, onClick: () => openNote(item, 'edit') },
    { label: 'Submit', icon: MdSend, hidden: !item.canSubmit, onClick: () => setSubmitting(item) },
  ]);

  const addNoteButton = (className) => (
    viewOnly ? null : (
      <button
        type="button"
        onClick={() => { setEditing(null); setFormOpen(true); }}
        className={className}
      >
        Add note
      </button>
    )
  );

  return (
    <main className={`app-main flex min-h-0 flex-col overflow-hidden !py-3 ${PAGE_HEIGHT}`}>
      <div className="shrink-0 space-y-3">
        <AppBreadcrumb
          bleed={false}
          className="mb-0"
          items={[DASHBOARD_CRUMB, { label: 'Maintenance Notes' }]}
        />
        <AppPageHeader className="mb-0 !static !left-auto !w-full !max-w-none !translate-x-0 !px-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">Maintenance Notes</h1>
          <p className="mt-1 hidden max-w-2xl text-sm font-medium leading-relaxed text-slate-700 sm:block">
            Shared register of work the plant intends to carry out. Anyone can add a note.
            Completed is set only after the plant HOD approves.
          </p>
        </AppPageHeader>

        {viewOnly ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You have view-only access. You can read the register but cannot add or submit notes.
          </p>
        ) : null}

        <div className="md:hidden">
          {addNoteButton('w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm')}
        </div>

        <div className="grid grid-cols-2 gap-2 md:hidden">
          {[
            ['pending', 'Pending'],
            ['approval_pending', 'Awaiting HOD'],
            ['rework_required', 'Rework'],
            ['completed', 'Completed'],
          ].map(([key, label]) => (
            <NoteKpiCard
              key={key}
              status={key}
              label={label}
              value={summary[key] || 0}
              active={applied.status === key}
              onClick={() => toggleStatus(key)}
            />
          ))}
        </div>

        <div className="hidden grid-cols-4 items-end gap-2 md:grid">
          {[
            ['pending', 'Pending'],
            ['approval_pending', 'Awaiting HOD'],
            ['rework_required', 'Rework'],
          ].map(([key, label]) => (
            <NoteKpiCard
              key={key}
              status={key}
              label={label}
              value={summary[key] || 0}
              active={applied.status === key}
              onClick={() => toggleStatus(key)}
            />
          ))}
          <div className="flex flex-col">
            {addNoteButton('mb-4 w-fit self-end rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm lg:px-10 lg:py-4 lg:text-lg')}
            <NoteKpiCard
              status="completed"
              label="Completed"
              value={summary.completed || 0}
              active={applied.status === 'completed'}
              onClick={() => toggleStatus('completed')}
              className="w-full"
            />
          </div>
        </div>

        <NoteFilterBar
          search={filters.search}
          plant={filters.plant}
          status={filters.status}
          canReset={canReset}
          onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
          onPlantChange={changePlant}
          onStatusChange={changeStatus}
          onReset={resetFilters}
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
            No maintenance notes match these filters.
          </div>
        ) : (
          <>
            <MaintenanceNoteMobileList items={items} actionItems={actionItems} />
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3">Plant</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Created by</th>
                    <th className="px-4 py-3">Created at</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{item.noteId}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">{item.plantLabel}</td>
                      <td className="px-4 py-3 text-slate-800">{item.equipmentName || '—'}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">
                        {item.activityType ? (
                          <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.activityType}</span>
                        ) : null}
                        <span className="line-clamp-2">{item.activityDescription}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">{item.createdByName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatNoteWhen(item.createdAt)}</td>
                      <td className="px-4 py-3"><NoteStatusBadge status={item.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex justify-end">
                          <CardOverflowMenu title="Actions" items={actionItems(item)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-end">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
          </div>
        ) : null}
      </div>

      <NoteFormModal
        open={formOpen}
        note={editing}
        viewOnly={false}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={load}
      />
      <SubmitNoteModal note={submitting} onClose={() => setSubmitting(null)} onDone={load} />

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
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm">
              <div><span className="text-slate-500">Equipment: </span>{detail.equipmentName || 'Not linked'}</div>
              <div><span className="text-slate-500">Created by: </span>{detail.createdByName} · {formatNoteWhen(detail.createdAt)}</div>
              {detail.submittedAt ? (
                <div><span className="text-slate-500">Submitted by: </span>{detail.submittedByName} · {formatNoteWhen(detail.submittedAt)}</div>
              ) : null}
              {detail.completionRemarks ? (
                <div><span className="text-slate-500">Completion remarks: </span>{detail.completionRemarks}</div>
              ) : null}
              {detail.hodDecisionAt ? (
                <div>
                  <span className="text-slate-500">HOD decision: </span>
                  {detail.hodDecision === 'approved' ? 'Approved' : 'Rejected'} by {detail.hodName} · {formatNoteWhen(detail.hodDecisionAt)}
                </div>
              ) : null}
              {detail.hodRemarks ? (
                <div className="rounded-lg bg-orange-50 px-3 py-2 text-orange-900">
                  <span className="font-semibold">HOD remarks: </span>{detail.hodRemarks}
                </div>
              ) : null}
            </dl>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDetail(null)} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold sm:w-auto">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
