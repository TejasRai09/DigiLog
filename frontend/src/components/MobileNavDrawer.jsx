import { useEffect } from 'react';
import { MdClose } from 'react-icons/md';

/**
 * Right-side mobile navigation drawer (slides in from the right).
 * @param {'md' | 'lg'} breakpoint — hide drawer at this breakpoint and up (default `lg`)
 */
export default function MobileNavDrawer({
  open,
  onClose,
  title = 'DigiLog Menu',
  children,
  id = 'mobile-nav-drawer',
  breakpoint = 'lg',
}) {
  const hideClass = breakpoint === 'md' ? 'md:hidden' : 'lg:hidden';

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`fixed inset-0 z-[500] bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300 ${hideClass} ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id={id}
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[510] flex h-full w-[min(320px,88vw)] flex-col rounded-tl-3xl border-l border-slate-100 bg-white shadow-2xl transition-transform duration-300 ease-out ${hideClass} ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-md object-contain"
              decoding="async"
            />
            <span className="text-base font-extrabold tracking-tight text-slate-900">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close menu"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">{children}</div>
      </aside>
    </>
  );
}
