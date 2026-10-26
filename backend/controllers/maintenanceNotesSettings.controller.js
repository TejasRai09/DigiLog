const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  getHodSettings,
  updateHodSettings,
  PLANTS,
  plantLabel,
  validateDigestTime,
  validateOptionalDigestTime,
} = require('../services/maintenanceNotes.service');
const { sendCombinedDigestForNotesPlant } = require('../services/combinedApprovalDigest.service');

const getMaintenanceNotesApprovalSettings = async (_req, res) => {
  try {
    const settings = await getHodSettings();
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
    sendServerError(res, 'getMaintenanceNotesApprovalSettings:', err, MSG.LOAD);
  }
};

const putMaintenanceNotesApprovalSettings = async (req, res) => {
  try {
    const { sugar, power, production } = req.body || {};
    const byPlant = { sugar, power, production };
    for (const [plant, cfg] of Object.entries(byPlant)) {
      if (!cfg) continue;
      const label = plantLabel(plant);
      if (cfg.digestTime != null && cfg.digestTime !== '' && !validateDigestTime(cfg.digestTime)) {
        return res.status(400).json({
          message: `Digest time 1 for ${label} must be HH:mm (24-hour, IST).`,
        });
      }
      if (cfg.digestTime2 != null && cfg.digestTime2 !== '' && !validateOptionalDigestTime(cfg.digestTime2)) {
        return res.status(400).json({
          message: `Digest time 2 for ${label} must be HH:mm (24-hour, IST), or leave blank.`,
        });
      }
    }
    const settings = await updateHodSettings(req.body || {});
    res.json({
      message: 'Maintenance Notes HOD settings saved.',
      ...settings,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'putMaintenanceNotesApprovalSettings:', err, MSG.SERVER);
  }
};

const postResendMaintenanceNotesDigest = async (req, res) => {
  try {
    const plant = String(req.body?.plant || req.body?.domain || '').trim();
    const mode = String(req.body?.mode || 'all').trim() === 'new' ? 'new' : 'all';
    if (!PLANTS[plant]) {
      return res.status(400).json({ message: 'plant must be sugar, power, or production.' });
    }
    const result = await sendCombinedDigestForNotesPlant(plant, { force: true, mode });
    if (!result.sent) {
      return res.status(200).json({
        message: result.message || 'No digest sent.',
        ...result,
      });
    }
    const label = plantLabel(plant);
    return res.json({
      message: mode === 'new'
        ? `Emailed ${result.count} new pending item(s) (forms, history, and notes) to the ${label} HOD.`
        : `Resent combined digest with ${result.count} pending item(s) to the ${label} HOD.`,
      ...result,
    });
  } catch (err) {
    sendServerError(res, 'postResendMaintenanceNotesDigest:', err, MSG.SAVE);
  }
};

module.exports = {
  getMaintenanceNotesApprovalSettings,
  putMaintenanceNotesApprovalSettings,
  postResendMaintenanceNotesDigest,
};
