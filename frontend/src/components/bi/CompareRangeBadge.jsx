/** Distillery-style “vs Prev. Month (Apr 1 - Apr 10)” chip for chart cards and expand modals. */
export default function CompareRangeBadge({ label, isDarkMode = false, className = '' }) {
  if (!label) return null;
  return (
    <span
      className={`max-w-[16rem] truncate rounded-full px-2 py-0.5 text-[9px] font-bold sm:text-[10px] ${
        isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
      } ${className}`}
      title={`vs ${label}`}
    >
      vs {label}
    </span>
  );
}
