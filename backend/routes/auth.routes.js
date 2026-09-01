const router = require('express').Router();
const { login, outlookLogin, googleLogin, getMe, uploadMyAvatar, deleteMyAvatar, getUserAvatar } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { uploadAvatarMiddleware } = require('../middleware/avatarUpload');

router.post('/login', login);
router.post('/outlook', outlookLogin);
router.post('/google', googleLogin);
router.get('/me', authenticate, getMe);
router.get('/users/:userId/avatar', authenticate, getUserAvatar);
router.post('/me/avatar', authenticate, uploadAvatarMiddleware, uploadMyAvatar);
router.delete('/me/avatar', authenticate, deleteMyAvatar);

const {
  startTrackingSession,
  sessionHeartbeat,
  logoutSession,
} = require('../controllers/sessionActivity.controller');

router.post('/session/start', authenticate, startTrackingSession);
router.post('/session/heartbeat', authenticate, sessionHeartbeat);
router.post('/logout', authenticate, logoutSession);

module.exports = router;
