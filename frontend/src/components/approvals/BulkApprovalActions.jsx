export default function BulkApprovalActions({ selectedCount, busy, onApproveSelected }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy || selectedCount === 0}
        onClick={onApproveSelected}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:text-base"
      >
        Approve selected{selectedCount ? ` (${selectedCount})` : ''}
      </button>
    </div>
  );
}
