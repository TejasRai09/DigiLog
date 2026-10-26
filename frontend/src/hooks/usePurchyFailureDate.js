import { useMemo } from 'react';
import { FAILURE_DATE_DRILLDOWN } from '../data/purchyDrilldownStaticData';
import { usePurchyCachedGet } from './purchyQueryCache';

export const FAILURE_DATE_PATH = '/bi/purchy/failure-by-date';

/** Power BI Date-wise Dishonour slicer defaults (match backend PBI_DEFAULT_DATE_FROM / TO). */
export const FAILURE_DATE_DEFAULT_FROM = '2025-10-24';
export const FAILURE_DATE_DEFAULT_TO = '2026-03-06';

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
    FAILURE_DATE_PATH,
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
