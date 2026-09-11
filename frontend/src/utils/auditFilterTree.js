import { isRetiredFormsHubApp } from '../config/retiredFormsHubApps';

/**
 * Prefilled Audit & Activity cascade (app IA) — not derived from log DISTINCT.
 * L1 Area → L2 Section → L3 Detail → L4 Card → L5 Screen (when applicable).
 *
 * Does not rewrite historical DB log rows; DigiLog filters map onto existing columns.
 */

export const BI_DASHBOARD_FILTER_LABELS = [
  'Distillery Operations — Analytics',
  'Milling Division Cockpit',
  'Purchy Analysis',
  'Brix Sampling Analytics',
  'Centre Maturity Dashboard',
  'Cane Performance Dashboard',
  'Power House Dashboard',
  'Management Dashboard',
];

export const CONFIG_TAB_FILTER_LABELS = [
  'Employees',
  'Employee Categories',
  'Season Mapping',
  'BI Dashboards',
  'Audit & Activity',
  'Maintenance History Approval',
];

export const CRUD_FILTER_LABELS = ['Create', 'Update', 'Delete'];

/** Forms Hub equipment hub card labels (breadcrumbHubs HUB_MODULE_LABELS). Mill House retired. */
export const EQUIPMENT_HUB_FILTER_LABELS = [
  'Sugar House Equipment',
  'Power Plant Equipment',
  'Production House Equipment',
];

/** Equipment detail screens (audit RESOURCE_SEGMENT_LABELS). */
export const EQUIPMENT_SCREEN_FILTER_LABELS = [
  'Specs',
  'OEM Schedule',
  'Life History',
];

/**
 * Static fallback for Forms Hub form-app cards (exclude BI + equipment history hubs).
 * DigiLog UI prefers live `/admin/apps-all` and falls back to this list.
 */
export const FORMS_CARD_FILTER_LABELS = [
  'Mill House',
  'Laboratory',
  'Power House',
  'Distillery',
  'Brix Sampling',
  'EHS — Environment Health & Safety',
  'Production',
];

/** App names that are equipment hubs (excluded from Forms cards L4). */
export const EQUIPMENT_HUB_APP_NAME_RE = /equipment history/i;

export function isEquipmentHubAppName(name) {
  return EQUIPMENT_HUB_APP_NAME_RE.test(String(name || ''));
}

export function isBiControlTowerAppName(name) {
  return String(name || '').trim() === 'BI Control Tower';
}

/** Filter apps list → Forms Hub form cards for L4. */
export function formsCardsFromApps(apps) {
  if (!Array.isArray(apps)) return [...FORMS_CARD_FILTER_LABELS];
  const names = apps
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean)
    .map((n) => String(n).trim())
    .filter((n) => n
      && !isBiControlTowerAppName(n)
      && !isEquipmentHubAppName(n)
      && !isRetiredFormsHubApp(n));
  return names.length ? [...new Set(names)].sort((a, b) => a.localeCompare(b)) : [...FORMS_CARD_FILTER_LABELS];
}

/** @type {Record<string, Record<string, string[]>>} */
export const AUDIT_FILTER_TREE = {
  Home: {
    'Forms Hub': ['Forms cards', 'Equipment specification cards'],
    'BI Control Tower': [...BI_DASHBOARD_FILTER_LABELS],
  },
  Approvals: {
    'Sugar House': ['Approved', 'Sent for modification'],
    'Power Plant': ['Approved', 'Sent for modification'],
    'Production House': ['Approved', 'Sent for modification'],
  },
  Config: Object.fromEntries(CONFIG_TAB_FILTER_LABELS.map((t) => [t, [...CRUD_FILTER_LABELS]])),
  'Data Upload': {
    Purchy: [],
    Management: [],
    Milling: [],
  },
};

export function auditFilterRoots() {
  return Object.keys(AUDIT_FILTER_TREE);
}

export function auditFilterBranches(root) {
  if (!root || !AUDIT_FILTER_TREE[root]) return [];
  return Object.keys(AUDIT_FILTER_TREE[root]);
}

export function auditFilterLeaves(root, branch) {
  if (!root || !branch || !AUDIT_FILTER_TREE[root]) return [];
  return AUDIT_FILTER_TREE[root][branch] || [];
}

/**
 * L4 Card options.
 * @param {string[]} [formsCardLabels] live forms-card names (optional)
 */
export function auditFilterCards(root, branch, leaf, formsCardLabels) {
  if (root !== 'Home' || branch !== 'Forms Hub') return [];
  if (leaf === 'Forms cards') {
    return Array.isArray(formsCardLabels) && formsCardLabels.length
      ? formsCardLabels
      : [...FORMS_CARD_FILTER_LABELS];
  }
  if (leaf === 'Equipment specification cards') {
    return [...EQUIPMENT_HUB_FILTER_LABELS];
  }
  return [];
}

/** L5 Screen options (equipment hubs only). */
export function auditFilterScreens(root, branch, leaf, card) {
  if (root !== 'Home' || branch !== 'Forms Hub') return [];
  if (leaf !== 'Equipment specification cards') return [];
  if (!card || !EQUIPMENT_HUB_FILTER_LABELS.includes(card)) return [];
  return [...EQUIPMENT_SCREEN_FILTER_LABELS];
}

/** Config URL ?section= id → filter / activity card label */
export const CONFIG_SECTION_ID_TO_LABEL = {
  employees: 'Employees',
  categories: 'Employee Categories',
  'season-mapping': 'Season Mapping',
  'bi-dashboards': 'BI Dashboards',
  'audit-log': 'Audit & Activity',
  'maintenance-history-approval': 'Maintenance History Approval',
};
