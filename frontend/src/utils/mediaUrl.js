/** Resolve avatar/media for <img src>: API-relative paths, absolute URLs, or legacy data URLs. */
export function mediaUrl(stored) {
  if (stored == null || stored === '') return null;
  const s = String(stored);
  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) {
    const raw = import.meta.env.VITE_API_URL;
    const base =
      typeof raw === 'string' && raw.trim() !== ''
        ? raw.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '')
        : '';
    return `${base}${s}`;
  }
  return s;
}
