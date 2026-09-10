import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import ApprovalSummary from './ApprovalSummary';
import PendingChangeList from './PendingChangeList';
import BulkApprovalActions from './BulkApprovalActions';
import ModificationDialog from './ModificationDialog';
import BusyButton from './BusyButton.jsx';
import useHodApprovalAccess from '../../hooks/useHodApprovalAccess';
import { onRealtimeEvent, EVENT_NOTIFICATION_NEW } from '../../realtime/socket';

const DEFAULT_FILTERS = {
  search: '',
  operation: '',
  status: 'today_pending',
  from: '',
  to: '',
};

export default function ApprovalDashboard() {
  const { enabled, loading: accessLoading } = useHodApprovalAccess();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [filtering, setFiltering] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [modifyItem, setModifyItem] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const params = { page, limit: 20 };
      Object.entries(applied).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const { data: payload } = await api.get('/approvals/pending', { params });
      setData(payload);
      if (!quiet) setSelectedIds([]);
    } catch (err) {
      if (!quiet) {
        toast.error(err.response?.data?.message || 'Failed to load pending approvals.');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    if (!loading) setFiltering(false);
  }, [loading]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load();
  }, [enabled, load]);

  // Live refresh when employee submits/resubmits (Socket.IO notification)
  useEffect(() => {
    if (!enabled) return undefined;
    return onRealtimeEvent(EVENT_NOTIFICATION_NEW, (payload) => {
      if (payload?.type === 'mh_pending_hod') {
        load({ quiet: true });
      }
    });
  }, [enabled, load]);

  // Backup refresh when HOD returns to the tab
  useEffect(() => {
    if (!enabled) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') load({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, load]);

  const items = data?.items || [];
  const summary = data?.summary || {
    previousPending: 0,
    newToday: 0,
    total: 0,
    totalRequests: 0,
    approvedRequests: 0,
    needsModification: 0,
  };
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 20)));

  const toggle = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    ));
  };

  const selectableIds = useMemo(
    () => items.filter((item) => item.status === 'pending' || item.status === 'resubmitted').map((item) => item.id),
    [items],
  );

  const approveOne = async (item) => {
    setBusy(true);
    setBusyAction('approve');
    try {
      const { data: result } = await api.post(`/approvals/${item.id}/approve`);
      if (result.status === 'conflict') {
        toast.error('Version conflict — review expected vs current values.');
        await load();
        return true;
      }
      toast.success(result.alreadyResolved ? 'Already approved.' : 'Approved.');
      await load();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed.');
      return false;
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const approveSelected = async () => {
    if (!selectedIds.length) return;
    setBusy(true);
    setBusyAction('bulk');
    try {
      const { data: result } = await api.post('/approvals/bulk-approve', { ids: selectedIds });
      const failed = (result.results || []).filter((row) => !row.ok);
      if (failed.length) {
        toast.error(`${failed.length} item(s) were not approved. Check conflicts.`);
      } else {
        toast.success('Selected changes approved.');
      }
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk approve failed.');
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const submitModification = async (comment) => {
    if (!modifyItem) return;
    setBusy(true);
    setBusyAction('modify');
    try {
      await api.post(`/approvals/${modifyItem.id}/send-for-modification`, { comment });
      toast.success('Sent for modification.');
      setModifyItem(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send for modification.');
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const resolveConflict = async (item, resolution) => {
    setBusy(true);
    setBusyAction(resolution === 'apply' ? 'resolve-apply' : 'resolve-discard');
    try {
      await api.post(`/approvals/${item.id}/resolve-conflict`, { resolution });
      toast.success(resolution === 'apply' ? 'Conflict applied.' : 'Conflict discarded.');
      await load();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resolve conflict.');
      return false;
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  if (accessLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Approvals</h1>
        <p className="mt-2 text-base text-slate-500">
          You are not the assigned HOD for Sugar House, Power Plant, or Production House maintenance history.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full px-3 py-6 space-y-5 sm:px-4 lg:px-6 text-base">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Pending maintenance changes</h1>
        <p className="mt-1 text-base text-slate-500">
          Review pending create, update, and delete requests for maintenance history. Approve them or send them back for modification.
        </p>
      </div>

      <ApprovalSummary summary={summary} />

      <form
        className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltering(true);
          setPage(1);
          setApplied({ ...filters });
        }}
      >
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search employee or equipment"
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-base"
        />
        <select
          value={filters.operation}
          onChange={(e) => setFilters((f) => ({ ...f, operation: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-base"
        >
          <option value="">All types</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-base"
        >
          <option value="today_pending">Today's pending</option>
          <option value="previous_pending">Previous pending</option>
          <option value="total_pending">Total pending</option>
          <option value="resubmitted">Resubmitted</option>
          <option value="needs_modification">Sent for modification</option>
          <option value="approved">Approved</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-base"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-base"
        />
        <div className="flex gap-2">
          <BusyButton
            type="submit"
            busy={filtering && loading}
            busyLabel="Filtering…"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-base font-bold text-white disabled:opacity-50"
          >
            Filter
          </BusyButton>
          <button
            type="button"
            disabled={busy || (filtering && loading)}
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setFiltering(true);
              setApplied(DEFAULT_FILTERS);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-base font-semibold text-slate-600 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </form>

      {applied.status !== 'approved' && applied.status !== 'needs_modification' && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:text-base">
          <input
            type="checkbox"
            checked={selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))}
            onChange={(e) => setSelectedIds(e.target.checked ? selectableIds : [])}
            className="h-4 w-4"
          />
          Select all on this page
        </label>
        <BulkApprovalActions
          selectedCount={selectedIds.length}
          busy={busy && busyAction === 'bulk'}
          onApproveSelected={approveSelected}
        />
      </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <PendingChangeList
          items={items}
          selectedIds={selectedIds}
          onToggle={toggle}
          busy={busy}
          busyAction={busyAction}
          onApprove={approveOne}
          onModify={setModifyItem}
          onResolve={resolveConflict}
        />
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border px-3 py-2 text-base disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 py-2 text-base text-slate-500">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-2 text-base disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <ModificationDialog
        open={Boolean(modifyItem)}
        onClose={() => !busy && setModifyItem(null)}
        onSubmit={submitModification}
        busy={busy && busyAction === 'modify'}
      />
    </div>
  );
}
