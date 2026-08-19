import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdExpandMore, MdSearch } from 'react-icons/md';

import { TOOLBAR_FILTER_TRIGGER_CLASS } from './ToolbarFilterSelect';

const PANEL_Z_INDEX = 9999;
const TOOLBAR_PANEL_MIN_WIDTH = 280;
const VIEWPORT_PAD = 8;
const GAP = 4;
const ESTIMATED_PANEL_HEIGHT = 240;

export default function EquipmentMultiSelectDropdown({
  options,
  value = [],
  onChange,
  labelMap,
  emptyLabel = '— Select equipment —',
  className = '',
  variant = 'default',
  compact = false,
  panelMinWidth = TOOLBAR_PANEL_MIN_WIDTH,
  triggerMinWidth = '14rem',
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const frameRef = useRef(0);

  const isToolbar = variant === 'toolbar';

  const updatePanelPosition = (closeIfOffscreen = false) => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    if (
      closeIfOffscreen
      && (rect.bottom < VIEWPORT_PAD || rect.top > window.innerHeight - VIEWPORT_PAD)
    ) {
      setOpen(false);
      return;
    }

    const panelWidth = isToolbar
      ? Math.max(rect.width, panelMinWidth)
      : rect.width;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const preferred = Math.min(
      ESTIMATED_PANEL_HEIGHT,
      panelRef.current?.offsetHeight || ESTIMATED_PANEL_HEIGHT,
    );
    const openUp = spaceBelow < preferred && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(ESTIMATED_PANEL_HEIGHT, openUp ? spaceAbove - GAP : spaceBelow - GAP),
    );
    const height = Math.min(panelRef.current?.offsetHeight || preferred, maxHeight);
    const left = Math.min(
      Math.max(VIEWPORT_PAD, rect.left),
      Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD),
    );

    const next = {
      position: 'fixed',
      top: openUp ? Math.max(VIEWPORT_PAD, rect.top - GAP - height) : rect.bottom + GAP,
      left,
      width: panelWidth,
      maxHeight,
      zIndex: PANEL_Z_INDEX,
    };
    setPanelStyle((prev) => (
      prev
      && prev.top === next.top
      && prev.left === next.left
      && prev.width === next.width
      && prev.maxHeight === next.maxHeight
        ? prev
        : next
    ));
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }

    const run = (event) => {
      if (event && panelRef.current?.contains(event.target)) return;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        updatePanelPosition(true);
      });
    };

    updatePanelPosition();
    const measureId = requestAnimationFrame(() => updatePanelPosition());
    window.addEventListener('scroll', run, true);
    window.addEventListener('resize', run);
    return () => {
      cancelAnimationFrame(measureId);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener('scroll', run, true);
      window.removeEventListener('resize', run);
    };
  }, [open, isToolbar, panelMinWidth]);

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
    ? `${TOOLBAR_FILTER_TRIGGER_CLASS} w-full`
    : 'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const labelClassName = isToolbar
    ? 'text-slate-700 leading-snug truncate'
    : `truncate ${selectedLabels.length ? 'text-slate-800' : 'text-slate-400'}`;

  const chevronClassName = isToolbar
    ? 'w-4 h-4 text-slate-500 shrink-0 transition-transform'
    : 'w-5 h-5 text-slate-400 shrink-0 transition-transform';

  const panel = open && panelStyle ? (
    <div
      ref={panelRef}
      style={{ ...panelStyle, overscrollBehavior: 'contain' }}
      className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden py-1"
      onWheel={(e) => e.stopPropagation()}
      onScroll={(e) => e.stopPropagation()}
    >
      {options.length > 6 && (
        <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="relative">
            <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search equipment..."
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filteredOptions.length > 0 ? filteredOptions.map((opt) => {
          const checked = value.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleKey(opt.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs whitespace-nowrap ${
                checked
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checked && <span className="text-[9px] leading-none">✓</span>}
              </span>
              <span className="min-w-0">{opt.label}</span>
            </button>
          );
        }) : (
          <p className="px-3 py-3 text-center text-xs text-slate-400">No equipment found</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      style={isToolbar ? { minWidth: triggerMinWidth } : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
        style={isToolbar ? { minWidth: triggerMinWidth } : undefined}
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
