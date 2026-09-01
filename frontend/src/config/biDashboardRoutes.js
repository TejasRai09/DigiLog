/** Must match `apps.name` for BI in seed / DB (employee mapping + admin modals). */
export const BI_CONTROL_TOWER_APP_NAME = 'BI Control Tower';

/** BI dashboard `form_key` → SPA path (employee-mapped like other forms; not `/forms/:key`). */
export const BI_DASHBOARD_PATH = {
  bi_distillery_operations: '/bi/distillery-operations',
  bi_milling_operations: '/bi/milling-operations',
  bi_purchy_analysis: '/bi/purchy-analysis',
  bi_brix_sampling: '/bi/brix-sampling',
  bi_centre_maturity: '/bi/centre-maturity',
  bi_cane_performance: '/bi/cane-performance',
  bi_power_house: '/bi/power-house',
  bi_management_dashboard: '/bi/management-dashboard',
};

export function isBiDashboardFormKey(formKey) {
  return formKey != null && Object.prototype.hasOwnProperty.call(BI_DASHBOARD_PATH, formKey);
}

export function biDashboardPath(formKey) {
  return BI_DASHBOARD_PATH[formKey] ?? null;
}
