import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { PURCHY_STATIC_FILTER_OPTIONS } from '../data/purchyStaticData';
import { resolveFilterOptions } from '../utils/purchyStaticFilters';

const EMPTY_FILTERS = {
  societyName: [],
  loyaltySlicer: [],
  zoneHead: [],
  zonalManager: [],
  zonalIncharge: [],
  villageStaff: [],
  dishonourBucket: [],
};

export function purchyFiltersToParams(filters) {
  const params = {};
  Object.entries(filters).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length) {
      params[key] = values.join(',');
    }
  });
  return params;
}

export default function usePurchyFilters({ enabled = true } = {}) {
  const [options, setOptions] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setOptions(PURCHY_STATIC_FILTER_OPTIONS);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/bi/purchy/filters');
        if (!cancelled) {
          setOptions(resolveFilterOptions(data));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load filter options.');
          setOptions(PURCHY_STATIC_FILTER_OPTIONS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const setFilter = useCallback((key, values) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const queryParams = useMemo(() => purchyFiltersToParams(filters), [filters]);

  return {
    options: options || (enabled ? null : PURCHY_STATIC_FILTER_OPTIONS),
    filters,
    setFilter,
    clearFilters,
    queryParams,
    loading,
    error: enabled ? error : null,
  };
}
