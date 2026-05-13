const router = require('express').Router();
const { login, outlookLogin, getMe, uploadMyAvatar, deleteMyAvatar } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { uploadAvatarMiddleware } = require('../middleware/avatarUpload');

router.post('/login', login);
router.post('/outlook', outlookLogin);
router.get('/me', authenticate, getMe);
router.post('/me/avatar', authenticate, uploadAvatarMiddleware, uploadMyAvatar);
router.delete('/me/avatar', authenticate, deleteMyAvatar);

module.exports = router;
