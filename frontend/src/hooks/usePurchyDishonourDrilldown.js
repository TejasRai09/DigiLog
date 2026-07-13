import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { DISHONOUR_DRILLDOWN } from '../data/purchyDrilldownStaticData';

export default function usePurchyDishonourDrilldown(queryParams, {
  enabled = true,
  selectedSociety = null,
  selectedVillage = null,
  selectedGrower = null,
  page = 1,
  pageSize = 25,
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const requestParams = useMemo(() => ({
    ...queryParams,
    selectedSociety: selectedSociety || undefined,
    selectedVillage: selectedVillage || undefined,
    selectedGrower: selectedGrower || undefined,
    page,
    pageSize,
  }), [queryParams, selectedSociety, selectedVillage, selectedGrower, page, pageSize]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: res } = await api.get('/bi/purchy/dishonour-drilldown', { params: requestParams });
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load dishonour drilldown.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestParams, enabled]);

  const staticFallback = DISHONOUR_DRILLDOWN;

  return {
    data: enabled && data ? data : (enabled ? null : staticFallback),
    loading: enabled && loading,
    error: enabled ? error : null,
    staticFallback,
  };
}
