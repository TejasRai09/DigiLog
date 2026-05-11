import { createContext, useState, useEffect, useCallback } from 'react';
import { msalInstance, loginRequest } from '../msalConfig';
import api from '../api/axios';

export const AuthContext = createContext(null);

// Prevents double-handling in React StrictMode (mount→unmount→remount)
let _msalRedirectHandled = false;

export const AuthProvider = ({ children }) => {
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

  // ── Handle MSAL redirect callback (only when MSAL is available) ─
  useEffect(() => {
    if (!msalInstance || _msalRedirectHandled) return;
    _msalRedirectHandled = true;

    msalInstance
      .handleRedirectPromise()
      .then(async (response) => {
        if (!response) return;
        const { data } = await api.post('/auth/outlook', { accessToken: response.accessToken });
        localStorage.setItem('token', data.token);
        setUser(data.user);
      })
      .catch((err) => console.error('MSAL redirect error:', err));
  }, []);

  // ── Manual login ────────────────────────────────────────────
  const loginManual = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  }, []);

  // ── Outlook login (redirect – no popup) ─────────────────────
  const loginOutlook = useCallback(() => {
    if (!msalInstance) return;
    msalInstance.loginRedirect(loginRequest);
  }, []);

  // ── Logout ──────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    if (msalInstance && msalInstance.getAllAccounts().length > 0) {
      msalInstance.logoutRedirect({ account: msalInstance.getAllAccounts()[0] });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginManual, loginOutlook, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
