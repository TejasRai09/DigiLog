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

export default function ChangeRequestCard({
  item,
  selected,
  onToggle,
  busy,
  busyAction,
  onApprove,
  onModify,
  onResolve,
}) {
  const [open, setOpen] = useState(false);
  const selectable = item.status === 'pending' || item.status === 'resubmitted';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(item.id)}
            className="mt-1.5 h-4 w-4"
          />
        ) : (
          <span className="mt-1.5 inline-block h-4 w-4" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-bold text-slate-900 sm:text-lg">{item.equipmentName}</h3>
            <StatusBadge status={item.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 sm:text-sm">
              {item.operationLabel}
            </span>
            <span className="text-xs font-semibold text-slate-400 sm:text-sm">{item.domainLabel}</span>
          </div>
          {item.equipmentPath ? (
            <p className="mt-1 break-words text-sm text-slate-500">
              <span className="font-semibold text-slate-600">Path:</span> {item.equipmentPath}
            </p>
          ) : null}
          <p className="mt-1.5 text-sm text-slate-500">
            {item.requestedBy?.name || 'Employee'}
            {item.requestedBy?.email ? ` (${item.requestedBy.email})` : ''}
            {' · '}
            {formatSubmittedAt(item.requestedAt)}
          </p>
          {item.hodComment ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-bold">HOD comment:</span> {item.hodComment}
            </p>
          ) : null}
          <ConflictPanel conflict={item.conflict} />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-bold text-blue-600 hover:underline sm:text-base"
        >
          {open ? 'Hide details' : 'Review'}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <ChangeComparison item={item} />
          <ApprovalMediaAttachments item={item} />
          <ApprovalActions
            item={item}
            busy={busy}
            busyAction={busyAction}
            onApprove={onApprove}
            onModify={onModify}
            onResolve={onResolve}
          />
        </div>
      )}
    </article>
  );
}
