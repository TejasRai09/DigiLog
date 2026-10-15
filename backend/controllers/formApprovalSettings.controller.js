const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { listSettingsTree, saveSettingsTree, sendDigestForCard } = require('../services/formApproval.service');

const getFormApprovalSettings = async (_req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, name, email, department FROM users WHERE is_active = 1 ORDER BY name ASC`,
    );
    const cards = await listSettingsTree();
    res.json({
      cards,
      employees: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
      })),
    });
  } catch (err) {
    sendServerError(res, 'getFormApprovalSettings:', err, MSG.LOAD);
  }
};

const putFormApprovalSettings = async (req, res) => {
  try {
    const cards = await saveSettingsTree(req.body?.cards || []);
    res.json({
      message: 'Forms approval settings saved.',
      cards,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'putFormApprovalSettings:', err, MSG.SAVE);
  }
};

const postResendFormApprovalDigest = async (req, res) => {
  try {
    const appId = Number(req.body?.appId);
    const mode = String(req.body?.mode || 'all').trim() === 'new' ? 'new' : 'all';
    if (!appId) {
      return res.status(400).json({ message: 'appId is required.' });
    }
    const result = await sendDigestForCard(appId, { force: true, mode });
    if (!result.sent) {
      return res.status(200).json({
        message: result.message || 'No digest sent.',
        ...result,
      });
    }
    const label = result.cardLabel || 'this card';
    return res.json({
      message: mode === 'new'
        ? `Emailed ${result.count} new pending item(s) to the ${label} HOD.`
        : `Resent digest with ${result.count} pending item(s) to the ${label} HOD.`,
      ...result,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'postResendFormApprovalDigest:', err, MSG.SAVE);
  }
};

module.exports = {
  getFormApprovalSettings,
  putFormApprovalSettings,
  postResendFormApprovalDigest,
};
