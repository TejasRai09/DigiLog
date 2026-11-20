import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MdOpenInNew, MdTableChart, MdDownload,
  MdClose, MdChevronLeft, MdChevronRight,
  MdArrowDownward, MdArrowUpward, MdUnfoldMore,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';
import useAuth from '../hooks/useAuth';
import useFormsHubViewOnly from '../hooks/useFormsHubViewOnly';
import { useAppName } from '../hooks/useAppName';
import { getDisplayColumns, headingRuns, headerLabel, formatRecordCellForDisplay, getRecordFileSlot, isRecordFileColumn } from '../config/formColumnSchemas';
import {
  RecordActionsButton,
  RecordRowActionMenu,
  RecordViewModal,
  RecordEditModal,
  DeleteRecordConfirmModal,
  EditRequestReviewModal,
  FormFileSlotCell,
  recordKeyFromRow,
} from './FormRecordAdminModals';
import { withoutGsmaLabel } from '../utils/displayLabels';
import { isSimpleOpenForm, openFormTarget } from '../utils/formTableNav';
import { trackFormDataAction } from '../utils/trackActivity';
import FormCardList from './FormCardList';

const escapeCsvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const downloadCSV = (filename, rows, columns, formKey = null) => {
  if (!rows.length) { toast.error('No data to download.'); return false; }
  const headerLine = columns.map(headerLabel).map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) =>
    columns.map(({ dbKey }) =>
      escapeCsvCell(formatRecordCellForDisplay(dbKey, row[dbKey], formKey, row)),
    ).join(','),
  );
  const csv = [headerLine, ...dataLines].join('\r\n');

  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
};

function approvalBadge(row) {
  if (!row?.pendingRequestId) return null;
  if (row.pendingStatus === 'needs_modification') {
    return (
      <span className="ml-1 inline-flex rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700">
        Needs modification
      </span>
    );
  }
  if (row.pendingStatus === 'resubmitted') {
    return (
      <span className="ml-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
        Resubmitted
      </span>
    );
  }
  return (
    <span className="ml-1 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
      Pending HOD approval
    </span>
  );
}

function editRequestBadge(row) {
  if (!row?.editRequestId) return null;
  return (
    <span className="ml-1 inline-flex rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">
      Edit request pending
    </span>
  );
}

function rowEmphasisClass(row, isFocus) {
  if (isFocus) return 'bg-amber-50 ring-2 ring-inset ring-amber-400';
  if (!row?.pendingRequestId) return 'hover:bg-gray-50';
  if (row.pendingStatus === 'needs_modification') return 'bg-orange-50/90 hover:bg-orange-50';
  return 'bg-amber-50/90 hover:bg-amber-50';
}

function stickyActionsClass(row, isFocus) {
  if (isFocus) return 'bg-amber-50';
  if (!row?.pendingRequestId) return 'bg-white';
  if (row.pendingStatus === 'needs_modification') return 'bg-orange-50/90';
  return 'bg-amber-50/90';
}

// ─── View Data Modal ──────────────────────────────────────────
const ViewDataModal = ({ form, onClose, appName = null, appId = null, focusApprovalRequestId = null, focusRecordTs = null }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const viewOnly = useFormsHubViewOnly();

  const [page, setPage]       = useState(1);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [highlightedRequestId, setHighlightedRequestId] = useState(
    focusApprovalRequestId ? Number(focusApprovalRequestId) : null,
  );
  const [highlightedRecordTs, setHighlightedRecordTs] = useState(focusRecordTs || null);
  const [dateSort, setDateSort] = useState(null);
  const focusHandledRef = useRef(null);
  const LIMIT = 20;
  const tsCol = data?.tsCol || 'timestamp';

  const recordsUrl = (p, focus, sortDir) => {
    const sortQuery = sortDir === 'asc' || sortDir === 'desc' ? `&sort=date_${sortDir}` : '';
    const focusQuery = focus ? `&focus=${encodeURIComponent(focus)}` : '';
    return `/forms/${form.formKey}/records?page=${p}&limit=${LIMIT}${sortQuery}${focusQuery}`;
  };

  const canEditRow = (row) => {
    if (viewOnly) return false;
    if (row?.pendingRequestId) return row.pendingStatus === 'needs_modification';
    return isAdmin;
  };
  const canDeleteRow = (row) => isAdmin && !viewOnly && !row?.pendingRequestId;
  const canEditRequestRow = (row) => (
    !isAdmin && !viewOnly && !row?.pendingRequestId && !row?.editRequestId
  );
  const showRowActions = () => !viewOnly;
  const showActionsCol = !viewOnly;

  const fetchPage = async (p, focus, sortDir = dateSort) => {
    setLoading(true);
    try {
      const { data: res } = await api.get(recordsUrl(p, focus, sortDir));
      const nextPage = focus && res.focusPage && res.focusPage !== p ? res.focusPage : p;
      if (nextPage !== p) {
        const { data: focused } = await api.get(recordsUrl(nextPage, null, sortDir));
        setData(focused);
        setPage(nextPage);
      } else {
        setData(res);
        setPage(p);
      }
    } catch {
      toast.error('Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSamplingDateSort = () => {
    const next = dateSort === 'desc' ? 'asc' : 'desc';
    setDateSort(next);
    fetchPage(1, null, next);
  };

  useEffect(() => { fetchPage(1, focusRecordTs); }, []);

  useEffect(() => {
    const focusId = Number(focusApprovalRequestId);
    if (!focusId || Number.isNaN(focusId) || !data?.records) return;
    if (focusHandledRef.current === focusId) return;
    const row = data.records.find((r) => Number(r.pendingRequestId) === focusId);
    if (!row) return;
    focusHandledRef.current = focusId;
    setHighlightedRequestId(focusId);
    if (row.pendingStatus === 'needs_modification' && !viewOnly) {
      setEditRow(row);
    }
  }, [data, focusApprovalRequestId, viewOnly]);

  useEffect(() => {
    if (!focusRecordTs || !data?.records) return;
    const match = data.records.find((row) => String(row[tsCol] || '').slice(0, 19) === String(focusRecordTs).slice(0, 19));
    if (!match) return;
    setHighlightedRecordTs(String(focusRecordTs).slice(0, 19));
  }, [data, focusRecordTs, tsCol]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;
  const sample      = data?.records?.[0] ?? null;
  const columns     = getDisplayColumns(form.formKey, sample);

  const openRowMenu = (e, row) => {
    const r = e.currentTarget.getBoundingClientRect();
    const menuH = 140;
    let top = r.bottom + 4;
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, r.top - menuH - 4);
    }
    const useLeft = window.innerWidth < 640;
    setRowMenu({
      row,
      top,
      left: useLeft ? Math.max(8, Math.min(r.left, window.innerWidth - 200)) : undefined,
      right: useLeft ? undefined : window.innerWidth - r.right,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-data-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close records"
        onClick={onClose}
      />

      <div className="relative flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)]">

        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 id="view-data-modal-title" className="text-base font-semibold leading-snug text-gray-900 sm:text-lg">
              {withoutGsmaLabel(form.name)} — Records
            </h2>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5">{data.total} total row{data.total !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  toast.loading('Preparing CSV…', { id: 'csv' });
                  const sortQuery = dateSort === 'asc' || dateSort === 'desc' ? `&sort=date_${dateSort}` : '';
                  const { data: res } = await api.get(
                    `/forms/${form.formKey}/records?page=1&limit=10000${sortQuery}`
                  );
                  const cols = getDisplayColumns(form.formKey, res.records?.[0] ?? null);
                  const ok = downloadCSV(`${form.formKey}.csv`, res.records, cols, form.formKey);
                  if (ok) {
                    trackFormDataAction({
                      event_type: 'download_csv',
                      form,
                      appName,
                      appId,
                    });
                    toast.success('Downloaded!', { id: 'csv' });
                  } else {
                    toast.dismiss('csv');
                  }
                } catch {
                  toast.error('Download failed.', { id: 'csv' });
                }
              }}
              className="btn-secondary text-xs py-1.5"
            >
              <MdDownload className="h-3.5 w-3.5" />
              Download CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <MdClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : !data?.records?.length ? (
            <div className="text-center py-20 text-gray-400 text-sm">No records found.</div>
          ) : (
            <table className="w-max min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  {headingRuns(columns).map((run) => (
                    <th
                      key={run.start}
                      colSpan={run.colSpan}
                      className="px-3 py-2 text-center font-semibold text-gray-600 tracking-wide border-b border-gray-200"
                    >
                      {run.heading}
                    </th>
                  ))}
                  {showActionsCol && (
                    <th
                      rowSpan={2}
                      className="sticky right-0 z-20 border-b border-l border-gray-200 bg-gray-50 px-3 py-2 text-center font-semibold text-gray-600"
                    >
                      Actions
                    </th>
                  )}
                </tr>
                <tr className="border-b border-gray-200">
                  {columns.map((col) => (
                    <th
                      key={col.dbKey}
                      aria-sort={
                        col.subheading === 'Sampling Date'
                          ? (dateSort === 'asc' ? 'ascending' : dateSort === 'desc' ? 'descending' : 'none')
                          : undefined
                      }
                      className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap border-b border-gray-200"
                    >
                      {col.subheading === 'Sampling Date' ? (
                        <button
                          type="button"
                          onClick={toggleSamplingDateSort}
                          disabled={loading}
                          title={
                            dateSort === 'desc'
                              ? 'Newest to oldest. Click for oldest to newest.'
                              : dateSort === 'asc'
                                ? 'Oldest to newest. Click for newest to oldest.'
                                : 'Sort by sampling date, newest to oldest'
                          }
                          aria-label={
                            dateSort === 'desc'
                              ? 'Sampling Date, newest to oldest. Click to sort oldest to newest.'
                              : dateSort === 'asc'
                                ? 'Sampling Date, oldest to newest. Click to sort newest to oldest.'
                                : 'Sort Sampling Date from newest to oldest'
                          }
                          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 -mx-1 font-medium whitespace-nowrap disabled:opacity-60 ${
                            dateSort
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                          }`}
                        >
                          Sampling Date
                          {dateSort === 'asc' ? (
                            <MdArrowUpward className="h-3.5 w-3.5" aria-hidden />
                          ) : dateSort === 'desc' ? (
                            <MdArrowDownward className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <MdUnfoldMore className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                          )}
                        </button>
                      ) : (
                        col.subheading || '\u2014'
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.records.map((row, i) => {
                  const recordTs = String(row[tsCol] || '').slice(0, 19);
                  const isFocus = (
                    Number(highlightedRequestId) > 0
                    && Number(row.pendingRequestId) === Number(highlightedRequestId)
                  ) || (
                    highlightedRecordTs
                    && recordTs === String(highlightedRecordTs).slice(0, 19)
                  );
                  return (
                  <tr key={`${page}-${row.pendingRequestId || ''}-${row.editRequestId || ''}-${i}`} className={rowEmphasisClass(row, isFocus)}>
                    {columns.map((col, colIdx) => {
                      const isFileSlot = isRecordFileColumn(form.formKey, col.dbKey, row[col.dbKey]);
                      const slot = isFileSlot
                        ? getRecordFileSlot(form.formKey, row, col.dbKey, col.subheading)
                        : null;
                      return (
                        <td
                          key={col.dbKey}
                          className={`px-3 py-2 text-gray-700 ${isFileSlot ? '' : 'whitespace-nowrap'}`}
                        >
                          {colIdx === 0 ? (
                            <span className="inline-flex items-center">
                              {row[col.dbKey] === null || row[col.dbKey] === undefined ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                formatRecordCellForDisplay(col.dbKey, row[col.dbKey], form.formKey, row)
                              )}
                              {approvalBadge(row)}
                              {editRequestBadge(row)}
                            </span>
                          ) : isFileSlot ? (
                            <FormFileSlotCell slot={slot} />
                          ) : row[col.dbKey] === null || row[col.dbKey] === undefined ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            formatRecordCellForDisplay(col.dbKey, row[col.dbKey], form.formKey, row)
                          )}
                        </td>
                      );
                    })}
                    {showActionsCol && (
                      <td className={`sticky right-0 z-10 border-l border-gray-100 px-2 py-2 text-center ${stickyActionsClass(row, isFocus)}`}>
                        {showRowActions(row) ? (
                          <RecordActionsButton onOpenMenu={(e) => openRowMenu(e, row)} />
                        ) : null}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
        )}
      </div>

      {showActionsCol && (
        <>
          <RecordRowActionMenu
            rowMenu={rowMenu}
            onClose={() => setRowMenu(null)}
            onView={setViewRow}
            onEdit={setEditRow}
            onEditRequest={(row) => setEditRequest({ row })}
            onDelete={setDeleteRow}
            canEdit={rowMenu ? canEditRow(rowMenu.row) : false}
            canDelete={rowMenu ? canDeleteRow(rowMenu.row) : false}
            canEditRequest={rowMenu ? canEditRequestRow(rowMenu.row) : false}
          />
          {viewRow && (
            <RecordViewModal
              form={form}
              row={viewRow}
              tsCol={tsCol}
              onClose={() => setViewRow(null)}
            />
          )}
          {editRow && (
            <RecordEditModal
              form={form}
              row={editRow}
              tsCol={tsCol}
              onClose={() => setEditRow(null)}
              onSaved={() => fetchPage(page)}
            />
          )}
          {deleteRow && (
            <DeleteRecordConfirmModal
              form={form}
              row={deleteRow}
              tsCol={tsCol}
              onClose={() => setDeleteRow(null)}
              onDeleted={() => fetchPage(page)}
            />
          )}
          {editRequest?.row && (
            <RecordEditModal
              form={form}
              row={editRequest.row}
              tsCol={tsCol}
              mode="editRequest"
              onClose={() => setEditRequest(null)}
              onSaved={(review) => setEditRequest((current) => ({ ...current, ...review }))}
            />
          )}
          {editRequest?.fields && (
            <EditRequestReviewModal
              form={form}
              fields={editRequest.fields}
              submitting={sendingRequest}
              onClose={() => setEditRequest((current) => ({ row: current.row }))}
              onConfirm={async (comment) => {
                const recordKey = recordKeyFromRow(editRequest.row, tsCol);
                if (!recordKey) {
                  toast.error('Cannot identify this record.');
                  return;
                }
                setSendingRequest(true);
                try {
                  await api.post(`/forms/${form.formKey}/records/${recordKey}/edit-requests`, {
                    ...editRequest.draft,
                    editRequestComment: comment,
                  });
                  toast.success('Edit request sent.');
                  setEditRequest(null);
                  fetchPage(page);
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Could not send the edit request.');
                } finally {
                  setSendingRequest(false);
                }
              }}
            />
          )}
        </>
      )}

      {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 sm:px-6">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page === 1 || loading}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              >
                <MdChevronLeft className="h-4 w-4" />
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button
                    key={p}
                    onClick={() => fetchPage(p)}
                    disabled={loading}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page === totalPages || loading}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              >
                <MdChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

// ─── Main FormTable ───────────────────────────────────────────
const FormTable = ({
  forms,
  nameColumnHeader = 'Form Name',
  emptyMessage = 'No forms are assigned to you for this app.',
  appId = null,
  returnTo = null,
}) => {
  const navigate            = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appName             = useAppName(appId);
  const viewOnly            = useFormsHubViewOnly();
  const [viewing, setViewing] = useState(null); // form object being viewed
  const [focusApprovalRequestId, setFocusApprovalRequestId] = useState(null);
  const [focusRecordTs, setFocusRecordTs] = useState(null);

  useEffect(() => {
    const viewForm = searchParams.get('viewForm');
    const viewData = searchParams.get('viewData');
    const approvalRequestId = searchParams.get('approvalRequestId');
    const recordTs = searchParams.get('recordTs');
    if (!viewForm && viewData !== '1') return;
    const match = forms?.find((f) => f.formKey === viewForm)
      || (viewData === '1' && forms?.length === 1 ? forms[0] : null);
    if (!match) return;
    setFocusApprovalRequestId(approvalRequestId || null);
    setFocusRecordTs(recordTs || null);
    setViewing(match);
    const next = new URLSearchParams(searchParams);
    next.delete('viewForm');
    next.delete('viewData');
    next.delete('approvalRequestId');
    next.delete('recordTs');
    setSearchParams(next, { replace: true });
  }, [forms, searchParams, setSearchParams]);

  const openViewData = (form) => {
    trackFormDataAction({
      event_type: 'view_data',
      form,
      appName: withoutGsmaLabel(appName) || null,
      appId,
    });
    setViewing(form);
  };

  const downloadFormCsv = async (form) => {
    const tid = toast.loading('Preparing CSV…');
    try {
      const { data } = await api.get(
        `/forms/${form.formKey}/records?page=1&limit=10000`
      );
      const cols = getDisplayColumns(form.formKey, data.records?.[0] ?? null);
      const ok = downloadCSV(`${form.formKey}.csv`, data.records, cols, form.formKey);
      if (ok) {
        trackFormDataAction({
          event_type: 'download_csv',
          form,
          appName: withoutGsmaLabel(appName) || null,
          appId,
        });
        toast.success('Downloaded!', { id: tid });
      } else {
        toast.dismiss(tid);
      }
    } catch {
      toast.error('Download failed.', { id: tid });
    }
  };

  if (!forms || forms.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <FormCardList
          forms={forms}
          navigate={navigate}
          appId={appId}
          returnTo={returnTo}
          onViewData={openViewData}
          onDownloadCsv={downloadFormCsv}
        />
      </div>

      <div className="table-wrapper hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="th">#</th>
              <th className="th">{nameColumnHeader}</th>
              <th className="th">Description</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {forms.map((form, idx) => (
              <tr key={form._id} className="hover:bg-gray-50 transition-colors">
                <td className="td text-gray-400">{idx + 1}</td>
                <td className="td font-medium text-gray-900">{withoutGsmaLabel(form.name)}</td>
                <td className="td text-gray-500">{form.description || '—'}</td>
                <td className="td">
                  <div className="flex items-center justify-center gap-2">

                    {!(viewOnly && !isSimpleOpenForm(form)) && (
                      <button
                        type="button"
                        onClick={() => openFormTarget(navigate, form, { appId, returnTo })}
                        className="btn-primary py-1.5 text-xs"
                      >
                        <MdOpenInNew className="h-3.5 w-3.5" />
                        {isSimpleOpenForm(form) ? 'Open' : 'Open Form'}
                      </button>
                    )}

                    {!isSimpleOpenForm(form) && (
                      <>
                        <button
                          onClick={() => openViewData(form)}
                          className="btn-secondary py-1.5 text-xs"
                        >
                          <MdTableChart className="h-3.5 w-3.5" />
                          View Data
                        </button>

                        <button
                          onClick={() => downloadFormCsv(form)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5
                                     bg-green-600 text-white text-xs font-medium rounded-lg
                                     hover:bg-green-700 transition-colors"
                        >
                          <MdDownload className="h-3.5 w-3.5" />
                          CSV
                        </button>
                      </>
                    )}

                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Data Modal */}
      {viewing && (
        <ViewDataModal
          form={viewing}
          onClose={() => {
            setViewing(null);
            setFocusApprovalRequestId(null);
            setFocusRecordTs(null);
          }}
          appName={withoutGsmaLabel(appName) || null}
          appId={appId}
          focusApprovalRequestId={focusApprovalRequestId}
          focusRecordTs={focusRecordTs}
        />
      )}
    </>
  );
};

export default FormTable;