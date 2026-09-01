import { useMemo } from 'react';
import { FAILURE_DATE_DRILLDOWN } from '../data/purchyDrilldownStaticData';
import { usePurchyCachedGet } from './purchyQueryCache';

export default function usePurchyFailureDate(queryParams, {
  enabled = true,
  dateFrom,
  dateTo,
} = {}) {
  const requestParams = useMemo(() => ({
    ...queryParams,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }), [queryParams, dateFrom, dateTo]);

  const { data, loading, error } = usePurchyCachedGet(
    '/bi/purchy/failure-by-date',
    requestParams,
    {
      enabled,
      errorMessage: 'Failed to load failure by date.',
    },
  );

  return {
    data: enabled && data ? data : (enabled ? null : FAILURE_DATE_DRILLDOWN),
    loading: enabled && loading,
    error: enabled ? error : null,
    staticFallback: FAILURE_DATE_DRILLDOWN,
  };
}
