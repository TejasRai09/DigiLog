import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdMoreVert } from 'react-icons/md';

export default function CardOverflowMenu({ items = [], disabled = false, title = 'Actions' }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const visible = items.filter((item) => item && !item.hidden);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const place = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = menuRef.current?.offsetHeight || 120;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8;
      const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      setCoords({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!visible.length) return null;

  return (
    <div className="relative" ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MdMoreVert className="h-5 w-5" />
      </button>
      {open
        ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[400] w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: coords.top, left: coords.left }}
          >
            {visible.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-50 ${
                  item.danger
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
