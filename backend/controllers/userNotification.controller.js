const {
  listNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../services/userNotification.service');
const { sendServerError, MSG } = require('../utils/httpError');

const listMyNotifications = async (req, res) => {
  try {
    const data = await listNotificationsForUser(req.user.id, req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'listMyNotifications:', err, MSG.LOAD);
  }
};

const getMyUnreadNotificationCount = async (req, res) => {
  try {
    const data = await getUnreadCount(req.user.id);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getMyUnreadNotificationCount:', err, MSG.LOAD);
  }
};

const markMyNotificationRead = async (req, res) => {
  try {
    await markNotificationRead(req.user.id, Number(req.params.id));
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'markMyNotificationRead:', err, MSG.SAVE);
  }
};

const markAllMyNotificationsRead = async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    sendServerError(res, 'markAllMyNotificationsRead:', err, MSG.SAVE);
  }
};

module.exports = {
  listMyNotifications,
  getMyUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
};
