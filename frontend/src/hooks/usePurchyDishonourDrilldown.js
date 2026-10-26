import { useMemo } from 'react';
import { DISHONOUR_DRILLDOWN } from '../data/purchyDrilldownStaticData';
import { usePurchyCachedGet } from './purchyQueryCache';

export const DISHONOUR_DRILLDOWN_PATH = '/bi/purchy/dishonour-drilldown';

export function dishonourDrilldownRequestParams(queryParams, {
  selectedSociety = null,
  selectedVillage = null,
  selectedGrower = null,
  autoSelect = false,
  page = 1,
  pageSize = 25,
} = {}) {
  return {
    ...queryParams,
    selectedSociety: selectedSociety || undefined,
    selectedVillage: selectedVillage || undefined,
    selectedGrower: selectedGrower || undefined,
    autoSelect: autoSelect ? '1' : undefined,
    page,
    pageSize,
  };
}

/** The auto-selected response also answers the follow-up request with the explicit selection. */
export function dishonourDrilldownAliasKeys(res, params) {
  if (!res?.selectedSociety) return [];
  const next = { ...(params || {}) };
  delete next.autoSelect;
  next.selectedSociety = res.selectedSociety;
  next.selectedVillage = res.selectedVillage || undefined;
  return [next];
}

export default function usePurchyDishonourDrilldown(queryParams, {
  enabled = true,
  selectedSociety = null,
  selectedVillage = null,
  selectedGrower = null,
  autoSelect = false,
  page = 1,
  pageSize = 25,
} = {}) {
  const requestParams = useMemo(() => dishonourDrilldownRequestParams(queryParams, {
    selectedSociety, selectedVillage, selectedGrower, autoSelect, page, pageSize,
  }), [queryParams, selectedSociety, selectedVillage, selectedGrower, autoSelect, page, pageSize]);

  const { data, loading, error } = usePurchyCachedGet(
    DISHONOUR_DRILLDOWN_PATH,
    requestParams,
    {
      enabled,
      errorMessage: 'Failed to load dishonour drilldown.',
      aliasKeys: dishonourDrilldownAliasKeys,
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
