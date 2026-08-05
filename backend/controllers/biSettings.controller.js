const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');

const SETTING_KEY = 'bi_third_season_compare';
const DASHBOARD_SEASONS_KEY = 'bi_dashboard_seasons';
const LEGACY_VISIBLE_SEASONS_KEY = 'bi_visible_seasons';

function parseBool(v) {
  return v === '1' || v === 'true' || v === true;
}

function parseJsonObject(v) {
  if (!v) return {};
  try {
    const parsed = JSON.parse(v);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(v) {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** GET /api/bi/settings — BI dashboard options for signed-in users */
const getBiSettings = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (?, ?, ?)',
      [SETTING_KEY, DASHBOARD_SEASONS_KEY, LEGACY_VISIBLE_SEASONS_KEY],
    );
    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value; });

    let dashboardSeasons = parseJsonObject(map[DASHBOARD_SEASONS_KEY]);
    const legacySeasons = parseJsonArray(map[LEGACY_VISIBLE_SEASONS_KEY]);

    if (Object.keys(dashboardSeasons).length === 0 && legacySeasons.length > 0) {
      dashboardSeasons = {
        brix_sampling: legacySeasons,
        centre_maturity: legacySeasons,
      };
    }

    res.json({
      thirdSeasonCompareEnabled: parseBool(map[SETTING_KEY]),
      dashboardSeasons,
    });
  } catch (err) {
    sendServerError(res, 'getBiSettings', err, MSG.LOAD);
  }
};

/** GET /api/admin/bi-settings */
const getAdminBiSettings = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value, updated_at FROM portal_settings WHERE setting_key IN (?, ?, ?)',
      [SETTING_KEY, DASHBOARD_SEASONS_KEY, LEGACY_VISIBLE_SEASONS_KEY],
    );
    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value; });

    let dashboardSeasons = parseJsonObject(map[DASHBOARD_SEASONS_KEY]);
    const legacySeasons = parseJsonArray(map[LEGACY_VISIBLE_SEASONS_KEY]);

    if (Object.keys(dashboardSeasons).length === 0 && legacySeasons.length > 0) {
      dashboardSeasons = {
        brix_sampling: legacySeasons,
        centre_maturity: legacySeasons,
      };
    }

    res.json({
      thirdSeasonCompareEnabled: parseBool(map[SETTING_KEY]),
      dashboardSeasons,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (err) {
    sendServerError(res, 'getAdminBiSettings', err, MSG.LOAD);
  }
};

/** PUT /api/admin/bi-settings body: { thirdSeasonCompareEnabled: boolean, dashboardSeasons: Record<string, string[]> } */
const updateAdminBiSettings = async (req, res) => {
  try {
    const enabled = Boolean(req.body?.thirdSeasonCompareEnabled);
    let dashboardSeasons = (req.body?.dashboardSeasons && typeof req.body.dashboardSeasons === 'object')
      ? req.body.dashboardSeasons
      : {};

    // Support legacy payload if visibleSeasons array is passed directly
    if (Array.isArray(req.body?.visibleSeasons) && Object.keys(dashboardSeasons).length === 0) {
      dashboardSeasons = {
        brix_sampling: req.body.visibleSeasons,
        centre_maturity: req.body.visibleSeasons,
      };
    }

    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [SETTING_KEY, enabled ? '1' : '0'],
    );

    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [DASHBOARD_SEASONS_KEY, JSON.stringify(dashboardSeasons)],
    );

    res.json({
      message: 'BI dashboard settings saved.',
      thirdSeasonCompareEnabled: enabled,
      dashboardSeasons,
    });
  } catch (err) {
    sendServerError(res, 'updateAdminBiSettings', err, MSG.SAVE);
  }
};

module.exports = {
  getBiSettings,
  getAdminBiSettings,
  updateAdminBiSettings,
};
