import { MdOpenInFull } from 'react-icons/md';

/** Chart card actions — expand only; CSV/PNG live in the expand modal. */
export default function ChartCardToolbar({ onExpand, isDarkMode = false }) {
  const btn =
    'rounded-lg border p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40';
  const idle = isDarkMode
    ? 'border-slate-600/80 bg-slate-800/60 text-slate-400 hover:border-slate-500 hover:bg-slate-700 hover:text-slate-200'
    : 'border-slate-200/80 bg-white/80 text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700';

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`${btn} ${idle}`}
      title="Expand chart"
      aria-label="Expand chart"
    >
      <MdOpenInFull className="h-4 w-4" />
    </button>
  );
}
