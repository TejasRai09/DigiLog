import Spinner from '../../Spinner';
import BiKpiCard from '../BiKpiCard';

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
  if (loading && !kpis) {
    const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-xl border shadow-sm ${card} ${compact ? 'h-16' : 'h-24'}`}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid shrink-0 gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {KPI_ITEMS.map(({ key, label, format }) => (
        <BiKpiCard
          key={key}
          title={label}
          displayValue={formatValue(kpis?.[key], format)}
          value={100}
          pyValue={0}
          hideComparison={true}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
}
