const router = require('express').Router();
const { login, outlookLogin, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

router.post('/login',   login);
router.post('/outlook', outlookLogin);
router.get('/me',       authenticate, getMe);

module.exports = router;
