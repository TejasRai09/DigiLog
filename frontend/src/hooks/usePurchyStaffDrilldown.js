import { HIERARCHY_DRILLDOWN } from '../data/purchyDrilldownStaticData';
import { usePurchyCachedGet } from './purchyQueryCache';

export default function usePurchyStaffDrilldown(queryParams, { enabled = true } = {}) {
  const { data, loading, error } = usePurchyCachedGet(
    '/bi/purchy/staff-drilldown',
    queryParams,
    {
      enabled,
      errorMessage: 'Failed to load staff drilldown.',
    },
  );

  return {
    data: enabled && data ? data : (enabled ? null : HIERARCHY_DRILLDOWN),
    loading: enabled && loading,
    error: enabled ? error : null,
    staticFallback: HIERARCHY_DRILLDOWN,
  };
}
