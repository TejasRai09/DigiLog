const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getAccessibleApps } = require('../controllers/app.controller');

router.get('/', authenticate, getAccessibleApps);

module.exports = router;
