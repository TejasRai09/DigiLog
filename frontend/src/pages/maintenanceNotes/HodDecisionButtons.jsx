export default function HodDecisionButtons({ item, busy, onView, onApprove, onReject, className = '' }) {
  if (!item) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {onView ? (
        <button
          type="button"
          onClick={() => onView(item)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          View
        </button>
      ) : null}
      {item.canDecide ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject(item)}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(item)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Approve
          </button>
        </>
      ) : null}
    </div>
  );
}
