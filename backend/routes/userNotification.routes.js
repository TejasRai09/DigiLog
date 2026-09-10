const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  listMyNotifications,
  getMyUnreadNotificationCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  deleteMyNotification,
} = require('../controllers/userNotification.controller');

router.get('/', authenticate, listMyNotifications);
router.get('/unread-count', authenticate, getMyUnreadNotificationCount);
router.post('/read-all', authenticate, markAllMyNotificationsRead);
router.delete('/:id', authenticate, deleteMyNotification);
router.post('/:id/read', authenticate, markMyNotificationRead);

module.exports = router;
