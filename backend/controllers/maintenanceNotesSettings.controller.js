const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { getHodSettings, updateHodSettings } = require('../services/maintenanceNotes.service');

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

module.exports = {
  getMaintenanceNotesApprovalSettings,
  putMaintenanceNotesApprovalSettings,
};
