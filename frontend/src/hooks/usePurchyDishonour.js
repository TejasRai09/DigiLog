import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function usePurchyDishonour(queryParams, { enabled = true } = {}) {
  const [kpis, setKpis] = useState(null);
  const [detail, setDetail] = useState({ rows: [], total: 0, page: 1, pageSize: 100 });
  const [loadingKpis, setLoadingKpis] = useState(enabled);
  const [loadingDetail, setLoadingDetail] = useState(enabled);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [queryParams, pageSize]);

  useEffect(() => {
    if (!enabled) {
      setLoadingKpis(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingKpis(true);
        const { data } = await api.get('/bi/purchy/dishonour/kpis', { params: queryParams });
        if (!cancelled) {
          setKpis(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load KPIs.');
        }
      } finally {
        if (!cancelled) setLoadingKpis(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryParams, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoadingDetail(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingDetail(true);
        const { data } = await api.get('/bi/purchy/dishonour/detail', {
          params: { ...queryParams, page, pageSize },
        });
        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load detail.');
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryParams, page, pageSize, enabled]);

  return {
    kpis,
    detail,
    loadingKpis,
    loadingDetail,
    error,
    page,
    setPage,
    pageSize,
    setPageSize,
  };
}
