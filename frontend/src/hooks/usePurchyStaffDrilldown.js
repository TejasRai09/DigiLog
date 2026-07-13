import { useEffect, useState } from 'react';
import api from '../api/axios';
import { HIERARCHY_DRILLDOWN } from '../data/purchyDrilldownStaticData';

export default function usePurchyStaffDrilldown(queryParams, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: res } = await api.get('/bi/purchy/staff-drilldown', { params: queryParams });
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load staff drilldown.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryParams, enabled]);

  return {
    data: enabled && data ? data : (enabled ? null : HIERARCHY_DRILLDOWN),
    loading: enabled && loading,
    error: enabled ? error : null,
    staticFallback: HIERARCHY_DRILLDOWN,
  };
}
