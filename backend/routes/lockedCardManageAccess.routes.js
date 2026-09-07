const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getMyLockedCardManageAccessHandler } = require('../controllers/lockedCardManageAccess.controller');

router.get('/me', authenticate, getMyLockedCardManageAccessHandler);

module.exports = router;
