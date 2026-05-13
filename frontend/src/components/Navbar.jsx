import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MdLogout, MdPeople, MdHome } from 'react-icons/md';
import useAuth from '../hooks/useAuth';
import ProfileModal from './ProfileModal';
import { mediaUrl } from '../utils/mediaUrl';

const ZUARI_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png';
const ADVENTZ_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/adventz.png';

const Navbar = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const navLink = (to, label, Icon) => (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex w-full min-h-[3.75rem] sm:min-h-16 items-center gap-2 py-2 sm:gap-3">
        {/* Left: Zuari + DigiLog (app branding beside Zuari) */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4 pl-1 sm:pl-2 md:pl-3 min-w-0">
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
              className="h-8 w-auto max-w-[100px] sm:h-9 sm:max-w-[140px] md:h-10 md:max-w-[170px] lg:h-11 lg:max-w-[190px] object-contain object-left"
              width={190}
              height={44}
            />
          </a>
          <Link
            to="/"
            className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5 rounded-lg py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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

        {/* Center: main nav */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-1 min-w-0">
          {navLink('/', 'Dashboard', MdHome)}
          {user?.role === 'admin' && navLink('/admin/employees', 'Employees', MdPeople)}
        </nav>
        <div className="flex-1 min-w-0 md:hidden" aria-hidden />

        {/* Right: user + Adventz */}
        <div className="flex shrink-0 items-center gap-1.5 pr-1 sm:gap-2 sm:pr-2 md:gap-3 md:pr-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-gray-900">{user?.name}</p>
            <p className={`text-xs text-gray-500 ${user?.department ? '' : 'capitalize'}`}>
              {user?.department ? user.department : user?.role}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold uppercase text-white select-none overflow-hidden ring-2 ring-transparent hover:ring-blue-300 transition-shadow sm:h-10 sm:w-10"
            title="Your profile"
            aria-label="Open profile"
          >
            {user?.avatar ? (
              <img src={mediaUrl(user.avatar)} alt="" className="h-full w-full object-cover" />
            ) : (
              user?.name?.[0] ?? '?'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Logout"
          >
            <MdLogout className="h-5 w-5" />
          </button>

          <a
            href="https://www.adventz.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-0.5 shrink-0 rounded-md border-l border-gray-200 pl-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:pl-2"
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

      {profileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onAvatarSaved={refreshUser}
        />
      )}
    </header>
  );
};

export default Navbar;
