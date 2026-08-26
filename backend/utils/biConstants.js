/**
 * Shared BI calculation constants stored in `portal_settings`, editable from
 * Admin → Config → BI Dashboards. Backend controllers read these live (per
 * request) so SQL aggregates (e.g. Brix threshold buckets) always match
 * whatever is currently configured — no redeploy needed.
 */
const { pool } = require('../config/mysql');

const BRIX_THRESHOLD_KEY = 'brix_threshold';
const BRIX_THRESHOLD_DEFAULT = 18;

/** Sugarcane Brix % threshold used by both Field ("< threshold") and Yard ("> threshold") dashboards. */
async function getBrixThreshold() {
  try {
    const [[row]] = await pool.query(
      'SELECT setting_value FROM portal_settings WHERE setting_key = ? LIMIT 1',
      [BRIX_THRESHOLD_KEY],
    );
    const val = parseFloat(row?.setting_value);
    return Number.isFinite(val) && val > 0 ? val : BRIX_THRESHOLD_DEFAULT;
  } catch {
    return BRIX_THRESHOLD_DEFAULT;
  }
}

module.exports = {
  BRIX_THRESHOLD_KEY,
  BRIX_THRESHOLD_DEFAULT,
  getBrixThreshold,
};
