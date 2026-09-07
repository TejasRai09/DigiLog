const {
  listAdminLockedCardManageAccess,
  upsertLockedCardManageAccess,
  getMyLockedCardManageAccess,
} = require('../services/lockedCardManageAccess.service');
const { sendServerError, MSG } = require('../utils/httpError');

const getAdminLockedCardManageAccess = async (req, res) => {
  try {
    const data = await listAdminLockedCardManageAccess();
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getAdminLockedCardManageAccess:', err, MSG.LOAD);
  }
};

const upsertAdminLockedCardManageAccess = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!Array.isArray(req.body?.domains)) {
      return res.status(400).json({ message: 'domains must be an array.' });
    }
    const result = await upsertLockedCardManageAccess(userId, req.body.domains, req.user.id);
    res.json({
      message: result.enabled
        ? 'Locked-card manage access saved.'
        : 'Locked-card manage access removed for this employee.',
      ...result,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'upsertAdminLockedCardManageAccess:', err, MSG.SAVE);
  }
};

const getMyLockedCardManageAccessHandler = async (req, res) => {
  try {
    const access = await getMyLockedCardManageAccess(req.user);
    res.json(access);
  } catch (err) {
    sendServerError(res, 'getMyLockedCardManageAccess:', err, MSG.LOAD);
  }
};

module.exports = {
  getAdminLockedCardManageAccess,
  upsertAdminLockedCardManageAccess,
  getMyLockedCardManageAccessHandler,
};
