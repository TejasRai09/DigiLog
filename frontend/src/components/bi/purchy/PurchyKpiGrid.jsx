import Spinner from '../../Spinner';
import BiKpiCard from '../BiKpiCard';
import { normalizeSeasonYear, seasonLabel } from '../../../utils/purchySeason';

function kpiItems(seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  return [
    { key: 'bondedGrowers', label: 'Bonded Growers', format: 'int' },
    { key: 'indentCount', label: seasonLabel('Indent Count', year), format: 'int' },
    { key: 'indentQty', label: seasonLabel('Indent Qty', year), format: 'num' },
    { key: 'supplyCount', label: seasonLabel('Supply Count', year), format: 'int' },
    { key: 'supplyQty', label: seasonLabel('Supply Qty', year), format: 'num' },
    { key: 'dishonourCount', label: seasonLabel('Dishonour Count', year), format: 'int' },
    { key: 'dishonourPctCount', label: seasonLabel('Dishonour % (Count)', year), format: 'pct' },
    { key: 'dishonourQty', label: seasonLabel('Dishonour Qty', year), format: 'num' },
    { key: 'dishonourPctQty', label: seasonLabel('Dishonour % (Qty)', year), format: 'pct' },
  ];
}

function formatValue(val, format) {
  if (val === null || val === undefined) return '—';
  if (format === 'pct') return `${(Number(val) * 100).toFixed(2)}%`;
  if (format === 'int') return Number(val).toLocaleString();
  return Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PurchyKpiGrid({ kpis, loading, isDarkMode, compact = false, seasonYear }) {
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
      {kpiItems(seasonYear).map(({ key, label, format }) => (
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
