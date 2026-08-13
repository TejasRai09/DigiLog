import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';
import { classifyPath } from '../utils/activityPath';

const SESSION_KEY = 'digilog_session_id';
const HEARTBEAT_MS = 60 * 1000;

export function getStoredSessionId() {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || null;
}

export function setStoredSessionId(id) {
  if (!id) {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, id);
  localStorage.setItem(SESSION_KEY, id);
}

export async function startTrackingSession() {
  const { data } = await api.post('/auth/session/start');
  if (data?.session_id) setStoredSessionId(data.session_id);
  return data?.session_id || null;
}

export async function endTrackingSession() {
  const sessionId = getStoredSessionId();
  try {
    if (sessionId) {
      await api.post('/auth/logout', { session_id: sessionId });
    }
  } catch {
    /* best-effort */
  } finally {
    setStoredSessionId(null);
  }
}

/**
 * Starts/keeps session + records page views with dwell time.
 * Mount inside AuthProvider + BrowserRouter.
 */
export default function ActivityTracker() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const activityIdRef = useRef(null);
  const enteredAtRef = useRef(null);
  const startingRef = useRef(false);

  // Ensure session exists when authenticated
  useEffect(() => {
    if (loading || !user) return undefined;
    let cancelled = false;

    const ensure = async () => {
      if (getStoredSessionId() || startingRef.current) return;
      startingRef.current = true;
      try {
        await startTrackingSession();
      } catch {
        /* ignore — tracking is best-effort */
      } finally {
        startingRef.current = false;
      }
    };

    ensure();

    const heartbeat = setInterval(() => {
      const sid = getStoredSessionId();
      if (!sid || cancelled) return;
      api.post('/auth/session/heartbeat', { session_id: sid }).catch(() => {});
    }, HEARTBEAT_MS);

    const onUnload = () => {
      const sid = getStoredSessionId();
      if (!sid) return;
      const url = `${api.defaults.baseURL}/auth/session/heartbeat`;
      const body = JSON.stringify({ session_id: sid });
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [user, loading]);

  // Clear session storage on logout
  useEffect(() => {
    if (!loading && !user) {
      setStoredSessionId(null);
      activityIdRef.current = null;
      enteredAtRef.current = null;
    }
  }, [user, loading]);

  // Page views + dwell
  useEffect(() => {
    if (loading || !user) return undefined;

    let cancelled = false;
    const pathWithSearch = `${location.pathname}${location.search || ''}`;

    const exitPrevious = async () => {
      const prevId = activityIdRef.current;
      const enteredAt = enteredAtRef.current;
      activityIdRef.current = null;
      enteredAtRef.current = null;
      if (!prevId || !enteredAt) return;
      const dwell = Math.max(0, Math.round((Date.now() - enteredAt) / 1000));
      try {
        await api.patch(`/activity/${prevId}/exit`, { dwell_seconds: dwell });
      } catch {
        /* ignore */
      }
    };

    const enter = async () => {
      await exitPrevious();
      if (cancelled) return;
      const sid = getStoredSessionId();
      if (!sid) return;
      const meta = classifyPath(pathWithSearch);
      try {
        const { data } = await api.post('/activity/page-view', {
          session_id: sid,
          ...meta,
        });
        if (!cancelled && data?.id) {
          activityIdRef.current = data.id;
          enteredAtRef.current = Date.now();
        }
      } catch {
        /* ignore */
      }
    };

    // Small delay so session/start can finish after login
    const t = setTimeout(enter, 50);

    return () => {
      cancelled = true;
      clearTimeout(t);
      // fire-and-forget exit on route change cleanup
      const prevId = activityIdRef.current;
      const enteredAt = enteredAtRef.current;
      if (prevId && enteredAt) {
        const dwell = Math.max(0, Math.round((Date.now() - enteredAt) / 1000));
        api.patch(`/activity/${prevId}/exit`, { dwell_seconds: dwell }).catch(() => {});
      }
    };
  }, [location.pathname, location.search, user, loading]);

  return null;
}
