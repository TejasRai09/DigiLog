const { sendServerError, MSG } = require('../utils/httpError');
const {
  BRIX_THRESHOLD_DEFAULT,
  THEORETICAL_YIELD_DEFAULT,
  POWER_TARIFF_DEFAULT,
  buildBiConstantsPayload,
  upsertSeasonConstants,
  updateDefaultConstants,
} = require('../utils/biConstants');
const { pool } = require('../config/mysql');

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

function parsePositiveOrDefault(raw, fallback) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function loadLegacyDashboardSeasons() {
  const [rows] = await pool.query(
    'SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (?, ?, ?)',
    [SETTING_KEY, DASHBOARD_SEASONS_KEY, LEGACY_VISIBLE_SEASONS_KEY],
  );
  const map = {};
  rows.forEach((r) => { map[r.setting_key] = r.setting_value; });

  let dashboardSeasons = parseJsonObject(map[DASHBOARD_SEASONS_KEY]);
  const legacySeasons = parseJsonArray(map[LEGACY_VISIBLE_SEASONS_KEY]);

  if (Object.keys(dashboardSeasons).length === 0 && legacySeasons.length > 0) {
    dashboardSeasons = {
      brix_sampling: legacySeasons,
      centre_maturity: legacySeasons,
    };
  }

  return {
    thirdSeasonCompareEnabled: parseBool(map[SETTING_KEY]),
    dashboardSeasons,
  };
}

/** GET /api/bi/settings — BI dashboard options for signed-in users */
const getBiSettings = async (_req, res) => {
  try {
    const [legacy, constants] = await Promise.all([
      loadLegacyDashboardSeasons(),
      buildBiConstantsPayload(),
    ]);
    res.json({
      thirdSeasonCompareEnabled: legacy.thirdSeasonCompareEnabled,
      dashboardSeasons: legacy.dashboardSeasons,
      seasonMapping: constants.seasonMapping,
      theoreticalYield: constants.theoreticalYield,
      powerTariffRate: constants.powerTariffRate,
      brixThreshold: constants.brixThreshold,
      defaults: constants.defaults,
      constantsBySeason: constants.constantsBySeason,
      currentSeasonLabel: constants.currentSeasonLabel,
    });
  } catch (err) {
    sendServerError(res, 'getBiSettings', err, MSG.LOAD);
  }
};

/** GET /api/admin/bi-settings */
const getAdminBiSettings = async (_req, res) => {
  try {
    const [legacy, constants] = await Promise.all([
      loadLegacyDashboardSeasons(),
      buildBiConstantsPayload(),
    ]);
    res.json({
      thirdSeasonCompareEnabled: legacy.thirdSeasonCompareEnabled,
      dashboardSeasons: legacy.dashboardSeasons,
      theoreticalYield: constants.theoreticalYield,
      powerTariffRate: constants.powerTariffRate,
      brixThreshold: constants.brixThreshold,
      defaults: constants.defaults,
      constantsBySeason: constants.constantsBySeason,
      seasons: constants.seasons,
      currentSeasonLabel: constants.currentSeasonLabel,
    });
  } catch (err) {
    sendServerError(res, 'getAdminBiSettings', err, MSG.LOAD);
  }
};

/** PUT /api/admin/bi-settings body: { seasonLabel?, theoreticalYield?, powerTariffRate?, brixThreshold? } */
const updateAdminBiSettings = async (req, res) => {
  try {
    const theoreticalYield = parsePositiveOrDefault(req.body?.theoreticalYield, THEORETICAL_YIELD_DEFAULT);
    const powerTariffRate = parsePositiveOrDefault(req.body?.powerTariffRate, POWER_TARIFF_DEFAULT);
    const brixThreshold = parsePositiveOrDefault(req.body?.brixThreshold, BRIX_THRESHOLD_DEFAULT);
    const seasonLabel = typeof req.body?.seasonLabel === 'string' ? req.body.seasonLabel.trim() : '';

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

    const values = { theoreticalYield, powerTariffRate, brixThreshold };

    if (seasonLabel) {
      const [[mapping]] = await pool.query(
        'SELECT season_label FROM season_mapping WHERE season_label = ? LIMIT 1',
        [seasonLabel],
      );
      if (!mapping) {
        return res.status(400).json({ message: 'Unknown sugar season.' });
      }
      await upsertSeasonConstants(seasonLabel, values);
    } else {
      await updateDefaultConstants(values);
    }

    const constants = await buildBiConstantsPayload();
    res.json({
      message: 'BI dashboard settings saved.',
      thirdSeasonCompareEnabled: false,
      seasonLabel: seasonLabel || null,
      theoreticalYield,
      powerTariffRate,
      brixThreshold,
      defaults: constants.defaults,
      constantsBySeason: constants.constantsBySeason,
      seasons: constants.seasons,
      currentSeasonLabel: constants.currentSeasonLabel,
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
