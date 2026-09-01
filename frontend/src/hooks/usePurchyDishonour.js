import { useEffect, useState } from 'react';
import { usePurchyCachedGet } from './purchyQueryCache';

export default function usePurchyDishonour(queryParams, { enabled = true } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [queryParams, pageSize]);

  const kpiQ = usePurchyCachedGet(
    '/bi/purchy/dishonour/kpis',
    queryParams,
    {
      enabled,
      errorMessage: 'Failed to load KPIs.',
    },
  );

  const detailQ = usePurchyCachedGet(
    '/bi/purchy/dishonour/detail',
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
