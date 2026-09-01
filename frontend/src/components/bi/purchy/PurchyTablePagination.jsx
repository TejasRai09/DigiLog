const PAGE_SIZE_OPTIONS = [25, 50, 100];

export { PAGE_SIZE_OPTIONS };

export default function PurchyTablePagination({
  page,
  pageSize,
  total = 0,
  onPageChange,
  onPageSizeChange,
  isDarkMode,
  compact = false,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const select = isDarkMode
    ? 'border-slate-600 bg-slate-700 text-slate-200'
    : 'border-slate-200 bg-white text-slate-800';

  return (
    <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-t ${compact ? 'px-2 py-1.5' : 'px-4 py-2.5'} ${border}`}>
      <div className={`flex items-center gap-2 text-xs ${muted}`}>
        {onPageSizeChange && (
          <>
            <label htmlFor="purchy-page-size" className="font-semibold">
              Rows
            </label>
            <select
              id="purchy-page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={`rounded border px-2 py-1 text-xs font-semibold ${select}`}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </>
        )}
        <span className="tabular-nums">
          {total > 0 ? `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}` : '0 rows'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          className="rounded px-2 py-1 text-xs font-semibold text-violet-600 disabled:opacity-40"
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded px-2 py-1 text-xs font-semibold text-violet-600 disabled:opacity-40"
        >
          Previous
        </button>
        <span className={`min-w-[5rem] text-center text-xs tabular-nums ${muted}`}>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded px-2 py-1 text-xs font-semibold text-violet-600 disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="rounded px-2 py-1 text-xs font-semibold text-violet-600 disabled:opacity-40"
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
