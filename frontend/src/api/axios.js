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

// Attach JWT to every request; let browser set multipart boundary for FormData
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

// Global response error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
