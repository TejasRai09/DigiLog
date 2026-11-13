import { useEffect } from 'react';
import { fetchPurchyCached } from './purchyQueryCache';
import {
  DISHONOUR_KPIS_PATH,
  DISHONOUR_DETAIL_PATH,
  DISHONOUR_DEFAULT_PAGE_SIZE,
} from './usePurchyDishonour';
import {
  DISHONOUR_DRILLDOWN_PATH,
  dishonourDrilldownRequestParams,
  dishonourDrilldownAliasKeys,
} from './usePurchyDishonourDrilldown';
import { STAFF_DRILLDOWN_PATH } from './usePurchyStaffDrilldown';
import { FAILURE_DATE_PATH } from './usePurchyFailureDate';

/**
 * Warm the cache for each tab's default view, one request at a time so the
 * database is not flooded. Request params must match what each tab's hook sends,
 * otherwise the prefetch lands under a different cache key.
 */
function tabRequests(queryParams, dateFrom, dateTo) {
  const requests = [
    [DISHONOUR_KPIS_PATH, queryParams],
    [DISHONOUR_DETAIL_PATH, { ...queryParams, page: 1, pageSize: DISHONOUR_DEFAULT_PAGE_SIZE }],
    [
      DISHONOUR_DRILLDOWN_PATH,
      dishonourDrilldownRequestParams(queryParams, { autoSelect: true }),
      { aliasKeys: dishonourDrilldownAliasKeys },
    ],
    [STAFF_DRILLDOWN_PATH, queryParams],
  ];
  if (dateFrom && dateTo) {
    requests.push([
      FAILURE_DATE_PATH,
      { ...queryParams, dateFrom, dateTo },
    ]);
  }
  return requests;
}

export default function usePurchyTabPrefetch(queryParams, {
  enabled = true,
  dateFrom = null,
  dateTo = null,
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    (async () => {
      for (const [path, params, opts] of tabRequests(queryParams, dateFrom, dateTo)) {
        if (cancelled) return;
        try {
          // eslint-disable-next-line no-await-in-loop
          await fetchPurchyCached(path, params, opts);
        } catch {
          // The tab's own hook retries and reports errors when it is opened.
        }
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, queryParams, dateFrom, dateTo]);
}
