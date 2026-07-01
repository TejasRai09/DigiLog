import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdExpandMore } from 'react-icons/md';

const PANEL_Z_INDEX = 9999;

export const TOOLBAR_FILTER_TRIGGER_CLASS =
  'flex items-center justify-between gap-2 min-w-[10.5rem] px-3 py-1.5 text-left text-xs text-slate-700 border border-slate-200 rounded-lg bg-white hover:border-slate-300 cursor-pointer outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function ToolbarFilterSelect({
  value,
  onChange,
  options = [],
  className = '',
  minWidth = '10.5rem',
  panelMinWidth = 168,
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const selected = options.find((opt) => opt.value === value);
  const displayText = selected?.label ?? options[0]?.label ?? '—';

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, panelMinWidth),
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
  }, [open, panelMinWidth]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const panel = open && panelStyle ? (
    <div
      ref={panelRef}
      style={panelStyle}
      className="rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden py-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-xs whitespace-nowrap ${
              active
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={className} style={{ minWidth }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${TOOLBAR_FILTER_TRIGGER_CLASS} w-full`}
        style={{ minWidth }}
      >
        <span className="truncate">{displayText}</span>
        <MdExpandMore className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
