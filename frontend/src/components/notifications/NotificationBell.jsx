import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotifications, MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import {
  connectRealtime,
  onRealtimeEvent,
  EVENT_NOTIFICATION_NEW,
} from '../../realtime/socket';
import notifySoundUrl from '../../assets/power-house/universfield-new-notification-012-363675.mp3';

/** Slow safety-net poll; realtime push handles instant delivery. */
const POLL_MS = 60_000;

function formatRelativeTime(value) {
  if (!value) return '';
  const s = String(value).trim();
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  const ms = (mysqlUtc
    ? new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}${mysqlUtc[3] || ''}Z`)
    : new Date(value)).getTime();
  if (!Number.isFinite(ms)) return '';
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
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

let sharedAudioCtx = null;
let audioUnlocked = false;
let notifyAudio = null;

function getNotifyAudio() {
  if (!notifyAudio) {
    notifyAudio = new Audio(notifySoundUrl);
    notifyAudio.preload = 'auto';
    notifyAudio.volume = 1;
  }
  return notifyAudio;
}

function unlockNotificationAudio() {
  if (audioUnlocked) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
    }
    const audio = getNotifyAudio();
    audio.muted = true;
    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    } else {
      audio.muted = false;
    }
    audioUnlocked = true;
  } catch {
    /* ignore */
  }
}

/** Play packaged notification MP3. */
async function playNotificationSound() {
  try {
    const audio = getNotifyAudio();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    await audio.play();
  } catch {
    /* autoplay may be blocked until a user gesture */
  }
}

const TOAST_STYLES = {
  mh_approved: {
    background: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
  },
  mh_needs_modification: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fde68a',
  },
  mh_pending_hod: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fde68a',
  },
};

function toastStyleForType(type) {
  return TOAST_STYLES[type] || {
    background: '#f8fafc',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
  };
}

function toastNotificationItem(n, openPanel) {
  const style = toastStyleForType(n?.type);
  toast(
    (t) => (
      <button
        type="button"
        className="text-left"
        onClick={() => {
          toast.dismiss(t.id);
          openPanel();
        }}
      >
        <p className="text-sm font-semibold" style={{ color: style.color }}>
          {n.title || 'New notification'}
        </p>
        {n.body ? (
          <p className="mt-0.5 line-clamp-2 text-xs opacity-90" style={{ color: style.color }}>
            {n.body}
          </p>
        ) : null}
      </button>
    ),
    {
      duration: 6500,
      style: {
        background: style.background,
        border: style.border,
        color: style.color,
      },
    },
  );
}

/**
 * Generic notification bell. Renders any notification with title/body/ctaLabel/linkUrl
 * so future types work without UI changes.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const openRef = useRef(false);
  const prevUnreadRef = useRef(null);
  const knownIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  openRef.current = open;

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 50 } });
      const next = Array.isArray(data?.items) ? data.items : [];
      setItems(next);
      return next;
    } catch {
      setItems([]);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  const announceNewNotifications = useCallback(async (prevCount, nextCount) => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      prevUnreadRef.current = nextCount;
      try {
        const { data } = await api.get('/notifications', { params: { limit: 50 } });
        const list = Array.isArray(data?.items) ? data.items : [];
        knownIdsRef.current = new Set(list.map((n) => n.id));
      } catch {
        knownIdsRef.current = new Set();
      }
      return;
    }

    if (!(nextCount > (prevCount || 0))) {
      prevUnreadRef.current = nextCount;
      return;
    }

    let fresh = [];
    try {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      const list = Array.isArray(data?.items) ? data.items : [];
      fresh = list.filter((n) => n?.id != null && !knownIdsRef.current.has(n.id) && !n.read);
      list.forEach((n) => {
        if (n?.id != null) knownIdsRef.current.add(n.id);
      });
      if (openRef.current) setItems(list);
    } catch {
      fresh = [];
    }

    if (!fresh.length) {
      // Count rose but we already handled these via Socket.IO — don't toast/sound again.
      prevUnreadRef.current = nextCount;
      return;
    }

    playNotificationSound();

    fresh.slice(0, 3).forEach((n) => {
      toastNotificationItem(n, () => setOpen(true));
    });
    if (fresh.length > 3) {
      toast(`+${fresh.length - 3} more notification${fresh.length - 3 === 1 ? '' : 's'}`, {
        duration: 4000,
      });
    }

    prevUnreadRef.current = nextCount;
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      const next = Number(data?.count) || 0;
      const prev = prevUnreadRef.current;
      setUnreadCount(next);
      await announceNewNotifications(prev, next);
    } catch {
      /* ignore transient poll errors */
    }
  }, [announceNewNotifications]);

  const handleRealtimeNotification = useCallback((payload) => {
    if (!payload || payload.id == null) return;
    if (knownIdsRef.current.has(payload.id)) return;
    knownIdsRef.current.add(payload.id);
    bootstrappedRef.current = true;

    const nextUnread = Number.isFinite(Number(payload.unreadCount))
      ? Number(payload.unreadCount)
      : (prevUnreadRef.current || 0) + 1;
    prevUnreadRef.current = nextUnread;
    setUnreadCount(nextUnread);

    if (openRef.current) {
      setItems((prev) => {
        if (prev.some((n) => n.id === payload.id)) return prev;
        return [payload, ...prev];
      });
    }

    playNotificationSound();
    toastNotificationItem(payload, () => setOpen(true));
  }, []);

  useEffect(() => {
    unlockNotificationAudio();
    const unlock = () => unlockNotificationAudio();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    connectRealtime();
    const off = onRealtimeEvent(EVENT_NOTIFICATION_NEW, handleRealtimeNotification);
    return () => {
      off();
    };
  }, [handleRealtimeNotification]);

  useEffect(() => {
    refreshUnread();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refreshUnread();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
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
      prevUnreadRef.current = 0;
    } catch {
      /* ignore */
    }
  };

  const removeNotification = async (id) => {
    const nid = Number(id);
    if (!nid) return;
    const prevItems = items;
    const removed = prevItems.find((n) => n.id === nid);
    setItems((prev) => prev.filter((n) => n.id !== nid));
    if (removed && !removed.read) {
      setUnreadCount((c) => {
        const next = Math.max(0, c - 1);
        prevUnreadRef.current = next;
        return next;
      });
    }
    knownIdsRef.current.delete(nid);
    try {
      await api.delete(`/notifications/${nid}`);
    } catch {
      setItems(prevItems);
      await refreshUnread();
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
        onClick={() => {
          unlockNotificationAudio();
          setOpen((v) => !v);
        }}
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
                  <p className="text-xs font-semibold leading-snug text-slate-900">
                    {item.title}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                    <button
                      type="button"
                      title="Remove notification"
                      aria-label="Remove notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(item.id);
                      }}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <MdClose className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
