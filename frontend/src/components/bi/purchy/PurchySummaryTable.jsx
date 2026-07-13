import Spinner from '../../Spinner';



const COLUMNS = [

  { key: 'year', label: 'Year', kind: 'text' },

  { key: 'ttlGrowersWithBond', label: 'Ttl Growers with Bond', kind: 'int' },

  { key: 'growersWithIndent', label: '# Growers with Indent', kind: 'int' },

  { key: 'growersSupplied', label: '# Growers Supplied', kind: 'int' },

  { key: 'ttlBond', label: 'Ttl Bond', kind: 'num' },

  { key: 'supplyQtyByYear', label: 'Supply Qty by Year', kind: 'num' },

  { key: 'supplyVsBondPct', label: 'Supply vs Bond %', kind: 'pct' },

  { key: 'issuedPurchyCnt', label: 'Issued Purchy (cnt)', kind: 'int' },

  { key: 'weightedPurchyCnt', label: 'Weighted Purchy (cnt)', kind: 'int' },

  { key: 'purchyDishonourCntPct', label: 'Purchy Dishonour (cnt) %', kind: 'pct' },

];



function formatCell(val, kind) {

  if (val === null || val === undefined) return '—';

  if (kind === 'pct') return `${(Number(val) * 100).toFixed(2)}%`;

  if (kind === 'int') return Number(val).toLocaleString();

  if (kind === 'num') return Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return String(val);

}



export default function PurchySummaryTable({ rows, loading, isDarkMode, compact = false }) {

  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';

  const head = isDarkMode

    ? 'border-slate-700 bg-slate-900/90 text-slate-400'

    : 'border-slate-200 bg-slate-100/90 text-slate-500';

  const text = isDarkMode ? 'text-slate-200' : 'text-slate-800';

  const zebra = isDarkMode ? 'even:bg-slate-800/50' : 'even:bg-slate-50';



  return (

    <div className={`shrink-0 overflow-hidden rounded-xl border shadow-sm ${card}`}>

      <div className={`border-b ${compact ? 'px-3 py-1.5' : 'px-4 py-2'} ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>

        <h3 className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${text}`}>Year-wise Summary</h3>

      </div>

      <div className="overflow-x-auto">

        {loading ? (

          <div className="flex h-20 items-center justify-center">

            <Spinner />

          </div>

        ) : (

          <table className={`w-full min-w-[900px] text-left ${compact ? 'text-xs' : 'text-sm'}`}>

            <thead className={`text-[10px] uppercase tracking-wide ${head}`}>

              <tr>

                {COLUMNS.map((col) => (

                  <th

                    key={col.key}

                    className={`whitespace-nowrap font-bold ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} ${col.kind === 'text' ? 'text-left' : 'text-right'}`}

                  >

                    {col.label}

                  </th>

                ))}

              </tr>

            </thead>

            <tbody className={text}>

              {rows.map((row) => (

                <tr key={row.year} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} ${zebra}`}>

                  {COLUMNS.map((col) => (

                    <td

                      key={col.key}

                      className={`whitespace-nowrap tabular-nums ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} ${col.kind === 'text' ? 'text-left font-semibold' : 'text-right'}`}

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

    </div>

  );

}


