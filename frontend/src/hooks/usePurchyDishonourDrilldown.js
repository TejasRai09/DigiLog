import { useMemo } from 'react';
import { DISHONOUR_DRILLDOWN } from '../data/purchyDrilldownStaticData';
import { usePurchyCachedGet } from './purchyQueryCache';

export default function usePurchyDishonourDrilldown(queryParams, {
  enabled = true,
  selectedSociety = null,
  selectedVillage = null,
  selectedGrower = null,
  autoSelect = false,
  page = 1,
  pageSize = 25,
} = {}) {
  const requestParams = useMemo(() => ({
    ...queryParams,
    selectedSociety: selectedSociety || undefined,
    selectedVillage: selectedVillage || undefined,
    selectedGrower: selectedGrower || undefined,
    autoSelect: autoSelect ? '1' : undefined,
    page,
    pageSize,
  }), [queryParams, selectedSociety, selectedVillage, selectedGrower, autoSelect, page, pageSize]);

  const { data, loading, error } = usePurchyCachedGet(
    '/bi/purchy/dishonour-drilldown',
    requestParams,
    {
      enabled,
      errorMessage: 'Failed to load dishonour drilldown.',
      aliasKeys: (res, params) => {
        if (!res?.selectedSociety) return [];
        const next = { ...(params || {}) };
        delete next.autoSelect;
        next.selectedSociety = res.selectedSociety;
        next.selectedVillage = res.selectedVillage || undefined;
        return [next];
      },
    },
  );

  const staticFallback = DISHONOUR_DRILLDOWN;

  return {
    data: enabled && data ? data : (enabled ? null : staticFallback),
    loading: enabled && loading,
    error: enabled ? error : null,
    staticFallback,
  };
}
