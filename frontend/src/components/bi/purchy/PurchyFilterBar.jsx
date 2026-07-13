import { useState, useRef, useEffect } from 'react';
import { MdExpandMore, MdFilterList } from 'react-icons/md';

function MultiSelectSlicer({ label, options = [], selected = [], onChange, isDarkMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const labelText = selected.length === 0
    ? 'All'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  const panel = isDarkMode
    ? 'border-slate-600 bg-slate-800 text-slate-200'
    : 'border-slate-200 bg-white text-slate-800';
  const btn = isDarkMode
    ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <div ref={ref} className="relative min-w-[140px] flex-1">
      <label className={`mb-1 block text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium shadow-sm ${btn}`}
      >
        <span className="truncate">{labelText}</span>
        <MdExpandMore className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-lg border shadow-lg ${panel}`}>
          <button
            type="button"
            onClick={() => onChange([])}
            className={`block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-violet-500/10 ${isDarkMode ? 'text-violet-300' : 'text-violet-700'}`}
          >
            All
          </button>
          {options.map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-500/10 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchyFilterBar({
  slicers,
  options,
  filters,
  onFilterChange,
  onClear,
  isDarkMode,
  loading,
  compact = false,
}) {
  const bar = isDarkMode
    ? 'border-slate-700 bg-slate-800/80'
    : 'border-slate-200 bg-white';

  return (
    <div className={`shrink-0 rounded-xl border shadow-sm ${compact ? 'p-2' : 'p-3 sm:p-4'} ${bar}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <MdFilterList className={`h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Filters
        </span>
        <button
          type="button"
          onClick={onClear}
          className={`ml-auto text-xs font-semibold ${isDarkMode ? 'text-violet-300 hover:text-violet-200' : 'text-violet-600 hover:text-violet-800'}`}
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {slicers.map(({ key, label, optionKey }) => (
          <MultiSelectSlicer
            key={key}
            label={label}
            options={loading ? [] : (options?.[optionKey] || [])}
            selected={filters[key] || []}
            onChange={(vals) => onFilterChange(key, vals)}
            isDarkMode={isDarkMode}
          />
        ))}
      </div>
    </div>
  );
}
