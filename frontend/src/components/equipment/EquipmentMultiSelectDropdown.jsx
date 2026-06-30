import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdExpandMore, MdSearch } from 'react-icons/md';

const PANEL_Z_INDEX = 9999;

export default function EquipmentMultiSelectDropdown({
  options,
  value = [],
  onChange,
  labelMap,
  emptyLabel = '— Select equipment —',
  className = '',
  variant = 'default',
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const isToolbar = variant === 'toolbar';

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: PANEL_Z_INDEX,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }
    updatePanelPosition();
    window.addEventListener('scroll', updatePanelPosition, true);
    window.addEventListener('resize', updatePanelPosition);
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true);
      window.removeEventListener('resize', updatePanelPosition);
    };
  }, [open, isToolbar]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (
        rootRef.current?.contains(e.target)
        || panelRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
      setSearchQuery('');
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setSearchQuery('');
    return undefined;
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q)
        || (opt.disciplineLabel && opt.disciplineLabel.toLowerCase().includes(q)),
    );
  }, [options, searchQuery]);

  const selectedLabels = value
    .map((key) => labelMap.get(key) || options.find((o) => o.key === key)?.label)
    .filter(Boolean);

  const displayText = selectedLabels.length === 0
    ? emptyLabel
    : isToolbar && selectedLabels.length > 1
      ? `${selectedLabels.length} Equipment`
      : selectedLabels.join(', ');

  const fullLabelTitle = selectedLabels.length > 0 ? selectedLabels.join(', ') : undefined;

  const toggleKey = (key) => {
    const set = new Set(value);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange(Array.from(set));
  };

  const triggerClassName = isToolbar
    ? 'flex items-center justify-between gap-1 min-w-[7.5rem] max-w-[20rem] px-2.5 py-1.5 text-left text-xs text-slate-600 font-semibold border border-slate-200 rounded-lg bg-white hover:border-slate-300 cursor-pointer outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
    : 'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const labelClassName = isToolbar
    ? 'text-slate-600 font-semibold leading-snug'
    : `truncate ${selectedLabels.length ? 'text-slate-800' : 'text-slate-400'}`;

  const chevronClassName = isToolbar
    ? 'w-4 h-4 text-slate-500 shrink-0 transition-transform'
    : 'w-5 h-5 text-slate-400 shrink-0 transition-transform';

  const panel = open && panelStyle ? (
    <div
      ref={panelRef}
      style={panelStyle}
      className="rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
        <div className="relative">
          <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            onClick={(e) => e.stopPropagation()}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <MdClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-44 overflow-y-auto py-1">
        {filteredOptions.length > 0 ? filteredOptions.map((opt) => {
          const checked = value.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleKey(opt.key)}
              className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                checked ? 'bg-violet-50 text-violet-900' : 'text-slate-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                  checked ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checked && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <span className="font-medium leading-snug whitespace-normal break-words">{opt.label}</span>
            </button>
          );
        }) : (
          <p className="px-3 py-4 text-center text-xs text-slate-400">No equipment found</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
        title={fullLabelTitle}
      >
        <span className={labelClassName}>
          {displayText}
        </span>
        <MdExpandMore className={`${chevronClassName} ${open ? 'rotate-180' : ''}`} />
      </button>

      {panel && createPortal(panel, document.body)}

      {value.length > 0 && !isToolbar && !compact && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {value.length} equipment selected
        </p>
      )}
    </div>
  );
}
