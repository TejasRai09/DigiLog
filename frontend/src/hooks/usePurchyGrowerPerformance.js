import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function usePurchyGrowerPerformance(queryParams, { enabled = true } = {}) {
  const [summary, setSummary] = useState([]);
  const [detail, setDetail] = useState({ rows: [], total: 0, page: 1, pageSize: 100 });
  const [loadingSummary, setLoadingSummary] = useState(enabled);
  const [loadingDetail, setLoadingDetail] = useState(enabled);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [queryParams, pageSize]);

  useEffect(() => {
    if (!enabled) {
      setLoadingSummary(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingSummary(true);
        const { data } = await api.get('/bi/purchy/grower-performance/summary', { params: queryParams });
        if (!cancelled) {
          setSummary(data.rows || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load summary.');
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
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
        const { data } = await api.get('/bi/purchy/grower-performance/detail', {
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
    summary,
    detail,
    loadingSummary,
    loadingDetail,
    error,
    page,
    setPage,
    pageSize,
    setPageSize,
  };
}
