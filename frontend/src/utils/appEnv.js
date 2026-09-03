/** True when frontend was built with VITE_APP_ENV=staging */
export function isStagingEnv() {
  return String(import.meta.env.VITE_APP_ENV || '').toLowerCase() === 'staging';
}
