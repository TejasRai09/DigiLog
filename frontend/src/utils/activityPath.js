/**
 * Map SPA pathname → cascading activity dimensions (section / card / form).
 * Keep labels business-friendly (matches Admin_Audit_Log_Business_Overview).
 */

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

  let section = 'Dashboard';
  let card = null;
  let form_or_dashboard = null;
  let event_type = 'page_view';
  const crumbs = ['Dashboard'];

  if (path === '/' || path === '/dashboard') {
    section = 'Dashboard';
  } else if (path.startsWith('/forms-hub')) {
    section = 'Forms Hub';
    crumbs.push('Forms Hub');
    event_type = 'section_open';
  } else if (path.startsWith('/apps/')) {
    // Card name is resolved server-side from the apps catalog.
    section = 'Forms Hub';
    crumbs.push('Forms Hub');
    event_type = 'card_open';
  } else if (path.startsWith('/forms/')) {
    // Card / form names are resolved server-side from the forms + apps catalog.
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
    // Equipment / node names are resolved server-side from the hierarchy tables.
    section = 'Power Plant Equipment';
    crumbs.push('Power Plant Equipment');
    event_type = parts.length <= 1 ? 'section_open' : 'page_view';
    if (path.startsWith('/power/') && parts[1]) {
      card = titleFromSlug(parts[1]);
      crumbs.push(card);
    }
    const discipline = path.startsWith('/power-plant-equipment-new') ? parts[2] : null;
    if (discipline) {
      form_or_dashboard = titleFromSlug(discipline);
      crumbs.push(form_or_dashboard);
    }
  } else if (path.startsWith('/sugar-house-equipment-new')) {
    section = 'Sugar House Equipment';
    crumbs.push('Sugar House Equipment');
    event_type = parts.length <= 1 ? 'section_open' : 'page_view';
    if (parts[2]) {
      form_or_dashboard = titleFromSlug(parts[2]);
      crumbs.push(form_or_dashboard);
    }
  } else if (path.startsWith('/equipment')) {
    section = 'Mill House Equipment';
    crumbs.push('Mill House Equipment');
    event_type = 'section_open';
  } else if (path.startsWith('/admin')) {
    section = 'Admin Config';
    crumbs.push('Admin Config');
    event_type = path.includes('config') ? 'section_open' : 'page_view';
    if (query.includes('section=')) {
      try {
        const sectionParam = new URLSearchParams(query).get('section');
        if (sectionParam) {
          card = titleFromSlug(sectionParam);
          crumbs.push(card);
        }
      } catch {
        /* ignore */
      }
    } else if (parts[1]) {
      card = titleFromSlug(parts[1]);
      crumbs.push(card);
    }
  } else if (path.startsWith('/data-upload')) {
    section = 'Data Upload';
    crumbs.push('Data Upload');
    event_type = 'section_open';
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
