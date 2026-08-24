const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');

const SETTING_KEY = 'bi_third_season_compare';
const DASHBOARD_SEASONS_KEY = 'bi_dashboard_seasons';
const LEGACY_VISIBLE_SEASONS_KEY = 'bi_visible_seasons';
const THEORETICAL_YIELD_KEY = 'distillery_theoretical_yield';
const POWER_TARIFF_KEY = 'power_tariff_rate';

const THEORETICAL_YIELD_DEFAULT = 64.4;
const POWER_TARIFF_DEFAULT = 4.85;

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
      'SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (?, ?, ?, ?, ?)',
      [SETTING_KEY, DASHBOARD_SEASONS_KEY, LEGACY_VISIBLE_SEASONS_KEY, THEORETICAL_YIELD_KEY, POWER_TARIFF_KEY],
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

    let seasonMapping = {};
    try {
      const [seasonRows] = await pool.query(
        'SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date DESC',
      );
      seasonRows.forEach((s) => {
        seasonMapping[s.season_label] = {
          startDate: s.start_date ? String(s.start_date).slice(0, 10) : null,
          endDate: s.end_date ? String(s.end_date).slice(0, 10) : null,
        };
      });
    } catch (_) {
      seasonMapping = {};
    }

    res.json({
      thirdSeasonCompareEnabled: parseBool(map[SETTING_KEY]),
      dashboardSeasons,
      seasonMapping,
      theoreticalYield: parseFloat(map[THEORETICAL_YIELD_KEY] ?? THEORETICAL_YIELD_DEFAULT) || THEORETICAL_YIELD_DEFAULT,
      powerTariffRate: parseFloat(map[POWER_TARIFF_KEY] ?? POWER_TARIFF_DEFAULT) || POWER_TARIFF_DEFAULT,
    });
  } catch (err) {
    sendServerError(res, 'getBiSettings', err, MSG.LOAD);
  }
};

/** GET /api/admin/bi-settings */
const getAdminBiSettings = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value, updated_at FROM portal_settings WHERE setting_key IN (?, ?, ?, ?, ?)',
      [SETTING_KEY, DASHBOARD_SEASONS_KEY, LEGACY_VISIBLE_SEASONS_KEY, THEORETICAL_YIELD_KEY, POWER_TARIFF_KEY],
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
      theoreticalYield: parseFloat(map[THEORETICAL_YIELD_KEY] ?? THEORETICAL_YIELD_DEFAULT) || THEORETICAL_YIELD_DEFAULT,
      powerTariffRate: parseFloat(map[POWER_TARIFF_KEY] ?? POWER_TARIFF_DEFAULT) || POWER_TARIFF_DEFAULT,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (err) {
    sendServerError(res, 'getAdminBiSettings', err, MSG.LOAD);
  }
};

/** PUT /api/admin/bi-settings body: { theoreticalYield?, powerTariffRate? } */
const updateAdminBiSettings = async (req, res) => {
  try {
    const rawYield = parseFloat(req.body?.theoreticalYield);
    const theoreticalYield = Number.isFinite(rawYield) && rawYield > 0 ? rawYield : THEORETICAL_YIELD_DEFAULT;
    const rawTariff = parseFloat(req.body?.powerTariffRate);
    const powerTariffRate = Number.isFinite(rawTariff) && rawTariff > 0 ? rawTariff : POWER_TARIFF_DEFAULT;

    // Compare chips use season_mapping only — clear obsolete gates/filters.
    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [SETTING_KEY, '0'],
    );

    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [DASHBOARD_SEASONS_KEY, '{}'],
    );

    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [THEORETICAL_YIELD_KEY, String(theoreticalYield)],
    );

    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [POWER_TARIFF_KEY, String(powerTariffRate)],
    );

    res.json({
      message: 'BI dashboard settings saved.',
      thirdSeasonCompareEnabled: false,
      theoreticalYield,
      powerTariffRate,
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
