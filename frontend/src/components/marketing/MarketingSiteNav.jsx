import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MdAutoAwesome,
  MdBusiness,
  MdFolder,
  MdMenu,
  MdSecurity,
  MdSync,
} from 'react-icons/md';
import MobileNavDrawer from '../MobileNavDrawer';

const SECTION_LINKS = [
  {
    href: '/#operations-desk',
    label: 'Operations Hub',
    desktopLabel: 'Operations desk',
    icon: MdAutoAwesome,
    iconClass: 'text-green-600',
    labelClass: 'text-green-800 font-semibold',
    badge: 'HERO',
    badgeClass: 'bg-green-50 text-green-700',
  },
  {
    href: '/#three-pillars',
    label: 'Digital Forms & Shift Sheets',
    desktopLabel: 'The Platform',
    icon: MdFolder,
    iconClass: 'text-amber-500',
    badge: 'SEC 2',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
  {
    href: '/#divisions',
    label: 'Sectors & Divisions',
    desktopLabel: 'Divisions',
    icon: MdBusiness,
    iconClass: 'text-blue-600',
    badge: 'SEC 3',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
  {
    href: '/#transformation',
    label: 'Analytics & Performance',
    desktopLabel: 'Transformation',
    icon: MdSync,
    iconClass: 'text-blue-500',
    badge: 'SEC 4',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
  {
    href: '/#security',
    label: 'Secure AI Assistant',
    desktopLabel: 'AI Security',
    icon: MdSecurity,
    iconClass: 'text-blue-600',
    badge: 'SEC 5',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
];

export default function MarketingSiteNav({ onLoginClick }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);

  return (
    <>
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
              {SECTION_LINKS.map(({ href, desktopLabel, label, icon: Icon, iconClass }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-green-800"
                >
                  {Icon ? <Icon className={`text-base ${iconClass}`} aria-hidden /> : null}
                  {desktopLabel || label}
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={onLoginClick}
              className="inline-flex min-h-[40px] shrink-0 touch-manipulation items-center justify-center rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 sm:px-4 sm:text-sm"
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="marketing-mobile-drawer"
              aria-label="Open menu"
            >
              <MdMenu className="h-6 w-6" />
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
      </nav>

      <MobileNavDrawer
        open={mobileOpen}
        onClose={closeMenu}
        id="marketing-mobile-drawer"
        breakpoint="lg"
      >
        <ul className="space-y-1">
          {SECTION_LINKS.map(({ href, label, icon: Icon, iconClass, labelClass, badge, badgeClass }) => (
            <li key={href}>
              <a
                href={href}
                onClick={closeMenu}
                className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} aria-hidden />
                  <span className={`truncate text-sm ${labelClass || 'font-medium text-slate-800'}`}>
                    {label}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                >
                  {badge}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </MobileNavDrawer>
    </>
  );
}
