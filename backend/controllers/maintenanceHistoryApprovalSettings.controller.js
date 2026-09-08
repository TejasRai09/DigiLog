const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  getApprovalSettings,
  updateApprovalSettings,
  validateDigestTime,
  sendDigestForDomain,
  DOMAIN_TABLES,
} = require('../services/maintenanceHistoryApproval.service');

const DOMAIN_LABEL = {
  sugar: 'Sugar House',
  power: 'Power Plant',
  production: 'Production House',
};

const getMaintenanceHistoryApprovalSettings = async (_req, res) => {
  try {
    const settings = await getApprovalSettings();
    const [users] = await pool.query(
      `SELECT id, name, email, department FROM users WHERE is_active = 1 ORDER BY name ASC`,
    );
    res.json({
      sugar: settings.sugar,
      power: settings.power,
      production: settings.production,
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
    const { sugar, power, production } = req.body || {};
    const byDomain = { sugar, power, production };

    for (const [domain, cfg] of Object.entries(byDomain)) {
      if (!cfg) continue;
      const label = DOMAIN_LABEL[domain] || domain;
      if (cfg.digestTime != null && cfg.digestTime !== '' && !validateDigestTime(cfg.digestTime)) {
        return res.status(400).json({
          message: `Daily digest time for ${label} must be HH:mm (24-hour, IST).`,
        });
      }
      if (cfg.enabled && cfg.hodUserId) {
        const [[user]] = await pool.query(
          'SELECT id, email FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
          [cfg.hodUserId],
        );
        if (!user?.email) {
          return res.status(400).json({
            message: `Selected HOD for ${label} is invalid or inactive.`,
          });
        }
      }
      if (cfg.enabled && !cfg.hodUserId) {
        return res.status(400).json({
          message: `Select an HOD employee before enabling approval for ${label}.`,
        });
      }
    }

    const settings = await updateApprovalSettings({ sugar, power, production });
    res.json({
      message: 'Maintenance history approval settings saved.',
      sugar: settings.sugar,
      power: settings.power,
      production: settings.production,
    });
  } catch (err) {
    sendServerError(res, 'putMaintenanceHistoryApprovalSettings:', err, MSG.SAVE);
  }
};

const postResendMaintenanceHistoryDigest = async (req, res) => {
  try {
    const domain = String(req.body?.domain || '').trim();
    const mode = String(req.body?.mode || 'all').trim() === 'new' ? 'new' : 'all';
    if (!DOMAIN_TABLES[domain]) {
      return res.status(400).json({ message: 'domain must be sugar, power, or production.' });
    }
    const result = await sendDigestForDomain(domain, { force: true, mode });
    if (!result.sent) {
      return res.status(200).json({
        message: result.message || 'No digest sent.',
        ...result,
      });
    }
    const label = DOMAIN_LABEL[domain] || domain;
    return res.json({
      message: mode === 'new'
        ? `Emailed ${result.count} new pending item(s) to the ${label} HOD.`
        : `Resent digest with ${result.count} pending item(s) to the ${label} HOD.`,
      ...result,
    });
  } catch (err) {
    sendServerError(res, 'postResendMaintenanceHistoryDigest:', err, MSG.SAVE);
  }
};

module.exports = {
  getMaintenanceHistoryApprovalSettings,
  putMaintenanceHistoryApprovalSettings,
  postResendMaintenanceHistoryDigest,
};
