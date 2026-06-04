import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail, MdLock, MdLogin } from 'react-icons/md';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import GoogleSignInButton from '../components/GoogleSignInButton';
import {
  validateLoginForm,
  getLoginErrorMessage,
  HOME_PORTAL_DENIED_MSG,
} from '../utils/loginValidation';
import { msalInstance } from '../msalConfig';

const MicrosoftIcon = () => (
  <svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
    <path d="M10 0H0v10h10V0Z"   fill="#F25022" />
    <path d="M21 0H11v10h10V0Z"  fill="#7FBA00" />
    <path d="M10 11H0v10h10V11Z" fill="#00A4EF" />
    <path d="M21 11H11v10h10V11Z" fill="#FFB900" />
  </svg>
);

const Login = () => {
  const { loginManual, loginOutlook, loginGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleManualLogin = async (e) => {
    e.preventDefault();
    const check = validateLoginForm(form.email, form.password);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setLoading(true);
    try {
      const data = await loginManual(check.email, form.password, { adminPortal: false });
      if (data?.user?.role === 'admin') {
        logout();
        toast.error(ADMIN_HOME_LOGIN_MSG);
        return;
      }
      toast.success('Signed in successfully.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getLoginErrorMessage(err, ADMIN_HOME_LOGIN_MSG));
    } finally {
      setLoading(false);
    }
  };

  const handleOutlookLogin = () => {
    if (!msalInstance) {
      toast.error('Microsoft sign-in requires a secure (HTTPS) connection.');
      return;
    }
    try {
      loginOutlook();
    } catch {
      toast.error('Could not start Microsoft sign-in. Please try again.');
    }
  };

  const handleGoogleAccessToken = async (accessToken) => {
    setLoading(true);
    try {
      await loginGoogle(accessToken, { adminPortal: false });
      toast.success('Signed in successfully.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getLoginErrorMessage(err, HOME_PORTAL_DENIED_MSG));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="DigiLog"
            className="mx-auto h-20 w-auto object-contain mb-4 drop-shadow-md"
            width={80}
            height={80}
          />
          <h1 className="text-2xl font-bold text-gray-900">DigiLog</h1>
          <p className="mt-1 text-sm text-gray-600">Your digital logbook</p>
        </div>

        <div className="card p-8 shadow-lg">
          <button
            type="button"
            onClick={handleOutlookLogin}
            disabled={loading}
            className="btn-secondary w-full py-2.5"
          >
            <MicrosoftIcon />
            Sign in with Microsoft
          </button>

          <GoogleSignInButton onAccessToken={handleGoogleAccessToken} disabled={loading} />

          <div className="relative mb-6 mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-wide">
                or sign in manually
              </span>
            </div>
          </div>

          <form onSubmit={handleManualLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <div className="relative">
                <MdEmail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input pl-9"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Spinner size="sm" /> : <MdLogin className="h-4 w-4" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} DigiLog. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
