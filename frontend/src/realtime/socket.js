import { io } from 'socket.io-client';

const EVENT_NOTIFICATION_NEW = 'notification:new';

let socket = null;
let connectedToken = '';
const listeners = new Map(); // event -> Set<fn>

function resolveSocketOrigin() {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      // VITE_API_URL may be full API root including /api
      const u = new URL(raw.trim(), window.location.origin);
      return u.origin;
    } catch {
      /* fall through */
    }
  }
  return window.location.origin;
}

function getToken() {
  return localStorage.getItem('token') || '';
}

function notifyLocal(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error('[realtime] listener error:', err);
    }
  });
}

/**
 * Connect (or reconnect) Socket.IO with the current JWT.
 * No-op when there is no token.
 */
export function connectRealtime() {
  const token = getToken();
  if (!token) {
    disconnectRealtime();
    return null;
  }

  if (socket?.connected && connectedToken === token) {
    return socket;
  }

  disconnectRealtime();
  connectedToken = token;

  socket = io(resolveSocketOrigin(), {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect_error', (err) => {
    console.warn('[realtime] connect_error:', err?.message || err);
  });

  socket.on(EVENT_NOTIFICATION_NEW, (payload) => {
    notifyLocal(EVENT_NOTIFICATION_NEW, payload);
  });

  return socket;
}

export function disconnectRealtime() {
  connectedToken = '';
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.disconnect();
  } catch {
    /* ignore */
  }
  socket = null;
}

/**
 * Subscribe to a realtime event. Returns unsubscribe fn.
 */
export function onRealtimeEvent(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (!set.size) listeners.delete(event);
  };
}

export { EVENT_NOTIFICATION_NEW };
