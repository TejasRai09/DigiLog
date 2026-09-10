import { useState } from 'react';
import ChangeComparison from './ChangeComparison';
import ApprovalActions from './ApprovalActions';
import ApprovalMediaAttachments from './ApprovalMediaAttachments.jsx';
import { StatusBadge, formatSubmittedAt } from './approvalDisplay.jsx';

function ConflictPanel({ conflict }) {
  if (!conflict) return null;
  return (
    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <p className="font-bold">Version conflict</p>
      <p className="mt-1">Expected original version: {conflict.expectedVersion ?? '—'}</p>
      <p>Current approved version: {conflict.currentVersion ?? 'missing'}</p>
    </div>
  );
}

function submitterLabel(item) {
  const name = item.requestedBy?.name || 'Employee';
  return item.requestedBy?.email ? `${name} (${item.requestedBy.email})` : name;
}

function ReviewModal({ item, busy, busyAction, onClose, onApprove, onModify, onResolve }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-review-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 id="approval-review-title" className="text-lg font-bold text-slate-900">
              Review maintenance history change
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {item.domainLabel}
              {item.operationLabel ? ` · ${item.operationLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              Equipment:{' '}
              <span className="break-words font-semibold text-slate-900">{item.equipmentName}</span>
            </p>
            <p>
              Path:{' '}
              <span className="break-words font-semibold text-slate-800">{item.equipmentPath || '—'}</span>
            </p>
            <p>
              Status: <StatusBadge status={item.status} />
            </p>
            <p>
              Submitted by {submitterLabel(item)}
              {' · '}
              {formatSubmittedAt(item.requestedAt)}
            </p>
          </div>

          {item.hodComment ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-bold">HOD comment:</span> {item.hodComment}
            </p>
          ) : null}

          <ConflictPanel conflict={item.conflict} />
          <ChangeComparison item={item} />
          <ApprovalMediaAttachments item={item} />
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <ApprovalActions
            item={item}
            busy={busy}
            busyAction={busyAction}
            onApprove={onApprove}
            onModify={onModify}
            onResolve={onResolve}
          />
        </div>
      </div>
    </div>
  );
}

function ApprovalTable({
  rows,
  selectedIds,
  onToggle,
  onReview,
  startIndex = 1,
}) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-base text-slate-400">
        None
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-blue-700 text-white">
            <th className="w-10 border border-blue-800 px-3 py-2.5 font-semibold" />
            <th className="w-12 border border-blue-800 px-3 py-2.5 text-center font-semibold">#</th>
            <th className="border border-blue-800 px-3 py-2.5 font-semibold">Equipment</th>
            <th className="border border-blue-800 px-3 py-2.5 font-semibold">Path</th>
            <th className="border border-blue-800 px-3 py-2.5 font-semibold">Action</th>
            <th className="border border-blue-800 px-3 py-2.5 font-semibold">Status</th>
            <th className="border border-blue-800 px-3 py-2.5 font-semibold">Created at</th>
            <th className="border border-blue-800 px-3 py-2.5 font-semibold">Submitted by</th>
            <th className="border border-blue-800 px-3 py-2.5 text-center font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => {
            const selectable = item.status === 'pending' || item.status === 'resubmitted';
            return (
              <tr
                key={item.id}
                className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
              >
                <td className="border border-slate-200 px-3 py-2.5 align-top">
                  {selectable ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => onToggle(item.id)}
                      className="mt-0.5 h-4 w-4"
                    />
                  ) : null}
                </td>
                <td className="border border-slate-200 px-3 py-2.5 text-center align-top text-slate-500">
                  {startIndex + index}
                </td>
                <td className="max-w-[14rem] break-words border border-slate-200 px-3 py-2.5 align-top font-bold text-slate-900">
                  {item.equipmentName}
                  {item.domainLabel ? (
                    <div className="mt-1 text-xs font-semibold text-slate-400">{item.domainLabel}</div>
                  ) : null}
                </td>
                <td className="min-w-[16rem] max-w-[28rem] break-words border border-slate-200 px-3 py-2.5 align-top text-slate-600">
                  {item.equipmentPath || '—'}
                </td>
                <td className="whitespace-nowrap border border-slate-200 px-3 py-2.5 align-top text-slate-700">
                  {item.operationLabel}
                </td>
                <td className="border border-slate-200 px-3 py-2.5 align-top">
                  <StatusBadge status={item.status} />
                </td>
                <td className="whitespace-nowrap border border-slate-200 px-3 py-2.5 align-top text-slate-600">
                  {formatSubmittedAt(item.requestedAt)}
                </td>
                <td className="max-w-[14rem] break-words border border-slate-200 px-3 py-2.5 align-top text-slate-600">
                  {submitterLabel(item)}
                </td>
                <td className="border border-slate-200 px-3 py-2.5 text-center align-top">
                  <button
                    type="button"
                    onClick={() => onReview(item)}
                    className="text-sm font-bold text-blue-600 hover:underline"
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
  );
}

export default function PendingChangeList({
  items,
  selectedIds,
  onToggle,
  busy,
  busyAction,
  onApprove,
  onModify,
  onResolve,
  statusFilter = '',
}) {
  const [reviewItem, setReviewItem] = useState(null);
  const showingApproved = statusFilter === 'approved';
  const previous = showingApproved ? [] : items.filter((item) => item.group === 'previous');
  const today = showingApproved ? [] : items.filter((item) => item.group !== 'previous');
  const approvedRows = showingApproved ? items : [];

  const closeReview = () => setReviewItem(null);

  const handleApprove = async (item) => {
    const ok = await onApprove(item);
    if (ok) closeReview();
  };

  const handleModify = (item) => {
    closeReview();
    onModify(item);
  };

  const handleResolve = async (item, resolution) => {
    const ok = await onResolve(item, resolution);
    if (ok) closeReview();
  };

  return (
    <div className="space-y-8">
      {showingApproved ? (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-800 sm:text-lg">
            Approved requests ({approvedRows.length})
          </h2>
          <ApprovalTable
            rows={approvedRows}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onReview={setReviewItem}
            startIndex={1}
          />
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-800 sm:text-lg">
              Previous pending ({previous.length})
            </h2>
            <ApprovalTable
              rows={previous}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onReview={setReviewItem}
              startIndex={1}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-800 sm:text-lg">
              New today ({today.length})
            </h2>
            <ApprovalTable
              rows={today}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onReview={setReviewItem}
              startIndex={previous.length + 1}
            />
          </section>
        </>
      )}

      <ReviewModal
        item={reviewItem}
        busy={busy}
        busyAction={busyAction}
        onClose={closeReview}
        onApprove={handleApprove}
        onModify={handleModify}
        onResolve={handleResolve}
      />
    </div>
  );
}
