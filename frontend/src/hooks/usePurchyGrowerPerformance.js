import { useEffect, useState } from 'react';
import { usePurchyCachedGet } from './purchyQueryCache';

export default function usePurchyGrowerPerformance(queryParams, { enabled = true } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [queryParams, pageSize]);

  const summaryQ = usePurchyCachedGet(
    '/bi/purchy/grower-performance/summary',
    queryParams,
    {
      enabled,
      initialData: [],
      mapResponse: (data) => data.rows || [],
      errorMessage: 'Failed to load summary.',
    },
  );

  const detailQ = usePurchyCachedGet(
    '/bi/purchy/grower-performance/detail',
    { ...queryParams, page, pageSize },
    {
      enabled,
      initialData: { rows: [], total: 0, page: 1, pageSize: 100 },
      errorMessage: 'Failed to load detail.',
    },
  );

  return {
    summary: summaryQ.data || [],
    detail: detailQ.data || { rows: [], total: 0, page: 1, pageSize: 100 },
    loadingSummary: summaryQ.loading,
    loadingDetail: detailQ.loading,
    error: summaryQ.error || detailQ.error,
    page,
    setPage,
    pageSize,
    setPageSize,
  };
}
