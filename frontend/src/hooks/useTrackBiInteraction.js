import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackActivityEvent } from '../utils/trackActivity';

const FILTER_BOOTSTRAP_MS = 1000;

function filterSignature({
  rangePreset,
  comparisonType,
  dateFrom,
  dateTo,
  extraFilters,
}) {
  return JSON.stringify({
    rangePreset: rangePreset ?? null,
    comparisonType: comparisonType ?? null,
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,
    extraFilters: extraFilters ?? null,
  });
}

/**
 * Track in-dashboard BI tabs and filter changes (skip initial mount).
 * Filter tracking waits ~1s so auto-seeded STD dates do not log as user filters.
 * Date-driven filter changes are debounced (~400ms).
 */
export default function useTrackBiInteraction({
  dashboardLabel,
  activeTab = null,
  rangePreset = null,
  comparisonType = null,
  dateFrom = null,
  dateTo = null,
  extraFilters = null,
}) {
  const location = useLocation();
  const tabReady = useRef(false);
  const filterReady = useRef(false);
  const lastTab = useRef(activeTab);
  const lastFilter = useRef(null);
  const dateTimer = useRef(null);

  const path = location.pathname;
  const extraKey = extraFilters == null ? null : JSON.stringify(extraFilters);

  useEffect(() => {
    const t = setTimeout(() => {
      filterReady.current = true;
    }, FILTER_BOOTSTRAP_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (activeTab == null) return undefined;
    if (!tabReady.current) {
      tabReady.current = true;
      lastTab.current = activeTab;
      return undefined;
    }
    if (lastTab.current === activeTab) return undefined;
    lastTab.current = activeTab;
    trackActivityEvent({
      event_type: 'dashboard_tab',
      section: 'BI Control Tower',
      card: 'BI Dashboards',
      form_or_dashboard: dashboardLabel,
      page_path: path,
      display_path: ['Dashboard', 'BI Control Tower', dashboardLabel, String(activeTab)]
        .filter(Boolean)
        .join(' > '),
      element_id: String(activeTab),
      element_label: String(activeTab),
      metadata: { tab: activeTab },
    });
    return undefined;
  }, [activeTab, dashboardLabel, path]);

  useEffect(() => {
    const hasFilter = rangePreset != null
      || comparisonType != null
      || dateFrom != null
      || dateTo != null
      || extraKey != null;
    if (!hasFilter) return undefined;

    let parsedExtra = null;
    if (extraKey) {
      try {
        parsedExtra = JSON.parse(extraKey);
      } catch {
        parsedExtra = null;
      }
    }

    const sig = filterSignature({
      rangePreset,
      comparisonType,
      dateFrom,
      dateTo,
      extraFilters: parsedExtra,
    });

    if (!filterReady.current) {
      lastFilter.current = sig;
      return undefined;
    }
    if (lastFilter.current === sig) return undefined;

    clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(() => {
      if (!filterReady.current) return;
      lastFilter.current = sig;
      trackActivityEvent({
        event_type: 'dashboard_filter',
        section: 'BI Control Tower',
        card: 'BI Dashboards',
        form_or_dashboard: dashboardLabel,
        page_path: path,
        display_path: ['Dashboard', 'BI Control Tower', dashboardLabel]
          .filter(Boolean)
          .join(' > '),
        metadata: {
          rangePreset: rangePreset ?? null,
          comparisonType: comparisonType ?? null,
          dateFrom: dateFrom ?? null,
          dateTo: dateTo ?? null,
          ...(parsedExtra && typeof parsedExtra === 'object' ? parsedExtra : {}),
        },
      });
    }, 400);

    return () => clearTimeout(dateTimer.current);
  }, [
    rangePreset,
    comparisonType,
    dateFrom,
    dateTo,
    extraKey,
    dashboardLabel,
    path,
  ]);
}
