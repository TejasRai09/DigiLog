const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  listMyNotifications,
  getMyUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} = require('../controllers/userNotification.controller');

router.get('/', authenticate, listMyNotifications);
router.get('/unread-count', authenticate, getMyUnreadNotificationCount);
router.post('/read-all', authenticate, markAllMyNotificationsRead);
router.post('/:id/read', authenticate, markMyNotificationRead);

module.exports = router;
