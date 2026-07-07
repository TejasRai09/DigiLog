import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MdLogout, MdPeople, MdHome, MdUpload, MdMenu } from 'react-icons/md';
import useAuth from '../hooks/useAuth';
import useDataUploadAccess from '../hooks/useDataUploadAccess';
import ProfileModal from './ProfileModal';
import MobileNavDrawer from './MobileNavDrawer';
import AuthenticatedImage from './AuthenticatedImage';

const ZUARI_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png';
const ADVENTZ_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/adventz.png';

const Navbar = () => {
  const { user, logout, refreshUser } = useAuth();
  const { enabled: dataUploadEnabled } = useDataUploadAccess();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMenu = () => setMobileOpen(false);

  const navItems = [
    { to: '/dashboard', label: 'Home', Icon: MdHome, show: true },
    { to: '/data-upload', label: 'Data Upload', Icon: MdUpload, show: dataUploadEnabled },
    { to: '/admin/employees', label: 'Employees', Icon: MdPeople, show: user?.role === 'admin' },
  ].filter((item) => item.show);

  const navLinkClass = (active) =>
    `flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex w-full min-h-[3.75rem] items-center gap-2 py-2 sm:min-h-16 sm:gap-3">
          <div className="flex min-w-0 shrink-0 items-center gap-2 pl-1 sm:gap-3 sm:pl-2 md:gap-4 md:pl-3">
            <a
              href="https://www.zuariindustries.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Zuari Industries"
            >
              <img
                src={ZUARI_LOGO_URL}
                alt="Zuari Industries"
                className="h-8 w-auto max-w-[100px] object-contain object-left sm:h-9 sm:max-w-[140px] md:h-10 md:max-w-[170px] lg:h-11 lg:max-w-[190px]"
                width={190}
                height={44}
              />
            </a>
            <Link
              to="/"
              className="flex min-w-0 shrink items-center gap-2 rounded-lg py-0.5 sm:gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <img
                src="/logo.png"
                alt="DigiLog"
                className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11 md:h-12 md:w-12"
                width={48}
                height={48}
              />
              <div className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
                <span className="text-sm font-bold text-blue-700 sm:text-base">DigiLog</span>
                <span className="max-w-[8rem] truncate text-[10px] text-gray-500 sm:max-w-none sm:text-xs">
                  Your digital logbook
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {navItems.map(({ to, label, Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 md:hidden" aria-hidden />

          <div className="flex shrink-0 items-center gap-1 pr-1 sm:gap-2 sm:pr-2 md:gap-3 md:pr-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden"
              aria-expanded={mobileOpen}
              aria-controls="app-mobile-drawer"
              aria-label="Open menu"
            >
              <MdMenu className="h-6 w-6" />
            </button>

            <div className="hidden text-right sm:block">
              <p className="max-w-[8rem] truncate text-sm font-medium leading-tight text-gray-900 lg:max-w-none">
                {user?.name}
              </p>
              <p className={`max-w-[8rem] truncate text-xs text-gray-500 lg:max-w-none ${user?.department ? '' : 'capitalize'}`}>
                {user?.department ? user.department : user?.role}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex h-9 w-9 shrink-0 touch-manipulation select-none items-center justify-center overflow-hidden rounded-full bg-blue-600 text-sm font-bold uppercase text-white ring-2 ring-transparent transition-shadow hover:ring-blue-300 sm:h-10 sm:w-10"
              title="Your profile"
              aria-label="Open profile"
            >
              {user?.avatar ? (
                <AuthenticatedImage src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                user?.name?.[0] ?? '?'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/?login=1');
              }}
              className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Logout"
              aria-label="Logout"
            >
              <MdLogout className="h-5 w-5" />
            </button>

            <a
              href="https://www.adventz.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-0.5 hidden shrink-0 rounded-md border-l border-gray-200 pl-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:block sm:pl-2"
              aria-label="Adventz"
            >
              <img
                src={ADVENTZ_LOGO_URL}
                alt="Adventz"
                className="h-8 w-auto max-w-[72px] object-contain object-right sm:h-9 sm:max-w-[92px] md:h-10 md:max-w-[112px] lg:h-11 lg:max-w-[124px]"
                width={124}
                height={44}
              />
            </a>
          </div>
        </div>
      </header>

      <MobileNavDrawer
        open={mobileOpen}
        onClose={closeMenu}
        id="app-mobile-drawer"
        breakpoint="md"
      >
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500 capitalize">
            {user?.department || user?.role}
          </p>
        </div>
        <ul className="space-y-1">
          {navItems.map(({ to, label, Icon }) => {
            const active = pathname === to;
            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={closeMenu}
                  className={navLinkClass(active)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </MobileNavDrawer>

      {profileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onAvatarSaved={refreshUser}
        />
      )}
    </>
  );
};

export default Navbar;
