import axios from 'axios';

/** Prefer explicit API origin/path (prod / split hosts); else same-origin `/api` (nginx → Node :5000). */
function resolveApiBaseURL() {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed !== '') {
      return trimmed.replace(/\/+$/, '');
    }
  }
  return '/api';
}

const api = axios.create({
  baseURL: resolveApiBaseURL(),
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT + tracking session id to every request; let browser set multipart boundary for FormData
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const sessionId = sessionStorage.getItem('digilog_session_id') || localStorage.getItem('digilog_session_id');
  if (sessionId) config.headers['X-Session-Id'] = sessionId;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

/** Do not redirect when login/SSO failed — caller shows a toast instead. */
function isAuthAttempt(url) {
  if (!url) return false;
  const path = String(url).replace(/^.*\/api/, '');
  return (
    path === '/auth/login' ||
    path.startsWith('/auth/login?') ||
    path === '/auth/outlook' ||
    path === '/auth/google'
  );
}

// Global response error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !isAuthAttempt(err.config?.url)) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('digilog_session_id');
      localStorage.removeItem('digilog_session_id');
      window.location.href = '/?login=1';
    }
    return Promise.reject(err);
  }
);

export default api;
