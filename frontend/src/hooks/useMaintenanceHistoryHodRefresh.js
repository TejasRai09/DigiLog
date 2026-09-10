import { useEffect, useRef } from 'react';
import { onRealtimeEvent, EVENT_NOTIFICATION_NEW } from '../realtime/socket';

const HOD_HISTORY_REFRESH_TYPES = new Set(['mh_approved', 'mh_needs_modification']);

/**
 * Reload equipment maintenance history when HOD approves or sends for modification
 * (Socket.IO notification to the submitter). Also quiet-refreshes when the tab
 * becomes visible again as a backup if the socket event was missed.
 *
 * @param {{
 *   equipId: string|number|null|undefined,
 *   domain?: 'power'|'sugar'|'production'|null,
 *   reload: (() => void|Promise<void>)|null|undefined,
 * }} opts
 */
export default function useMaintenanceHistoryHodRefresh({ equipId, domain = null, reload }) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const equipIdRef = useRef(equipId);
  equipIdRef.current = equipId;
  const domainRef = useRef(domain);
  domainRef.current = domain;

  useEffect(() => {
    const eid = equipIdRef.current;
    if (eid == null || eid === '' || eid === 'new') return undefined;

    return onRealtimeEvent(EVENT_NOTIFICATION_NEW, (payload) => {
      if (!HOD_HISTORY_REFRESH_TYPES.has(payload?.type)) return;

      const metaEquip = payload?.meta?.equipId;
      if (metaEquip != null && Number(metaEquip) !== Number(equipIdRef.current)) return;

      const metaDomain = payload?.meta?.domain;
      if (domainRef.current && metaDomain && metaDomain !== domainRef.current) return;

      const fn = reloadRef.current;
      if (typeof fn === 'function') {
        Promise.resolve(fn()).catch(() => { /* ignore quiet refresh errors */ });
      }
    });
  }, [equipId]);

  useEffect(() => {
    const eid = equipId;
    if (eid == null || eid === '' || eid === 'new') return undefined;

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const fn = reloadRef.current;
      if (typeof fn === 'function') {
        Promise.resolve(fn()).catch(() => { /* ignore */ });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [equipId]);
}
