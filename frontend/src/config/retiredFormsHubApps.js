/** Forms Hub apps that must not appear in navigation or employee form mapping. */
export const RETIRED_FORMS_HUB_APP_NAMES = new Set([
  'Mill House Equipment History',
  'Power Plant Equipment History (old)',
]);

export function isRetiredFormsHubApp(name) {
  return RETIRED_FORMS_HUB_APP_NAMES.has(String(name || '').trim());
}
