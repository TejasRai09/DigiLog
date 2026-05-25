import { Link } from 'react-router-dom';
import { MdAutoAwesome } from 'react-icons/md';

export default function MarketingSiteNav({ onLoginClick }) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-4">
          <div className="flex items-center">
            <img
              src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png"
              alt="Zuari Industries"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="DigiLog"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
              decoding="async"
            />
            <div className="flex flex-col text-left">
              <span className="text-sm font-extrabold leading-none tracking-tight text-slate-900">DigiLog</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                Your digital logbook
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden items-center gap-6 lg:flex">
            <a
              href="/#operations-desk"
              className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-green-800"
            >
              <MdAutoAwesome className="text-base text-green-600" aria-hidden />
              Operations desk
            </a>
            <a href="/#three-pillars" className="text-sm font-medium text-slate-500 transition-colors hover:text-green-800">
              The Platform
            </a>
            <a href="/#divisions" className="text-sm font-medium text-slate-500 transition-colors hover:text-green-800">
              Divisions
            </a>
            <a href="/#transformation" className="text-sm font-medium text-slate-500 transition-colors hover:text-green-800">
              Transformation
            </a>
            <a href="/#security" className="text-sm font-medium text-slate-500 transition-colors hover:text-green-800">
              AI Security
            </a>
          </div>
          <div className="hidden h-4 w-px bg-slate-200 lg:block" />
          <button
            type="button"
            onClick={onLoginClick}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 md:text-sm"
          >
            Log in
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center">
            <img
              src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png"
              alt="Adventz"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
