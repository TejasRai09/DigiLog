import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotifications, MdClose } from 'react-icons/md';
import api from '../../api/axios';

const POLL_MS = 60_000;

function formatRelativeTime(value) {
  if (!value) return '';
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return '';
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString();
}

function toAppPath(linkUrl) {
  if (!linkUrl) return null;
  const raw = String(linkUrl).trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return raw.startsWith('/') ? raw : null;
  }
}

/**
 * Generic notification bell. Renders any notification with title/body/ctaLabel/linkUrl
 * so future types work without UI changes.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(Number(data?.count) || 0);
    } catch {
      /* ignore transient poll errors */
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 50 } });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    refreshUnread();
    const id = window.setInterval(refreshUnread, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return undefined;
    refreshList();
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, refreshList]);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      await refreshUnread();
    } catch {
      /* keep UI usable */
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const handleOpenCta = async (item) => {
    if (!item?.read) await markRead(item.id);
    const path = toAppPath(item.linkUrl);
    setOpen(false);
    if (path) navigate(path);
  };

  const handleRowClick = async (item) => {
    if (!item?.read) await markRead(item.id);
  };

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <MdNotifications className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-[60] mt-2 flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(28rem,70vh)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close notifications"
              >
                <MdClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-slate-400">Loading…</p>
            )}
            {!loadingList && items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-slate-400">No notifications</p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(item);
                  }
                }}
                className={`border-b border-slate-50 px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                  item.read ? 'bg-white' : 'bg-amber-50/70'
                } hover:bg-slate-50`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-xs font-semibold leading-snug text-slate-900 ${item.read ? '' : ''}`}>
                    {item.title}
                  </p>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
                {item.body && (
                  <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-slate-600">
                    {item.body}
                  </p>
                )}
                {item.ctaLabel && item.linkUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCta(item);
                    }}
                    className="mt-2 inline-flex rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    {item.ctaLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
