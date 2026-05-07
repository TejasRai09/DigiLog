import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MdElectricBolt, MdLogout, MdPeople, MdGridView, MdHome } from 'react-icons/md';
import useAuth from '../hooks/useAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 font-bold text-blue-700 text-base">
            <MdElectricBolt className="h-5 w-5" />
            <span>GSMA Portal</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLink('/', 'Dashboard', MdHome)}
            {user?.role === 'admin' && (
              <>
                {navLink('/admin/employees', 'Employees', MdPeople)}
                {navLink('/admin/mappings',  'Form Mapping', MdGridView)}
              </>
            )}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold uppercase select-none">
              {user?.name?.[0] ?? '?'}
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <MdLogout className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
