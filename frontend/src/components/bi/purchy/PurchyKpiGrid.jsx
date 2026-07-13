import Spinner from '../../Spinner';

const KPI_ITEMS = [
  { key: 'bondedGrowers', label: 'Bonded Growers', format: 'int' },
  { key: 'indentCount', label: '2025 Indent Count', format: 'int' },
  { key: 'indentQty', label: '2025 Indent Qty', format: 'num' },
  { key: 'supplyCount', label: '2025 Supply Count', format: 'int' },
  { key: 'supplyQty', label: '2025 Supply Qty', format: 'num' },
  { key: 'dishonourCount', label: '2025 Dishonour Count', format: 'int' },
  { key: 'dishonourPctCount', label: '2025 Dishonour % (Count)', format: 'pct' },
  { key: 'dishonourQty', label: '2025 Dishonour Qty', format: 'num' },
  { key: 'dishonourPctQty', label: '2025 Dishonour % (Qty)', format: 'pct' },
];

function formatValue(val, format) {
  if (val === null || val === undefined) return '—';
  if (format === 'pct') return `${(Number(val) * 100).toFixed(2)}%`;
  if (format === 'int') return Number(val).toLocaleString();
  return Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PurchyKpiGrid({ kpis, loading, isDarkMode, compact = false }) {
  const card = isDarkMode
    ? 'border-slate-700 bg-slate-800'
    : 'border-slate-200 bg-white';
  const title = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const value = isDarkMode ? 'text-slate-100' : 'text-slate-800';

  if (loading) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-xl border shadow-sm ${card} ${compact ? 'h-16' : 'h-24'}`}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={`grid shrink-0 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 ${compact ? 'grid-cols-3' : 'grid-cols-2 gap-2'}`}>
      {KPI_ITEMS.map(({ key, label, format }) => (
        <div key={key} className={`rounded-lg border shadow-sm ${card} ${compact ? 'p-2' : 'p-3'}`}>
          <div className={`font-bold uppercase leading-tight ${title} ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{label}</div>
          <div className={`mt-0.5 font-black tabular-nums ${value} ${compact ? 'text-sm' : 'text-lg'}`}>
            {formatValue(kpis?.[key], format)}
          </div>
        </div>
      ))}
    </div>
  );
}
