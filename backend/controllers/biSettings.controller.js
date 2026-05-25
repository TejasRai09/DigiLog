const { pool } = require('../config/mysql');

const SETTING_KEY = 'bi_third_season_compare';

function parseBool(v) {
  return v === '1' || v === 'true' || v === true;
}

/** GET /api/bi/settings — BI dashboard options for signed-in users */
const getBiSettings = async (_req, res) => {
  const [[row]] = await pool.query(
    'SELECT setting_value FROM portal_settings WHERE setting_key = ? LIMIT 1',
    [SETTING_KEY],
  );
  res.json({
    thirdSeasonCompareEnabled: row ? parseBool(row.setting_value) : false,
  });
};

/** GET /api/admin/bi-settings */
const getAdminBiSettings = async (_req, res) => {
  const [[row]] = await pool.query(
    'SELECT setting_value, updated_at FROM portal_settings WHERE setting_key = ? LIMIT 1',
    [SETTING_KEY],
  );
  res.json({
    thirdSeasonCompareEnabled: row ? parseBool(row.setting_value) : false,
    updatedAt: row?.updated_at ?? null,
  });
};

/** PUT /api/admin/bi-settings  body: { thirdSeasonCompareEnabled: boolean } */
const updateAdminBiSettings = async (req, res) => {
  const enabled = Boolean(req.body?.thirdSeasonCompareEnabled);
  await pool.query(
    `INSERT INTO portal_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [SETTING_KEY, enabled ? '1' : '0'],
  );
  res.json({
    message: 'BI dashboard settings saved.',
    thirdSeasonCompareEnabled: enabled,
  });
};

module.exports = {
  getBiSettings,
  getAdminBiSettings,
  updateAdminBiSettings,
};
