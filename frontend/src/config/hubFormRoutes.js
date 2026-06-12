import { HUB_MODULE_LABELS } from './breadcrumbHubs';

/** Forms with `form_key` here open an app route instead of `/forms/:formKey`. Used for equipment-card browsers. */
export const HUB_FORM_PATH = {
  digilog_hub_mill_equipment: '/equipment',
  digilog_hub_power_equipment: '/power',
  digilog_hub_power_equipment_new: '/power-plant-equipment-new',
};

export function hubNavState(formKey, { appId, returnTo } = {}) {
  const path = HUB_FORM_PATH[formKey];
  if (!path) return {};
  const state = {
    hubPath: path,
    hubLabel: HUB_MODULE_LABELS[path] ?? 'Module',
  };
  if (appId != null && appId !== '') state.appId = String(appId);
  if (returnTo) state.returnTo = returnTo;
  else if (appId != null && appId !== '') state.returnTo = `/apps/${appId}`;
  return state;
}

export function isHubFormKey(formKey) {
  return formKey != null && Object.prototype.hasOwnProperty.call(HUB_FORM_PATH, formKey);
}

export function hubFormPath(formKey) {
  return HUB_FORM_PATH[formKey] ?? null;
}

/** When an app has exactly one hub form, open the hub route directly (no forms table). */
export function getSingleHubRoute(forms) {
  if (!Array.isArray(forms) || forms.length !== 1) return null;
  const formKey = forms[0]?.formKey;
  if (!isHubFormKey(formKey)) return null;
  const path = hubFormPath(formKey);
  return path ? { path, formKey } : null;
}
