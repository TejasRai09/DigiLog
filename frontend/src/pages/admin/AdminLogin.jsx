import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { MdEmail, MdLock, MdLogin } from 'react-icons/md';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import Spinner from '../../components/Spinner';

const AdminLogin = () => {
  const { user, loginManual, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Already logged in as admin → go straight to admin area
  if (user && user.role === 'admin') return <Navigate to="/admin/employees" replace />;

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await loginManual(form.email, form.password);
      navigate('/admin/employees', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed.';
      if (msg.toLowerCase().includes('deactivated')) {
        toast.error('Account is deactivated. Contact your administrator.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="DigiLog"
            className="mx-auto h-20 w-auto object-contain mb-4 drop-shadow-lg rounded-xl"
            width={80}
            height={80}
          />
          <h1 className="text-2xl font-bold text-white">DigiLog</h1>
          <p className="mt-1 text-sm text-slate-300">Your digital logbook</p>
          <p className="mt-2 text-xs text-slate-500">Administrator sign-in</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                Email address
              </label>
              <div className="relative">
                <MdEmail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="admin@company.com"
                  className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500
                             rounded-lg py-2.5 pl-9 pr-4 text-sm
                             focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                             transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500
                             rounded-lg py-2.5 pl-9 pr-4 text-sm
                             focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                             transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2
                         bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50
                         text-white font-semibold rounded-lg py-2.5 text-sm
                         transition focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800"
            >
              {loading ? <Spinner size="sm" /> : <MdLogin className="h-4 w-4" />}
              {loading ? 'Signing in…' : 'Sign In as Admin'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700 text-center">
            <a
              href="/login"
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              ← Back to employee login
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} DigiLog. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
