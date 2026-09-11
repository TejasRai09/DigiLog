import api from '../api/axios';
import { getStoredSessionId } from '../components/ActivityTracker';
import { withoutGsmaLabel } from './displayLabels';
import { classifyPath } from './activityPath';

/**
 * Best-effort activity event (does not manage dwell / exit).
 * No-op when logged out or session id is missing.
 */
export async function trackActivityEvent(payload = {}) {
  try {
    const session_id = getStoredSessionId();
    if (!session_id) return null;

    const page_path = payload.page_path
      ?? (typeof window !== 'undefined' ? window.location.pathname : null);

    const { data } = await api.post('/activity/page-view', {
      session_id,
      event_type: payload.event_type || 'page_view',
      section: payload.section ?? null,
      card: payload.card ?? null,
      form_or_dashboard: payload.form_or_dashboard ?? null,
      page_path,
      display_path: payload.display_path ?? null,
      element_id: payload.element_id ?? null,
      element_label: payload.element_label ?? null,
      metadata: payload.metadata ?? null,
    });
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Forms Hub View Data / CSV helpers */
export function trackFormDataAction({ event_type, form, appName = null, appId = null }) {
  const formName = withoutGsmaLabel(form?.name) || form?.formKey || 'Form';
  const card = withoutGsmaLabel(appName) || null;
  const crumbs = ['Dashboard', 'Forms Hub', card, formName].filter(Boolean);
  return trackActivityEvent({
    event_type,
    section: 'Forms Hub',
    card,
    form_or_dashboard: formName,
    page_path: typeof window !== 'undefined' ? window.location.pathname : null,
    display_path: crumbs.join(' > '),
    element_id: form?.formKey || null,
    element_label: formName,
    metadata: {
      form_key: form?.formKey || null,
      app_id: appId != null ? String(appId) : null,
    },
  });
}

const EQUIPMENT_SECTION_LABELS = {
  specs: 'Specs',
  schedule: 'OEM Schedule',
  history: 'Life History',
};

/** Specs / OEM Schedule / Life History section open (same URL). */
export function trackEquipmentSectionOpen(sectionKey) {
  const label = EQUIPMENT_SECTION_LABELS[sectionKey] || sectionKey;
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  // Discipline routes already emit equipment_section_open via ActivityTracker.
  if (/\/(specs|schedule|history)(?:\/|$)/.test(path)) return null;

  const base = classifyPath(path);
  const crumbs = ['Dashboard', base.section, base.card, label].filter(Boolean);
  return trackActivityEvent({
    event_type: 'equipment_section_open',
    section: base.section,
    card: base.card,
    form_or_dashboard: label,
    page_path: path,
    display_path: crumbs.join(' > '),
    element_id: sectionKey,
    element_label: label,
    metadata: { equipment_section: sectionKey },
  });
}

/** Equipment detail PDF download (after successful export). */
export function trackEquipmentPdfDownload({ sections = [], equipmentName = null } = {}) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const base = classifyPath(path);
  const label = equipmentName || base.card || 'Equipment';
  return trackActivityEvent({
    event_type: 'download_pdf',
    section: base.section,
    card: base.card || label,
    form_or_dashboard: 'Download PDF',
    page_path: path,
    display_path: ['Dashboard', base.section, base.card || label, 'Download PDF']
      .filter(Boolean)
      .join(' > '),
    element_label: 'Download PDF',
    metadata: {
      sections,
      equipment: label,
    },
  });
}

/** BI chart expand-modal CSV download. */
export function trackChartDownloadCsv({ dashboardLabel, chartId = null, chartTitle = null } = {}) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return trackActivityEvent({
    event_type: 'chart_download_csv',
    section: 'BI Control Tower',
    card: 'BI Dashboards',
    form_or_dashboard: dashboardLabel || null,
    page_path: path,
    display_path: ['Dashboard', 'BI Control Tower', dashboardLabel].filter(Boolean).join(' > '),
    element_id: chartId || null,
    element_label: chartTitle || chartId || 'Chart CSV',
    metadata: {
      chart_id: chartId,
      chart_title: chartTitle,
    },
  });
}
