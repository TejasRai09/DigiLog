/** Hub module paths opened from Forms Hub apps (see `hubFormRoutes.js`). */
export const HUB_MODULE_LABELS = {
  '/ehs': 'EHS',
  '/equipment': 'Mill House Equipment',
  '/power': 'Power Plant',
};

/** Form keys that live under the EHS hub (not direct `/forms` children of an app list). */
export const EHS_FORM_KEYS = new Set([
  'ehs_near_miss',
  'ehs_water_gwa',
  'ehs_water_etp',
  'ehs_water_cpu',
  'ehs_accident',
]);

export function hubLabelForPath(path) {
  return HUB_MODULE_LABELS[path] ?? null;
}

export function ehsHubForFormKey(formKey) {
  if (formKey && EHS_FORM_KEYS.has(formKey)) {
    return { path: '/ehs', label: HUB_MODULE_LABELS['/ehs'] };
  }
  return null;
}

export function parentLabelFromReturnTo(returnTo) {
  if (!returnTo) return null;
  const hub = hubLabelForPath(returnTo);
  if (hub) return hub;
  if (returnTo.startsWith('/apps/')) return null;
  if (returnTo === '/forms-hub') return 'Forms Hub';
  if (returnTo === '/bi') return 'BI Control Tower';
  return null;
}
