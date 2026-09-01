import { usePurchyCachedGet } from './purchyQueryCache';

export default function usePurchyVarietyType(queryParams, { enabled = true } = {}) {
  const { data, loading, error } = usePurchyCachedGet(
    '/bi/purchy/staff-variety-type',
    queryParams,
    {
      enabled,
      errorMessage: 'Failed to load variety type breakdown.',
    },
  );

  return {
    data: enabled ? data : null,
    loading: enabled && loading,
    error: enabled ? error : null,
  };
}
