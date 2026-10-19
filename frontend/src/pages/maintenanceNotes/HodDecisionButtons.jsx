export default function HodDecisionButtons({ item, busy, onView, onApprove, onReject, className = '' }) {
  if (!item) return null;
  const btn = 'w-full rounded-lg px-3 py-2.5 text-sm font-semibold sm:w-auto';
  return (
    <div className={`flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap ${className}`}>
      {onView ? (
        <button
          type="button"
          onClick={() => onView(item)}
          className={`${btn} border border-slate-200 bg-white text-slate-700`}
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
            className={`${btn} bg-rose-600 text-white disabled:opacity-50`}
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(item)}
            className={`${btn} bg-emerald-600 text-white disabled:opacity-50`}
          >
            Approve
          </button>
        </>
      ) : null}
    </div>
  );
}
