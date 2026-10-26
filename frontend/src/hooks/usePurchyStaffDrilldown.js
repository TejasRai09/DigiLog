import { HIERARCHY_DRILLDOWN } from '../data/purchyDrilldownStaticData';
import { usePurchyCachedGet } from './purchyQueryCache';

export const STAFF_DRILLDOWN_PATH = '/bi/purchy/staff-drilldown';

export default function usePurchyStaffDrilldown(queryParams, { enabled = true } = {}) {
  const { data, loading, error } = usePurchyCachedGet(
    STAFF_DRILLDOWN_PATH,
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
