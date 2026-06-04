import Spinner from '../Spinner';
import { formatDMYShort } from '../../utils/distilleryBiDateRange';

/**
 * @param {{ key: string; label: string; kind?: 'date'|'text'|'num'|'badge' }} columns
 */
export function formatMillRawCell(kind, row, key) {
  const v = row[key];
  switch (kind) {
    case 'date':
      return row.dateIso ? formatDMYShort(row.dateIso) : (v ?? '');
    case 'num':
      if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return null;
      return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'badge':
      return v !== undefined && v !== null && String(v) !== '' ? String(v) : '';
    default:
      return v !== undefined && v !== null && String(v) !== '' ? String(v) : '';
  }
}

export default function MillRawDataTable({
  title,
  periodLabel,
  columns,
  rows,
  loading,
  emptyMessage = 'No data available for the selected filters.',
  isDarkMode,
  cardClasses,
  textClasses,
}) {
  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm ${cardClasses}`}>
      <div
        className={`flex shrink-0 items-center border-b p-4 ${
          isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <h3 className={`text-sm font-bold ${textClasses.title}`}>
          {title}
          {periodLabel ? (
            <span className={`ml-1 font-normal ${textClasses.muted}`}>({periodLabel})</span>
          ) : null}
        </h3>
        {!loading && (
          <span className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
          }`}>
            {rows.length} rows
          </span>
        )}
      </div>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        {loading ? (
          <div className="flex h-48 min-w-full items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <table className="w-max min-w-full text-left text-sm">
            <thead
              className={`sticky top-0 z-10 border-b text-[10px] uppercase tracking-wide backdrop-blur-sm ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-900/90 text-slate-400'
                  : 'border-slate-200 bg-slate-100/90 text-slate-500'
              }`}
            >
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2.5 font-bold ${
                      col.kind === 'num' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={isDarkMode ? 'transition-colors hover:bg-slate-800/50' : 'transition-colors hover:bg-slate-50'}
                >
                  {columns.map((col) => {
                    const raw = formatMillRawCell(col.kind || 'text', row, col.key);
                    const display = raw === null || raw === '' ? '—' : raw;
                    const isNum = col.kind === 'num';
                    return (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap px-3 py-2 ${
                          isNum ? 'text-right font-mono' : 'font-medium'
                        } ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} ${
                          col.kind === 'date' ? textClasses.title : ''
                        }`}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className={`px-6 py-12 text-center font-semibold ${textClasses.muted}`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
