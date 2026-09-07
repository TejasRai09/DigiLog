const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  getApprovalSettings,
  updateApprovalSettings,
  validateDigestTime,
} = require('../services/maintenanceHistoryApproval.service');

const getMaintenanceHistoryApprovalSettings = async (_req, res) => {
  try {
    const settings = await getApprovalSettings();
    const [users] = await pool.query(
      `SELECT id, name, email, department FROM users WHERE is_active = 1 ORDER BY name ASC`,
    );
    res.json({
      sugar: settings.sugar,
      power: settings.power,
      employees: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
      })),
    });
  } catch (err) {
    sendServerError(res, 'getMaintenanceHistoryApprovalSettings:', err, MSG.LOAD);
  }
};

const putMaintenanceHistoryApprovalSettings = async (req, res) => {
  try {
    const { sugar, power } = req.body || {};

    for (const [domain, cfg] of Object.entries({ sugar, power })) {
      if (!cfg) continue;
      if (cfg.digestTime != null && cfg.digestTime !== '' && !validateDigestTime(cfg.digestTime)) {
        return res.status(400).json({
          message: `Daily digest time for ${domain === 'sugar' ? 'Sugar House' : 'Power Plant'} must be HH:mm (24-hour, IST).`,
        });
      }
      if (cfg.enabled && cfg.hodUserId) {
        const [[user]] = await pool.query(
          'SELECT id, email FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
          [cfg.hodUserId],
        );
        if (!user?.email) {
          return res.status(400).json({
            message: `Selected HOD for ${domain === 'sugar' ? 'Sugar House' : 'Power Plant'} is invalid or inactive.`,
          });
        }
      }
      if (cfg.enabled && !cfg.hodUserId) {
        return res.status(400).json({
          message: `Select an HOD employee before enabling approval for ${domain === 'sugar' ? 'Sugar House' : 'Power Plant'}.`,
        });
      }
    }

    const settings = await updateApprovalSettings({ sugar, power });
    res.json({
      message: 'Maintenance history approval settings saved.',
      sugar: settings.sugar,
      power: settings.power,
    });
  } catch (err) {
    sendServerError(res, 'putMaintenanceHistoryApprovalSettings:', err, MSG.SAVE);
  }
};

module.exports = {
  getMaintenanceHistoryApprovalSettings,
  putMaintenanceHistoryApprovalSettings,
};
