import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MdAutoAwesome, MdMenu, MdClose } from 'react-icons/md';

const SECTION_LINKS = [
  { href: '/#operations-desk', label: 'Operations desk', icon: MdAutoAwesome, iconClass: 'text-green-600' },
  { href: '/#three-pillars', label: 'The Platform' },
  { href: '/#divisions', label: 'Divisions' },
  { href: '/#transformation', label: 'Transformation' },
  { href: '/#security', label: 'AI Security' },
];

export default function MarketingSiteNav({ onLoginClick }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:min-h-16 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-4" onClick={closeMenu}>
          <div className="flex shrink-0 items-center">
            <img
              src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png"
              alt="Zuari Industries"
              className="h-8 w-auto max-w-[90px] object-contain sm:h-9 sm:max-w-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/logo.png"
              alt="DigiLog"
              width={36}
              height={36}
              className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
              decoding="async"
            />
            <div className="flex min-w-0 flex-col text-left">
              <span className="truncate text-sm font-extrabold leading-none tracking-tight text-slate-900">
                DigiLog
              </span>
              <span className="mt-0.5 hidden text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:block">
                Your digital logbook
              </span>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4 md:gap-6">
          <div className="hidden items-center gap-6 lg:flex">
            {SECTION_LINKS.map(({ href, label, icon: Icon, iconClass }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-green-800"
              >
                {Icon ? <Icon className={`text-base ${iconClass}`} aria-hidden /> : null}
                {label}
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={onLoginClick}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 min-h-[40px] sm:px-4 sm:text-sm touch-manipulation"
          >
            Log in
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden touch-manipulation"
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <MdClose className="h-6 w-6" /> : <MdMenu className="h-6 w-6" />}
          </button>

          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="hidden items-center sm:flex">
            <img
              src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png"
              alt="Adventz"
              className="h-8 w-auto max-w-[80px] object-contain sm:h-9 sm:max-w-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="marketing-mobile-nav"
            className="absolute left-0 right-0 top-full z-50 border-b border-slate-100 bg-white px-4 py-4 shadow-lg lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {SECTION_LINKS.map(({ href, label, icon: Icon, iconClass }) => (
                <a
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-green-800"
                >
                  {Icon ? <Icon className={`text-lg ${iconClass}`} aria-hidden /> : null}
                  {label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
