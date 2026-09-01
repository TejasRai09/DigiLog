/**
 * Compact % chip for mill thermal/lube averages vs the active Compare window.
 */
export default function MillComparePct({ pct, inverseGood = true, isDarkMode = false }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const isPositive = pct > 0;
  const isNeutral = pct === 0;
  const isGood = inverseGood ? !isPositive : isPositive;
  const cls = isNeutral
    ? isDarkMode
      ? 'text-slate-400'
      : 'text-slate-500'
    : isGood
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-600'
      : isDarkMode
        ? 'text-rose-400'
        : 'text-rose-600';
  return (
    <span className={`text-xs font-black tabular-nums ${cls}`}>
      {isNeutral ? '0.0%' : `${isPositive ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}
