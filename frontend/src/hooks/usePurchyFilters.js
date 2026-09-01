import { useCallback, useMemo, useState } from 'react';
import { PURCHY_STATIC_FILTER_OPTIONS } from '../data/purchyStaticData';
import { resolveFilterOptions } from '../utils/purchyStaticFilters';
import { usePurchyCachedGet } from './purchyQueryCache';

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
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const { data, loading, error } = usePurchyCachedGet(
    '/bi/purchy/filters',
    {},
    {
      enabled,
      mapResponse: (res) => resolveFilterOptions(res),
      errorMessage: 'Failed to load filter options.',
    },
  );

  const setFilter = useCallback((key, values) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const queryParams = useMemo(() => purchyFiltersToParams(filters), [filters]);

  const options = data || (error || !enabled ? PURCHY_STATIC_FILTER_OPTIONS : null);

  return {
    options,
    filters,
    setFilter,
    clearFilters,
    queryParams,
    loading: enabled && loading,
    error: enabled ? error : null,
  };
}
