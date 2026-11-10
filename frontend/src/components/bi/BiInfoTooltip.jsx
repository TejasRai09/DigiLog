import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdInfoOutline } from 'react-icons/md';

const FLOATING_LAYER_Z = 9999;

function useAnchorPosition(anchorRef, active) {
  const [position, setPosition] = useState(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.top,
      bottom: rect.bottom,
      centerX: rect.left + rect.width / 2,
      right: rect.right,
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!active) {
      setPosition(null);
      return;
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, update]);

  return position;
}

/** Hover info icon showing KPI formula / definition. */
export default function BiInfoTooltip({ definition, isDarkMode, placement = 'top', wide = false }) {
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);
  const [active, setActive] = useState(false);
  const [side, setSide] = useState(placement);
  const pos = useAnchorPosition(anchorRef, active);

  useEffect(() => {
    setSide(placement);
  }, [placement, active]);

  useEffect(() => {
    if (!active || !pos || !tooltipRef.current) return;
    const h = tooltipRef.current.offsetHeight;
    const gap = 8;
    const pad = 8;
    const spaceAbove = pos.top - pad;
    const spaceBelow = window.innerHeight - pos.bottom - pad;
    if (placement === 'top' && spaceAbove < h + gap && spaceBelow > spaceAbove) {
      setSide('bottom');
    } else if (placement === 'bottom' && spaceBelow < h + gap && spaceAbove > spaceBelow) {
      setSide('top');
    } else {
      setSide(placement);
    }
  }, [active, pos, placement]);

  if (!definition) return null;

  const widthPx = wide ? 320 : 256;
  const left = pos
    ? Math.min(window.innerWidth - widthPx / 2 - 8, Math.max(widthPx / 2 + 8, pos.centerX))
    : 0;

  const tooltip =
    active &&
    pos &&
    createPortal(
      <div
        ref={tooltipRef}
        role="tooltip"
        className={`pointer-events-none fixed rounded-xl p-3 text-left text-[11px] font-normal leading-relaxed text-white shadow-xl ${
          wide ? 'w-80' : 'w-64'
        } ${isDarkMode ? 'bg-slate-700' : 'bg-slate-800'}`}
        style={{
          zIndex: FLOATING_LAYER_Z,
          left,
          ...(side === 'bottom'
            ? { top: pos.bottom + 8, transform: 'translateX(-50%)' }
            : { top: pos.top - 8, transform: 'translate(-50%, -100%)' }),
        }}
      >
        {definition}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ml-1 inline-flex shrink-0 cursor-help items-center rounded p-0.5 text-slate-400 transition-colors hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="More information"
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
      >
        <MdInfoOutline className="h-3.5 w-3.5" />
      </button>
      {tooltip}
    </>
  );
}
