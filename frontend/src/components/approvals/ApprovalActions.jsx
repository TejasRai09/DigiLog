import BusyButton from './BusyButton.jsx';

export default function ApprovalActions({ item, busy, busyAction, onApprove, onModify, onResolve }) {
  if (item.status === 'approved') {
    return (
      <p className="text-sm text-slate-500">
        This request was already approved. Details above are read-only.
      </p>
    );
  }

  if (item.status === 'conflict') {
    return (
      <div className="flex flex-wrap gap-2">
        <BusyButton
          busy={busy && busyAction === 'resolve-apply'}
          disabled={busy}
          busyLabel="Applying…"
          onClick={() => onResolve(item, 'apply')}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Apply requested values
        </BusyButton>
        <BusyButton
          busy={busy && busyAction === 'resolve-discard'}
          disabled={busy}
          busyLabel="Discarding…"
          onClick={() => onResolve(item, 'discard')}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Discard
        </BusyButton>
        <BusyButton
          disabled={busy}
          onClick={() => onModify(item)}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-50"
        >
          Send for modification
        </BusyButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <BusyButton
        busy={busy && busyAction === 'approve'}
        disabled={busy}
        busyLabel="Approving…"
        onClick={() => onApprove(item)}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Approve
      </BusyButton>
      <BusyButton
        disabled={busy}
        onClick={() => onModify(item)}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-50"
      >
        Send for modification
      </BusyButton>
    </div>
  );
}
