/** Distillery expand-modal pill (uppercase via CSS). */
export function ExpandPeriodBadge({ label, isDarkMode = false, className = '' }) {
  if (!label) return null;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
      } ${className}`}
      title={String(label).toUpperCase()}
    >
      {label}
    </span>
  );
}

/** Distillery-style “VS 2024-2025 (OCT 27 - MAR 29)” chip for chart cards and expand modals. */
export default function CompareRangeBadge({ label, isDarkMode = false, className = '' }) {
  if (!label) return null;
  const text = String(label).replace(/^vs\s+/i, '').trim();
  if (!text) return null;
  return (
    <ExpandPeriodBadge
      label={`VS ${text}`}
      isDarkMode={isDarkMode}
      className={`max-w-[22rem] truncate ${className}`}
    />
  );
}
