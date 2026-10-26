import { useEffect, useState } from 'react';
import { usePurchyCachedGet } from './purchyQueryCache';

export const DISHONOUR_KPIS_PATH = '/bi/purchy/dishonour/kpis';
export const DISHONOUR_DETAIL_PATH = '/bi/purchy/dishonour/detail';
export const DISHONOUR_DEFAULT_PAGE_SIZE = 25;

export default function usePurchyDishonour(queryParams, { enabled = true } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DISHONOUR_DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [queryParams, pageSize]);

  const kpiQ = usePurchyCachedGet(
    DISHONOUR_KPIS_PATH,
    queryParams,
    {
      enabled,
      errorMessage: 'Failed to load KPIs.',
    },
  );

  const detailQ = usePurchyCachedGet(
    DISHONOUR_DETAIL_PATH,
    { ...queryParams, page, pageSize },
    {
      enabled,
      initialData: { rows: [], total: 0, page: 1, pageSize: 100 },
      errorMessage: 'Failed to load detail.',
    },
  );

  return {
    kpis: kpiQ.data,
    detail: detailQ.data || { rows: [], total: 0, page: 1, pageSize: 100 },
    loadingKpis: kpiQ.loading,
    loadingDetail: detailQ.loading,
    error: kpiQ.error || detailQ.error,
    page,
    setPage,
    pageSize,
    setPageSize,
  };
}
