import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdClose, MdExpandLess, MdExpandMore, MdLock, MdPerson } from 'react-icons/md';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
import Spinner from './Spinner';
import GoogleSignInButton from './GoogleSignInButton';
import {
  validateLoginForm,
  getLoginErrorMessage,
  HOME_PORTAL_DENIED_MSG,
} from '../utils/loginValidation';
import { msalInstance } from '../msalConfig';

const MicrosoftIcon = () => (
  <svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-auto shrink-0" aria-hidden>
    <path d="M0 0H11V11H0V0Z" fill="#F25022" />
    <path d="M12 0H23V11H12V0Z" fill="#7FBA00" />
    <path d="M0 12H11V23H0V12Z" fill="#00A4EF" />
    <path d="M12 12H23V23H12V12Z" fill="#FFB900" />
  </svg>
);

const modalOAuthBtnClass =
  'flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60';

/**
 * Marketing-style sign-in modal; wraps the shared auth flows from useAuth.
 */
export default function DigiLogLoginModal({ open, onClose }) {
  const { loginManual, loginOutlook, loginGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  const reset = useCallback(() => {
    setForm({ email: '', password: '' });
    setLoading(false);
    setCredentialsOpen(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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
      await loginManual(check.email, form.password, { adminPortal: false });
      toast.success('Signed in successfully.');
      navigate('/dashboard');
      onClose();
    } catch (err) {
      toast.error(getLoginErrorMessage(err, HOME_PORTAL_DENIED_MSG));
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
      onClose();
    } catch (err) {
      toast.error(getLoginErrorMessage(err, HOME_PORTAL_DENIED_MSG));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300"
        aria-label="Close sign in"
        onClick={onClose}
      />

      <div className="relative my-auto flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <img
              src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png"
              alt="Zuari"
              className="h-6 w-auto object-contain"
            />
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">SSO Portal</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Sign in to <DigiLogTitle titleClassName="text-xl font-extrabold text-slate-900" versionClassName="text-sm" />
              </h3>
              <p className="mt-1 text-xs text-slate-500">Authenticate your operational logbook session.</p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleOutlookLogin}
                disabled={loading}
                className={modalOAuthBtnClass}
              >
                <MicrosoftIcon />
                Sign in with Microsoft
              </button>

              <GoogleSignInButton
                onAccessToken={handleGoogleAccessToken}
                disabled={loading}
                className={`${modalOAuthBtnClass} !mt-0 border-slate-200 bg-white hover:bg-slate-50`}
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setCredentialsOpen((open) => !open)}
                aria-expanded={credentialsOpen}
                aria-controls="modal-credentials-panel"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Sign in with credentials
                </span>
                {credentialsOpen ? (
                  <MdExpandLess className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                ) : (
                  <MdExpandMore className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                )}
              </button>

              {credentialsOpen ? (
                <form
                  id="modal-credentials-panel"
                  onSubmit={handleManualLogin}
                  className="mt-4 space-y-4"
                  noValidate
                >
                  <div>
                    <label htmlFor="modal-login-email" className="mb-1.5 block text-xs font-bold text-slate-500">
                      Username or corporate email
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <MdPerson />
                      </span>
                      <input
                        id="modal-login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="e.g., operator@zuari.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm transition-all focus:border-green-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="modal-login-password" className="block text-xs font-bold text-slate-500">
                        Security key phrase / password
                      </label>
                      <button
                        type="button"
                        onClick={() => toast('Contact your IT administrator for password reset.', { icon: 'ℹ️' })}
                        className="text-xs font-semibold text-green-700 transition-colors hover:text-green-800"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <MdLock />
                      </span>
                      <input
                        id="modal-login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={form.password}
                        onChange={handleChange}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm transition-all focus:border-green-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg focus:outline-none disabled:opacity-60"
                  >
                    {loading ? <Spinner size="sm" /> : null}
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
