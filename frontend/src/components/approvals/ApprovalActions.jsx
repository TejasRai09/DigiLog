export default function ApprovalActions({ item, busy, onApprove, onModify, onResolve }) {
  if (item.status === 'conflict') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve(item, 'apply')}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Apply requested values
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve(item, 'discard')}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onModify(item)}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-50"
        >
          Send for modification
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => onApprove(item)}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onModify(item)}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-50"
      >
        Send for modification
      </button>
    </div>
  );
}
