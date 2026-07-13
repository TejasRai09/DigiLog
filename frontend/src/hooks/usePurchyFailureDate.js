import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { FAILURE_DATE_DRILLDOWN } from '../data/purchyDrilldownStaticData';

export default function usePurchyFailureDate(queryParams, {
  enabled = true,
  dateFrom,
  dateTo,
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const requestParams = useMemo(() => ({
    ...queryParams,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }), [queryParams, dateFrom, dateTo]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: res } = await api.get('/bi/purchy/failure-by-date', { params: requestParams });
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load failure by date.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestParams, enabled]);

  return {
    data: enabled && data ? data : (enabled ? null : FAILURE_DATE_DRILLDOWN),
    loading: enabled && loading,
    error: enabled ? error : null,
    staticFallback: FAILURE_DATE_DRILLDOWN,
  };
}
