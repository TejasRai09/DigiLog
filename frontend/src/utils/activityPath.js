/**
 * Map SPA pathname → cascading activity dimensions (section / card / form).
 * Keep labels business-friendly (matches Admin_Audit_Log_Business_Overview).
 */

import { CONFIG_SECTION_ID_TO_LABEL } from './auditFilterTree';

const BI_DASHBOARDS = {
  '/bi/distillery-operations': 'Distillery Operations — Analytics',
  '/bi/milling-operations': 'Milling Division Cockpit',
  '/bi/purchy-analysis': 'Purchy Analysis',
  '/bi/brix-sampling': 'Brix Sampling Analytics',
  '/bi/centre-maturity': 'Centre Maturity Dashboard',
  '/bi/cane-performance': 'Cane Performance Dashboard',
  '/bi/power-house': 'Power House Dashboard',
  '/bi/management-dashboard': 'Management Dashboard',
};

/** Fallback names when the forms catalog lookup is unavailable. */
const FORM_LABELS = {
  '/forms/mill_logbook1': 'Equipment Temperature',
  '/forms/mill_logbook2': 'Shredder and OTG',
  '/forms/mill_logbook3': 'Lube Pressure and Roller Temp',
  '/forms/mill_stoppages': 'Mill Stoppages',
};

function titleFromSlug(slug) {
  return String(slug || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function classifyPath(pathname) {
  const raw = String(pathname || '/');
  const path = raw.split('?')[0] || '/';
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  const parts = path.split('/').filter(Boolean);
  let queryParams = null;
  try {
    queryParams = query ? new URLSearchParams(query) : null;
  } catch {
    queryParams = null;
  }

  let section = 'Dashboard';
  let card = null;
  let form_or_dashboard = null;
  let event_type = 'page_view';
  const crumbs = ['Dashboard'];

  if (path === '/' || path === '/dashboard') {
    section = 'Dashboard';
  } else if (path.startsWith('/maintenance/approvals')) {
    section = 'Approvals';
    crumbs.push('Approvals');
    event_type = 'page_view';
    const domain = queryParams?.get('domain') || queryParams?.get('dept');
    if (domain) {
      const map = {
        sugar: 'Sugar House',
        power: 'Power Plant',
        production: 'Production House',
      };
      card = map[String(domain).toLowerCase()] || titleFromSlug(domain);
      crumbs.push(card);
    }
    const status = queryParams?.get('status');
    if (status === 'approved') {
      form_or_dashboard = 'Approved';
      crumbs.push(form_or_dashboard);
    } else if (status === 'needs_modification' || status === 'modification') {
      form_or_dashboard = 'Sent for modification';
      crumbs.push(form_or_dashboard);
    }
  } else if (path.startsWith('/forms-hub')) {
    section = 'Forms Hub';
    crumbs.push('Forms Hub');
    event_type = 'section_open';
  } else if (path.startsWith('/apps/')) {
    section = 'Forms Hub';
    crumbs.push('Forms Hub');
    event_type = 'card_open';
  } else if (path.startsWith('/forms/')) {
    section = 'Forms Hub';
    crumbs.push('Forms Hub');
    const formKey = parts.slice(1).join('/');
    form_or_dashboard = FORM_LABELS[path] || titleFromSlug(formKey);
    crumbs.push(form_or_dashboard);
    event_type = 'form_open';
  } else if (path.startsWith('/bi')) {
    section = 'BI Control Tower';
    crumbs.push('BI Control Tower');
    event_type = path === '/bi' ? 'section_open' : 'dashboard_open';
    if (BI_DASHBOARDS[path]) {
      card = 'BI Dashboards';
      form_or_dashboard = BI_DASHBOARDS[path];
      crumbs.push(form_or_dashboard);
    } else if (parts.length > 1) {
      card = 'BI Dashboards';
      form_or_dashboard = titleFromSlug(parts.slice(1).join(' '));
      crumbs.push(form_or_dashboard);
    }
  } else if (path.startsWith('/power-plant-equipment-new') || path.startsWith('/power')) {
    section = 'Power Plant Equipment';
    crumbs.push('Power Plant Equipment');
    event_type = parts.length <= 1 ? 'section_open' : 'page_view';
    if (path.startsWith('/power/') && parts[1]) {
      card = titleFromSlug(parts[1]);
      crumbs.push(card);
    }
    const discipline = path.startsWith('/power-plant-equipment-new') ? parts[2] : null;
    if (discipline === 'specs' || discipline === 'schedule' || discipline === 'history') {
      form_or_dashboard = discipline === 'specs' ? 'Specs'
        : discipline === 'schedule' ? 'OEM Schedule'
        : 'Life History';
      crumbs.push(form_or_dashboard);
      event_type = 'equipment_section_open';
    } else if (discipline) {
      form_or_dashboard = titleFromSlug(discipline);
      crumbs.push(form_or_dashboard);
    }
  } else if (path.startsWith('/sugar-house-equipment-new')) {
    section = 'Sugar House Equipment';
    crumbs.push('Sugar House Equipment');
    event_type = parts.length <= 1 ? 'section_open' : 'page_view';
    if (parts[2] === 'specs' || parts[2] === 'schedule' || parts[2] === 'history') {
      form_or_dashboard = parts[2] === 'specs' ? 'Specs'
        : parts[2] === 'schedule' ? 'OEM Schedule'
        : 'Life History';
      crumbs.push(form_or_dashboard);
      event_type = 'equipment_section_open';
    } else if (parts[2]) {
      form_or_dashboard = titleFromSlug(parts[2]);
      crumbs.push(form_or_dashboard);
    }
  } else if (path.startsWith('/production-house-equipment')) {
    section = 'Production House Equipment';
    crumbs.push('Production House Equipment');
    event_type = parts.length <= 1 ? 'section_open' : 'page_view';
    if (parts[1] && /^\d+$/.test(parts[1])) {
      card = `Equipment #${parts[1]}`;
      crumbs.push(card);
    }
    if (parts[2] === 'specs' || parts[2] === 'schedule' || parts[2] === 'history') {
      form_or_dashboard = parts[2] === 'specs' ? 'Specs'
        : parts[2] === 'schedule' ? 'OEM Schedule'
        : 'Life History';
      crumbs.push(form_or_dashboard);
      event_type = 'equipment_section_open';
    } else if (parts[1] && /^\d+$/.test(parts[1]) && !parts[2]) {
      form_or_dashboard = `Equipment #${parts[1]}`;
    }
  } else if (path.startsWith('/equipment')) {
    section = 'Mill House Equipment';
    crumbs.push('Mill House Equipment');
    event_type = parts.length <= 1 ? 'section_open' : 'page_view';
    if (parts[1] && /^\d+$/.test(parts[1])) {
      card = `Equipment #${parts[1]}`;
      crumbs.push(card);
    }
    if (parts[2] === 'specs' || parts[2] === 'schedule' || parts[2] === 'history') {
      form_or_dashboard = parts[2] === 'specs' ? 'Specs'
        : parts[2] === 'schedule' ? 'OEM Schedule'
        : 'Life History';
      crumbs.push(form_or_dashboard);
      event_type = 'equipment_section_open';
    }
  } else if (path.startsWith('/admin')) {
    section = 'Admin Config';
    crumbs.push('Admin Config');
    event_type = path.includes('config') ? 'section_open' : 'page_view';
    if (queryParams?.get('section')) {
      const sectionParam = queryParams.get('section');
      card = CONFIG_SECTION_ID_TO_LABEL[sectionParam] || titleFromSlug(sectionParam);
      crumbs.push(card);
    } else if (parts[1]) {
      card = titleFromSlug(parts[1]);
      crumbs.push(card);
    }
  } else if (path.startsWith('/data-upload')) {
    section = 'Data Upload';
    crumbs.push('Data Upload');
    event_type = 'section_open';
    const area = queryParams?.get('area') || queryParams?.get('section');
    if (area) {
      const map = {
        purchy: 'Purchy',
        management: 'Management',
        milling: 'Milling',
      };
      card = map[String(area).toLowerCase()] || titleFromSlug(area);
      form_or_dashboard = card;
      crumbs.push(card);
    }
  } else if (path.startsWith('/ehs')) {
    section = 'Forms Hub';
    card = 'EHS';
    crumbs.push('Forms Hub', 'EHS');
    event_type = 'section_open';
  } else if (path.startsWith('/production')) {
    section = 'Forms Hub';
    card = 'Production';
    crumbs.push('Forms Hub', 'Production');
    event_type = 'section_open';
  } else if (parts.length) {
    section = titleFromSlug(parts[0]);
    crumbs.push(section);
  }

  return {
    event_type,
    section,
    card,
    form_or_dashboard,
    page_path: path,
    display_path: crumbs.filter(Boolean).join(' > '),
  };
}

export { BI_DASHBOARDS };
