function fmtInt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${(Number(n) * 100).toFixed(2)}%`;
}

function fmtQty(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const COLS = [
  { key: 'varietyType', label: 'Varietytype', align: 'left', fmt: (r) => r.varietyType },
  { key: 'indentCount', label: '# Indent Purchy', align: 'right', fmt: (r) => fmtInt(r.indentCount) },
  { key: 'supplyCount', label: '# Supply Purchy', align: 'right', fmt: (r) => fmtInt(r.supplyCount) },
  { key: 'dishonourCount', label: '# Dishonour Purchy', align: 'right', fmt: (r) => fmtInt(r.dishonourCount) },
  { key: 'dishonourPctCount', label: 'Dishonor % (Purchy Count)', align: 'right', fmt: (r) => fmtPct(r.dishonourPctCount) },
  { key: 'dishonourQty', label: 'Dishonour Purchy Qty', align: 'right', fmt: (r) => fmtQty(r.dishonourQty) },
];

export default function PurchyVarietyTypeTable({
  rows = [],
  totals,
  loading,
  varietyName,
  isDarkMode,
}) {
  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const head = isDarkMode ? 'bg-slate-900/80 text-slate-400' : 'bg-slate-50 text-slate-500';
  const text = isDarkMode ? 'text-slate-200' : 'text-slate-800';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const zebra = isDarkMode ? 'even:bg-slate-800/60' : 'even:bg-slate-50';

  return (
    <div className={`overflow-hidden rounded-xl border shadow-sm ${card}`}>
      <div className={`flex items-center justify-between border-b px-3 py-1.5 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wide ${muted}`}>
          Variety type
          {varietyName ? <span className="ml-1.5 font-bold normal-case tracking-normal text-violet-600 dark:text-violet-400">· {varietyName}</span> : null}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[11px]">
          <thead>
            <tr className={head}>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-1.5 font-black uppercase tracking-wide ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={text}>
            {loading && !rows.length ? (
              <tr>
                <td colSpan={COLS.length} className={`px-3 py-4 text-center ${muted}`}>Loading…</td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={COLS.length} className={`px-3 py-4 text-center ${muted}`}>
                  Click a variety below to filter this table.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.varietyType} className={zebra}>
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 tabular-nums ${c.align === 'right' ? 'text-right font-semibold' : 'font-bold'}`}
                    >
                      {c.fmt(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr className={`border-t font-black ${isDarkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-1.5 tabular-nums ${c.align === 'right' ? 'text-right' : ''}`}
                  >
                    {c.key === 'varietyType' ? 'Total' : c.fmt(totals)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
