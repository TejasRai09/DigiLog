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
export default function BiInfoTooltip({ definition, isDarkMode, placement = 'top' }) {
  const anchorRef = useRef(null);
  const [active, setActive] = useState(false);
  const pos = useAnchorPosition(anchorRef, active);

  if (!definition) return null;

  const tooltip =
    active &&
    pos &&
    createPortal(
      <div
        role="tooltip"
        className={`pointer-events-none fixed w-64 rounded-xl p-3 text-left text-[11px] font-normal leading-relaxed text-white shadow-xl ${
          isDarkMode ? 'bg-slate-700' : 'bg-slate-800'
        }`}
        style={{
          zIndex: FLOATING_LAYER_Z,
          ...(placement === 'bottom'
            ? { top: pos.bottom + 8, left: pos.centerX, transform: 'translateX(-50%)' }
            : { top: pos.top - 8, left: pos.centerX, transform: 'translate(-50%, -100%)' }),
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
