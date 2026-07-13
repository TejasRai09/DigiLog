import Spinner from '../../Spinner';
import PurchyTablePagination from './PurchyTablePagination';

function formatCell(val, kind) {
  if (val === null || val === undefined || val === '') return '—';
  if (kind === 'pct') return `${(Number(val) * 100).toFixed(2)}%`;
  if (kind === 'int') return Number(val).toLocaleString();
  if (kind === 'num') return Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(val);
}

export default function PurchyDetailTable({
  title,
  columns,
  rows,
  loading,
  total,
  page = 1,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  isDarkMode,
  emptyMessage = 'No data for the selected filters.',
  maxHeight,
  fillHeight = false,
  compact = false,
  footer,
  className = '',
}) {
  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const head = isDarkMode
    ? 'border-slate-700 bg-slate-900/95 text-slate-400'
    : 'border-slate-200 bg-slate-100/95 text-slate-500';
  const text = isDarkMode ? 'text-slate-200' : 'text-slate-800';
  const zebra = isDarkMode ? 'even:bg-slate-800/50' : 'even:bg-slate-50';
  const rowTotal = total ?? rows.length;
  const showPagination = rowTotal > 0 && onPageChange;

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-sm ${card} ${fillHeight ? 'min-h-[200px] flex-1' : ''} ${className}`}>
      <div className={`flex shrink-0 items-center border-b ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
        <h3 className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${text}`}>{title}</h3>
        {!loading && rowTotal > 0 && (
          <span className={`ml-auto text-[10px] font-bold uppercase tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {rowTotal.toLocaleString()} total
          </span>
        )}
      </div>
      <div
        className={`relative min-h-0 flex-1 overflow-auto overscroll-contain ${!fillHeight && !maxHeight ? 'min-h-[160px]' : ''}`}
        style={!fillHeight && maxHeight ? { maxHeight } : undefined}
      >
        {loading ? (
          <div className={`flex items-center justify-center ${compact ? 'h-32' : 'h-48'}`}>
            <Spinner size="lg" />
          </div>
        ) : rows.length === 0 ? (
          <p className={`p-6 text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{emptyMessage}</p>
        ) : (
          <table className={`w-max min-w-full text-left ${compact ? 'text-xs' : 'text-sm'}`}>
            <thead className={`sticky top-0 z-10 text-[10px] uppercase tracking-wide backdrop-blur-sm ${head}`}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2.5 font-bold ${col.kind === 'num' || col.kind === 'int' || col.kind === 'pct' ? 'text-right' : 'text-left'}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={text}>
              {rows.map((row, idx) => (
                <tr
                  key={row.id ?? row.growerNameKey ?? row.grower_name_key ?? `${page}-${idx}`}
                  className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} ${zebra}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap tabular-nums ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} ${col.kind === 'num' || col.kind === 'int' || col.kind === 'pct' ? 'text-right' : 'text-left'}`}
                    >
                      {formatCell(row[col.key], col.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {footer}
      {showPagination && (
        <PurchyTablePagination
          compact={compact}
          page={page}
          pageSize={pageSize}
          total={rowTotal}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
