/** Forms with `form_key` here open an app route instead of `/forms/:formKey`. Used for module hubs (equipment, EHS). */
export const HUB_FORM_PATH = {
  digilog_hub_mill_equipment: '/equipment',
  digilog_hub_power_equipment: '/power',
  digilog_hub_ehs: '/ehs',
};

export function isHubFormKey(formKey) {
  return formKey != null && Object.prototype.hasOwnProperty.call(HUB_FORM_PATH, formKey);
}

export function hubFormPath(formKey) {
  return HUB_FORM_PATH[formKey] ?? null;
}
