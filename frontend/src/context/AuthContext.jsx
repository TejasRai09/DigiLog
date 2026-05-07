import { createContext, useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../msalConfig';
import api from '../api/axios';

export const AuthContext = createContext(null);

// Module-level flag: prevents double-handling the MSAL redirect in React StrictMode,
// which mounts/unmounts/remounts effects — causing handleRedirectPromise to fire twice.
let _msalRedirectHandled = false;

export const AuthProvider = ({ children }) => {
  const { instance, accounts } = useMsal();
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session from stored JWT ────────────────────────
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  // ── Handle MSAL redirect callback (fires on every page load) ─
  useEffect(() => {
    if (_msalRedirectHandled) return;
    _msalRedirectHandled = true;

    instance
      .handleRedirectPromise()
      .then(async (response) => {
        if (!response) return;
        const { data } = await api.post('/auth/outlook', { accessToken: response.accessToken });
        localStorage.setItem('token', data.token);
        setUser(data.user);
      })
      .catch((err) => console.error('MSAL redirect error:', err));
  }, [instance]);

  // ── Manual login ────────────────────────────────────────────
  const loginManual = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  }, []);

  // ── Outlook login (redirect – no popup) ─────────────────────
  const loginOutlook = useCallback(() => {
    instance.loginRedirect(loginRequest);
  }, [instance]);

  // ── Logout ──────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    // If signed in via Outlook, clear MSAL session too
    if (accounts.length > 0) {
      instance.logoutRedirect({ account: accounts[0] });
    }
  }, [instance, accounts]);

  return (
    <AuthContext.Provider value={{ user, loading, loginManual, loginOutlook, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
